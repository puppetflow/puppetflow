import type { MediaAsset } from '@/Domains/Media/types';
import { createMediaUploadAdapter } from '@/Domains/Media/uploads/createMediaUploadAdapter';
import type {
    MediaUploadLocation,
    MediaUploadChecksumAlgorithm,
    MediaUploadTransport,
} from '@/Domains/Media/uploads/types';

export type { MediaUploadLocation } from '@/Domains/Media/uploads/types';

export function uploadMedia(
    files: File[],
    onProgress?: (percentage: number) => void,
    location: MediaUploadLocation = {},
    transport: MediaUploadTransport = 'proxy',
    checksumAlgorithm: MediaUploadChecksumAlgorithm = 'sha256',
): Promise<MediaAsset[]> {
    return createMediaUploadAdapter(transport).upload({
        files,
        location,
        checksumAlgorithm,
        onProgress,
    });
}
