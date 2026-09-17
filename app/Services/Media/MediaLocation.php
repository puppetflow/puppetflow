<?php

namespace App\Services\Media;

use App\Models\MediaFolder;

/**
 * Resolved placement of a media asset or folder: owner, scope, team and parent folder.
 */
final class MediaLocation
{
    public function __construct(
        public readonly string $userId,
        public readonly string $visibility,
        public readonly ?string $teamId,
        public readonly ?string $folderId,
    ) {}

    public static function fromFolder(MediaFolder $folder): self
    {
        return new self($folder->user_id, $folder->visibility, $folder->team_id, $folder->id);
    }

    public function matchesFolder(MediaFolder $folder): bool
    {
        return $folder->user_id === $this->userId
            && $folder->visibility === $this->visibility
            && $folder->team_id === $this->teamId;
    }

    /** @return array{user_id: string, visibility: string, team_id: string|null} */
    public function assignment(): array
    {
        return [
            'user_id' => $this->userId,
            'visibility' => $this->visibility,
            'team_id' => $this->teamId,
        ];
    }
}
