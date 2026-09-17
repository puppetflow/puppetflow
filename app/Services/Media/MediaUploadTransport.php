<?php

namespace App\Services\Media;

final class MediaUploadTransport
{
    public const PROXY = 'proxy';

    public const PRESIGNED = 'presigned';

    public const CHECKSUM_MD5 = 'md5';

    public const CHECKSUM_SHA256 = 'sha256';

    public function current(): string
    {
        $disk = $this->disk();
        $driver = config("filesystems.disks.{$disk}.driver");

        return $driver === 's3' ? self::PRESIGNED : self::PROXY;
    }

    public function checksumAlgorithm(): string
    {
        return $this->disk() === 'puppetflow-r2' ? self::CHECKSUM_MD5 : self::CHECKSUM_SHA256;
    }

    private function disk(): string
    {
        $disk = config('filesystems.app_storage_disk', 'puppetflow-local');

        return is_string($disk) ? $disk : 'puppetflow-local';
    }
}
