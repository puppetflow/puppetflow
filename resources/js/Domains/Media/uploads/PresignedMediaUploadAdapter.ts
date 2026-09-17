import type { MediaAsset } from '@/Domains/Media/types';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import { laravelErrorMessage } from '@/Shared/Utils/laravelValidation';
import type { MediaUploadAdapter, MediaUploadRequest } from './types';
import SparkMD5 from 'spark-md5';

interface UploadInstruction {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
}

interface InitiateResponse {
    reservation_id: string;
    uploads: UploadInstruction[];
}

async function fileChecksums(file: File, includeMd5: boolean): Promise<{
    checksum_sha256: string;
    checksum_md5?: string;
}> {
    const contents = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', contents);

    return {
        checksum_sha256: Array.from(
            new Uint8Array(digest),
            byte => byte.toString(16).padStart(2, '0'),
        ).join(''),
        ...(includeMd5 ? { checksum_md5: SparkMD5.ArrayBuffer.hash(contents) } : {}),
    };
}

async function backendError(response: Response, fallback: string): Promise<Error> {
    const payload: unknown = await response.json().catch(() => null);

    return new Error(laravelErrorMessage(payload) ?? fallback);
}

function putObject(
    instruction: UploadInstruction,
    file: File,
    index: number,
    loaded: number[],
    totalBytes: number,
    requests: Set<XMLHttpRequest>,
    onProgress?: (percentage: number) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        requests.add(request);
        request.open(instruction.method, instruction.url);
        Object.entries(instruction.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
        request.upload.onprogress = event => {
            loaded[index] = event.loaded;
            const uploadedBytes = loaded.reduce((sum, bytes) => sum + bytes, 0);
            onProgress?.(totalBytes === 0 ? 100 : Math.round((uploadedBytes / totalBytes) * 95));
        };
        request.onerror = () => reject(new Error(
            `The direct upload of ${file.name} could not reach cloud storage. Check the bucket CORS policy.`,
        ));
        request.onabort = () => {
            requests.delete(request);
            reject(new Error('The upload was cancelled.'));
        };
        request.onload = () => {
            requests.delete(request);
            if (request.status >= 200 && request.status < 300) {
                loaded[index] = file.size;
                resolve();
            } else {
                reject(new Error(`Cloud storage rejected ${file.name} with HTTP status ${request.status}.`));
            }
        };
        request.send(file);
    });
}

async function completeReservation(reservationId: string): Promise<MediaAsset[]> {
    let lastError = new Error('The direct upload could not be finalized.');
    for (let attempt = 0; attempt < 2; attempt += 1) {
        let response: Response;
        try {
            response = await fetch(`/media-library/uploads/${reservationId}/complete`, {
                method: 'POST',
                headers: csrfHeaders(),
            });
        } catch (exception) {
            lastError = exception instanceof Error ? exception : lastError;
            continue;
        }
        if (!response.ok) {
            const error = await backendError(response, lastError.message);
            if (response.status < 500) throw error;
            lastError = error;
            continue;
        }
        try {
            const payload = await response.json() as { media?: MediaAsset[] };
            if (payload.media) return payload.media;
            lastError = new Error('The server returned an invalid media upload response.');
        } catch (exception) {
            lastError = exception instanceof Error ? exception : lastError;
        }
    }

    throw lastError;
}

export default class PresignedMediaUploadAdapter implements MediaUploadAdapter {
    async upload({
        files,
        location,
        checksumAlgorithm,
        onProgress,
    }: MediaUploadRequest): Promise<MediaAsset[]> {
        onProgress?.(0);
        const descriptors = [];
        for (const file of files) {
            const checksums = await fileChecksums(file, checksumAlgorithm === 'md5');
            descriptors.push({
                name: file.name,
                size: file.size,
                mime_type: file.type || 'application/octet-stream',
                ...checksums,
            });
        }
        const initiateResponse = await fetch('/media-library/uploads', {
            method: 'POST',
            headers: {
                ...csrfHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: descriptors, ...location }),
        });
        if (!initiateResponse.ok) {
            throw await backendError(initiateResponse, 'The direct upload could not be initialized.');
        }
        const initiated = await initiateResponse.json() as InitiateResponse;
        if (!initiated.reservation_id || initiated.uploads.length !== files.length) {
            throw new Error('The server returned an invalid direct upload contract.');
        }

        const requests = new Set<XMLHttpRequest>();
        const loaded = files.map(() => 0);
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        try {
            await Promise.all(initiated.uploads.map((instruction, index) => putObject(
                instruction,
                files[index],
                index,
                loaded,
                totalBytes,
                requests,
                onProgress,
            )));
            onProgress?.(96);
            const media = await completeReservation(initiated.reservation_id);
            onProgress?.(100);

            return media;
        } catch (exception) {
            requests.forEach(request => request.abort());
            await fetch(`/media-library/uploads/${initiated.reservation_id}`, {
                method: 'DELETE',
                headers: csrfHeaders(),
            }).catch(() => null);
            throw exception;
        }
    }
}
