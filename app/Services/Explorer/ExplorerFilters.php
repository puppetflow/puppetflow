<?php

namespace App\Services\Explorer;

use Illuminate\Http\Request;

/**
 * Normalised query string of an explorer page (flows, media...).
 */
final class ExplorerFilters
{
    public function __construct(
        public readonly string $search,
        public readonly string $view,
        public readonly ?string $folderId,
        public readonly ?string $ownerId,
        public readonly ?string $teamId,
        public readonly bool $everywhere,
    ) {}

    public static function fromRequest(Request $request): self
    {
        $search = $request->string('search')->toString();

        return new self(
            search: $search,
            view: $request->string('view')->toString(),
            folderId: trim($request->string('folder_id')->toString()) ?: null,
            ownerId: trim($request->string('owner_id')->toString()) ?: null,
            teamId: trim($request->string('team_id')->toString()) ?: null,
            everywhere: $request->boolean('search_everywhere') && $search !== '',
        );
    }

    public function isWorkspaceView(): bool
    {
        return $this->view === 'workspace';
    }

    public function isUsersView(): bool
    {
        return $this->view === 'users';
    }

    /**
     * Payload exposed to the explorer front end as "filters".
     *
     * @return array<string, mixed>
     */
    public function toPayload(?string $folderId, ?string $ownerId, ?string $teamId = null): array
    {
        return [
            'search' => $this->search,
            'folder_id' => $folderId,
            'view' => $this->view,
            'owner_id' => $ownerId,
            'team_id' => $teamId,
            'search_everywhere' => $this->everywhere ? '1' : null,
        ];
    }
}
