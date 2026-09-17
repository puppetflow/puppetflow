import type { MediaAsset } from '@/Domains/Media/types';

export type MediaUploadTransport = 'proxy' | 'presigned';
export type MediaUploadChecksumAlgorithm = 'sha256' | 'md5';
export type MediaUploadLocation = Record<string, string | number | null | undefined>;

export interface MediaUploadRequest {
    files: File[];
    location: MediaUploadLocation;
    checksumAlgorithm: MediaUploadChecksumAlgorithm;
    onProgress?: (percentage: number) => void;
}

export interface MediaUploadAdapter {
    upload(request: MediaUploadRequest): Promise<MediaAsset[]>;
}
