import { csrfHeaders } from '@/Shared/Utils/csrf';
import type { MediaAsset } from '@/Domains/Media/types';
import type { MediaUploadAdapter, MediaUploadRequest } from './types';

function firstValidationError(value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    for (const error of Object.values(value)) {
        if (typeof error === 'string') return error;
        if (Array.isArray(error)) {
            const message = error.find(item => typeof item === 'string');
            if (typeof message === 'string') return message;
        }
    }
    return null;
}

function uploadRequestError(request: XMLHttpRequest): Error {
    let payload: { message?: unknown; errors?: unknown } = {};
    try {
        payload = JSON.parse(request.responseText);
    } catch {
        // HTTP-specific fallbacks below also cover non-JSON proxy responses.
    }
    const validationError = firstValidationError(payload.errors);
    if (validationError) return new Error(validationError);
    if (typeof payload.message === 'string' && payload.message.trim() !== '') {
        return new Error(payload.message);
    }
    if (request.status === 413) return new Error('The upload is larger than the server request limit.');
    if (request.status === 419) return new Error('Your session expired. Refresh the page and upload the file again.');
    if (request.status === 422) return new Error('The server rejected the file. Check its size and upload requirements.');
    if (request.status >= 500) return new Error(`The server failed while storing the file (HTTP ${request.status}).`);
    if (request.status > 0) return new Error(`The upload failed with HTTP status ${request.status}.`);
    return new Error('The upload could not reach the server. Check your connection and try again.');
}

export default class ProxyMediaUploadAdapter implements MediaUploadAdapter {
    upload({ files, location, onProgress }: MediaUploadRequest): Promise<MediaAsset[]> {
        const body = new FormData();
        files.forEach(file => body.append('files[]', file));
        Object.entries(location).forEach(([key, value]) => {
            if (value !== null && value !== undefined) body.append(key, String(value));
        });

        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('POST', '/media-library/files');
            Object.entries(csrfHeaders()).forEach(([name, value]) => request.setRequestHeader(name, value));
            request.upload.onprogress = event => {
                if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
            };
            request.onerror = () => reject(uploadRequestError(request));
            request.onabort = () => reject(new Error('The upload was cancelled.'));
            request.onload = () => {
                let payload: { media?: MediaAsset[] } = {};
                try {
                    payload = JSON.parse(request.responseText);
                } catch {
                    // uploadRequestError provides an HTTP-specific fallback.
                }
                if (request.status >= 200 && request.status < 300 && payload.media) {
                    resolve(payload.media);
                } else {
                    reject(uploadRequestError(request));
                }
            };
            request.send(body);
        });
    }
}
