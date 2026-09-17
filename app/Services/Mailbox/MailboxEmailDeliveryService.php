<?php

namespace App\Services\Mailbox;

use App\Models\FlowRun;
use App\Models\MailboxEmail;
use App\Models\MailboxWatcher;
use App\Services\Integration\Other\Vendor\Mailbox\RuleEvaluatorService;
use Illuminate\Support\Facades\DB;

class MailboxEmailDeliveryService
{
    public function __construct(
        private readonly RuleEvaluatorService $rules,
        private readonly MailboxRunQueueService $queue,
    ) {}

    public function deliver(MailboxEmail $email): bool
    {
        $claim = $this->claimDeliveryAttempt($email);
        if (is_bool($claim)) {
            return $claim;
        }
        [$claimedEmail, $attemptNumber, $maxAttempts] = $claim;

        try {
            [$delivered, $matched, $matchedWithoutDelivery] = $this->publishToWatchers($claimedEmail);
            $this->finalizeDeliveryAttempt(
                $claimedEmail,
                $attemptNumber,
                $maxAttempts,
                $delivered,
                $matched,
                $matchedWithoutDelivery,
            );

            return $delivered;
        } catch (\Throwable $exception) {
            $this->failDeliveryAttempt($claimedEmail, $attemptNumber, $exception);

            throw $exception;
        }
    }

    /** @return array{MailboxEmail, int, int}|bool */
    private function claimDeliveryAttempt(MailboxEmail $email): array|bool
    {
        return DB::transaction(function () use ($email): array|bool {
            $locked = MailboxEmail::query()->whereKey($email->getKey())->lockForUpdate()->first();
            if (! $locked instanceof MailboxEmail) {
                return false;
            }
            if ($locked->getAttribute('delivery_status') === MailboxEmail::DELIVERY_DELIVERED) {
                return true;
            }

            $attemptedAt = now();
            $maxAttempts = $this->configInt('puppetflow.mailbox_delivery.max_attempts', 10, 1);
            $retryAfter = $this->configInt('puppetflow.mailbox_delivery.retry_after_seconds', 30, 5);
            $attempts = is_numeric($locked->getAttribute('delivery_attempts'))
                ? (int) $locked->getAttribute('delivery_attempts')
                : 0;
            $previousAttemptedAt = $locked->getAttribute('delivery_attempted_at');
            $deadline = $locked->getAttribute('delivery_deadline_at');
            if (
                ! in_array($locked->getAttribute('delivery_status'), [
                    MailboxEmail::DELIVERY_PENDING,
                    MailboxEmail::DELIVERY_AWAITING_RUN,
                    MailboxEmail::DELIVERY_FAILED,
                ], true)
                || ($previousAttemptedAt instanceof \DateTimeInterface
                    && $previousAttemptedAt > $attemptedAt->copy()->subSeconds($retryAfter))
            ) {
                return false;
            }
            if ($attempts >= $maxAttempts || ($deadline instanceof \DateTimeInterface && $deadline <= $attemptedAt)) {
                $locked->update([
                    'delivery_status' => MailboxEmail::DELIVERY_FAILED,
                    'delivery_attempts' => $maxAttempts,
                    'delivery_last_error' => 'Delivery window or attempt limit exhausted.',
                    'delivery_attempted_at' => $attemptedAt,
                ]);

                return false;
            }

            $attemptNumber = $attempts + 1;
            $locked->update([
                'delivery_status' => MailboxEmail::DELIVERY_PENDING,
                'delivery_attempts' => $attemptNumber,
                'delivery_last_error' => null,
                'delivery_attempted_at' => $attemptedAt,
            ]);

            return [$locked, $attemptNumber, $maxAttempts];
        }, 3);
    }

    /** @return array{bool, bool, bool} */
    private function publishToWatchers(MailboxEmail $email): array
    {
        $delivered = false;
        $matched = false;
        $matchedWithoutDelivery = false;
        $watchers = MailboxWatcher::query()
            ->where('mailbox_id', $email->getAttribute('mailbox_id'))
            ->where('is_active', true)
            ->where('stale', false)
            ->whereHas('mailbox', fn ($query) => $query
                ->where('is_active', true)
                ->where('stale', false)
                ->whereHas('domain', fn ($domain) => $domain
                    ->where('is_active', true)
                    ->where('stale', false)))
            ->with('rules')
            ->get();

        foreach ($watchers as $watcher) {
            if (! $this->rules->evaluate($watcher->rules, $email)) {
                continue;
            }
            $matched = true;
            $parsedValue = $watcher->extract_enabled && $watcher->extract_expression
                ? $this->rules->extractParsedValue(
                    $watcher->extract_expression,
                    $email,
                    $watcher->extract_mode ?? 'regex',
                )
                : null;
            $payload = $this->payload($email, $parsedValue);
            $runs = FlowRun::query()
                ->select(['id', 'flow_id', 'status'])
                ->where('flow_id', $watcher->getAttribute('flow_id'))
                ->where('status', 'running')
                ->whereHas('mailboxRunWatchers', fn ($query) => $query
                    ->where('mailbox_watcher_id', $watcher->getKey())
                    ->where('mailbox_id', $email->getAttribute('mailbox_id'))
                    ->where('watcher_name', $watcher->getAttribute('id')))
                ->get();

            $watcherDelivered = false;
            foreach ($runs as $run) {
                $published = $this->queue->publish($run, $email, $watcher, $payload);
                $watcherDelivered = $published || $watcherDelivered;
                $delivered = $published || $delivered;
            }
            $matchedWithoutDelivery = ! $watcherDelivered || $matchedWithoutDelivery;
        }

        return [$delivered, $matched, $matchedWithoutDelivery];
    }

