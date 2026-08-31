<?php

namespace App\Services\Flow;

use App\Models\WorkspaceProxy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

final class FlowProxyFilterRuleService
{
    private const FIELDS = ['country_code', 'group'];

    private const OPERATORS = ['equals', 'not_equals'];

    private const MAX_RULES = 50;

    /**
     * @return list<array{rule_group: int, field: string, operator: string, value: string}>|null
     */
    public function normalize(mixed $rules): ?array
    {
        if ($rules === null || $rules === []) {
            return null;
        }

        if (! is_array($rules) || count($rules) > self::MAX_RULES) {
            throw $this->invalid();
        }

        $normalized = [];
        foreach ($rules as $rule) {
            if (! is_array($rule)) {
                throw $this->invalid();
            }

            $ruleGroup = $rule['rule_group'] ?? null;
            $field = $rule['field'] ?? null;
            $operator = $rule['operator'] ?? null;
            $value = $rule['value'] ?? null;

            if (
                ! is_int($ruleGroup)
                || $ruleGroup < 0
                || $ruleGroup >= self::MAX_RULES
                || ! is_string($field)
                || ! in_array($field, self::FIELDS, true)
                || ! is_string($operator)
                || ! in_array($operator, self::OPERATORS, true)
                || ! is_string($value)
            ) {
                throw $this->invalid();
            }

            $value = trim($value);
            if (
                $value === ''
                || strlen($value) > 255
                || ($field === 'country_code' && preg_match('/^[A-Za-z]{2}$/', $value) !== 1)
            ) {
                throw $this->invalid();
            }

            $normalized[] = [
                'rule_group' => $ruleGroup,
                'field' => $field,
                'operator' => $operator,
                'value' => $field === 'country_code' ? strtoupper($value) : $value,
            ];
        }

        return $normalized;
    }

    /**
     * @param  Builder<WorkspaceProxy>  $query
     */
    public function apply(Builder $query, mixed $rules): bool
    {
        $normalized = $this->normalize($rules);
        if ($normalized === null) {
            return false;
        }

        /** @var array<int, list<array{rule_group: int, field: string, operator: string, value: string}>> $groups */
        $groups = [];
        foreach ($normalized as $rule) {
            $groups[$rule['rule_group']][] = $rule;
        }
        ksort($groups);

        $query->where(function (Builder $groupQuery) use ($groups): void {
            foreach (array_values($groups) as $groupIndex => $groupRules) {
                $groupClause = function (Builder $ruleQuery) use ($groupRules): void {
                    foreach ($groupRules as $rule) {
                        $column = $ruleQuery->getModel()->qualifyColumn($rule['field']);
                        if ($rule['operator'] === 'equals') {
                            $ruleQuery->where($column, $rule['value']);

                            continue;
                        }

                        $ruleQuery->where(function (Builder $notEquals) use ($column, $rule): void {
                            $notEquals
                                ->whereNull($column)
                                ->orWhere($column, '!=', $rule['value']);
                        });
                    }
                };

                if ($groupIndex === 0) {
                    $groupQuery->where($groupClause);
                } else {
                    $groupQuery->orWhere($groupClause);
                }
            }
        });

        return true;
    }

    private function invalid(): ValidationException
    {
        return ValidationException::withMessages([
            'proxy_filter_rules' => 'The proxy filter rules are invalid.',
        ]);
    }
}
