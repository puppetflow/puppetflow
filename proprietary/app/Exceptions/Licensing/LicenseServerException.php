<?php

namespace App\Exceptions\Licensing;

use RuntimeException;

class LicenseServerException extends RuntimeException
{
    private const DEFINITIVE_REJECTION_CODES = [
        'license_inactive',
        'license_instance_inactive',
    ];

    public function __construct(
        string $message,
        private readonly ?int $statusCode = null,
        private readonly ?string $errorCode = null,
    ) {
        parent::__construct($message);
    }

    public function statusCode(): ?int
    {
        return $this->statusCode;
    }

    public function isDefinitiveRejection(): bool
    {
        return $this->statusCode === 403
            && in_array($this->errorCode, self::DEFINITIVE_REJECTION_CODES, true);
    }
}