    private function finalizeDeliveryAttempt(
        MailboxEmail $email,
        int $attemptNumber,
        int $maxAttempts,
        bool $delivered,
        bool $matched,
        bool $matchedWithoutDelivery,
    ): void {
        DB::transaction(function () use ($email, $attemptNumber, $maxAttempts, $delivered, $matched, $matchedWithoutDelivery): void {
            $locked = MailboxEmail::query()->whereKey($email->getKey())->lockForUpdate()->first();
            if (! $locked instanceof MailboxEmail || ! $this->isCurrentAttempt($locked, $attemptNumber)) {
                return;
            }
            $deadline = $locked->getAttribute('delivery_deadline_at');
            $retryable = $matched
                && $matchedWithoutDelivery
                && $attemptNumber < $maxAttempts
                && (! $deadline instanceof \DateTimeInterface || $deadline > now());
            $locked->update([
                'delivery_status' => $retryable
                    ? MailboxEmail::DELIVERY_AWAITING_RUN
                    : ($matchedWithoutDelivery
                        ? MailboxEmail::DELIVERY_FAILED
                        : ($delivered ? MailboxEmail::DELIVERY_DELIVERED : MailboxEmail::DELIVERY_UNMATCHED)),
                'delivery_last_error' => $retryable
                    ? 'Matching watcher found, but no authorized running run accepted delivery.'
                    : ($matchedWithoutDelivery
                        ? 'No authorized running run accepted delivery before the retry limit.'
                        : null),
                'delivered_at' => $delivered ? ($locked->getAttribute('delivered_at') ?? now()) : null,
            ]);
        }, 3);
    }

    private function failDeliveryAttempt(MailboxEmail $email, int $attemptNumber, \Throwable $exception): void
    {
        DB::transaction(function () use ($email, $attemptNumber, $exception): void {
            $locked = MailboxEmail::query()->whereKey($email->getKey())->lockForUpdate()->first();
            if (! $locked instanceof MailboxEmail || ! $this->isCurrentAttempt($locked, $attemptNumber)) {
                return;
            }
            $locked->update([
                'delivery_status' => MailboxEmail::DELIVERY_FAILED,
                'delivery_last_error' => $exception::class,
                'delivery_attempted_at' => now(),
            ]);
        }, 3);
    }

    private function isCurrentAttempt(MailboxEmail $email, int $attemptNumber): bool
    {
        $attempts = $email->getAttribute('delivery_attempts');

        return $email->getAttribute('delivery_status') !== MailboxEmail::DELIVERY_DELIVERED
            && is_numeric($attempts)
            && (int) $attempts === $attemptNumber;
    }

    public function retryPending(int $limit = 100): int
    {
        $retryAfter = $this->configInt('puppetflow.mailbox_delivery.retry_after_seconds', 30, 5);
        $maxAttempts = $this->configInt('puppetflow.mailbox_delivery.max_attempts', 10, 1);
        $emails = MailboxEmail::query()
            ->whereIn('delivery_status', [
                MailboxEmail::DELIVERY_PENDING,
                MailboxEmail::DELIVERY_AWAITING_RUN,
                MailboxEmail::DELIVERY_FAILED,
            ])
            ->where('delivery_attempts', '<', $maxAttempts)
            ->where(function ($query) use ($retryAfter): void {
                $query->whereNull('delivery_attempted_at')
                    ->orWhere('delivery_attempted_at', '<=', now()->subSeconds($retryAfter));
            })
            ->orderBy('id')
            ->limit(max(1, $limit))
            ->get();

        $delivered = 0;
        foreach ($emails as $email) {
            try {
                if ($this->deliver($email)) {
                    $delivered++;
                }
            } catch (\Throwable) {
                // Failure metadata is persisted by deliver() and retried later.
            }
        }

        return $delivered;
    }

    /** @return array<string, mixed> */
    private function payload(MailboxEmail $email, ?string $parsedValue): array
    {
        $text = $email->getAttribute('text_body');
        $html = $email->getAttribute('html_body');

        return [
            'from' => $email->from_address,
            'sender_authentication' => MailboxEmail::SENDER_AUTHENTICATION_UNVERIFIED,
            'to' => $email->to_address,
            'subject' => $email->getAttribute('subject'),
            'text' => is_string($text) ? $text : null,
            'html' => is_string($html) ? $html : null,
            'parsed' => $parsedValue,
            'body' => $email->text_body ?: $email->html_body,
            'date' => $this->iso8601($email->getAttribute('date')),
            'parsed_value' => $parsedValue,
            'received_at' => $this->iso8601($email->getAttribute('received_at')),
        ];
    }

    private function iso8601(mixed $value): ?string
    {
        return $value instanceof \DateTimeInterface
            ? $value->format(DATE_ATOM)
            : (is_string($value) ? $value : null);
    }

    private function configInt(string $key, int $default, int $minimum): int
    {
        $configured = config($key, $default);

        return max($minimum, is_numeric($configured) ? (int) $configured : $default);
    }
}
