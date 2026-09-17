import { useState } from 'react';
import { usePageProps } from '@/App/Hooks/usePageProps';
import Modal from '@/Shared/UI/Modal/Modal';
import FileDropZone from '@/Shared/UI/FileDropZone/FileDropZone';
import { uploadMedia } from '@/Domains/Media/uploadMedia';
import type { MediaAsset } from '@/Domains/Media/types';
import { ProgressFill, ProgressTrack } from '@/Shared/UI/FileDropZone/styled';
import { Error as ErrorText } from '@/Shared/UI/Input/shared.styled';

interface Props {
    zIndex?: number;
    onClose: () => void;
    onUploaded: (asset: MediaAsset) => void;
}

/** Uploads a single file to the personal media root as soon as it is picked. */
export default function MediaUploadModal({ zIndex, onClose, onUploaded }: Props) {
    const { settings } = usePageProps();
    const [uploading, setUploading] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const upload = async ([file]: File[]) => {
        if (!file) return;
        setError(null);
        setProgress(0);
        if (file.size > settings.media_upload.max_file_bytes) {
            const limitMb = Math.ceil(settings.media_upload.max_file_bytes / 1024 / 1024);
            setError(`The file must be no larger than ${limitMb} MB.`);
            return;
        }
        setUploading(file);
        try {
            const [asset] = await uploadMedia(
                [file],
                setProgress,
                {},
                settings.media_upload.transport,
                settings.media_upload.checksum_algorithm,
            );
            onUploaded(asset);
        } catch (exception) {
            setError(exception instanceof Error ? exception.message : 'The upload could not be completed.');
            setUploading(null);
        }
    };

    return (
        <Modal
            isOpen
            title="Add a media"
            caption="The file is stored in your personal media library."
            width="480px"
            zIndex={zIndex}
            modalKind="media-upload"
            onClose={() => {
                if (!uploading) onClose();
            }}
        >
            <FileDropZone
                title={uploading ? `Uploading ${uploading.name}...` : 'Drop a file here or click to browse'}
                hint={uploading ? `${progress}%` : 'Images, videos, documents or any other file.'}
                disabled={Boolean(uploading)}
                hasError={Boolean(error)}
                onFiles={files => void upload(files)}
            />
            {uploading && (
                <ProgressTrack style={{ marginTop: 10 }}>
                    <ProgressFill $progress={progress} />
                </ProgressTrack>
            )}
            {error && <ErrorText>{error}</ErrorText>}
        </Modal>
    );
}
