import PresignedMediaUploadAdapter from './PresignedMediaUploadAdapter';
import ProxyMediaUploadAdapter from './ProxyMediaUploadAdapter';
import type { MediaUploadAdapter, MediaUploadTransport } from './types';

const proxyAdapter = new ProxyMediaUploadAdapter();
const presignedAdapter = new PresignedMediaUploadAdapter();

export function createMediaUploadAdapter(transport: MediaUploadTransport): MediaUploadAdapter {
    return transport === 'presigned' ? presignedAdapter : proxyAdapter;
}
