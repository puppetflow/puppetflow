import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useToast } from '@/App/Hooks/useToast';
import { usePageProps } from '@/App/Hooks/usePageProps';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Explorer from '@/Shared/Explorer/Explorer';
import NewFolderButton from '@/Shared/Explorer/NewFolderButton';
import * as ExplorerS from '@/Shared/Explorer/styled';
import { getLocationUrl, isExplorerDrag } from '@/Shared/Explorer/ExplorerContent/utils';
import { useGlobalDragReset } from '@/Shared/Explorer/useGlobalDragReset';
import MediaMetadataModal, {
    type MediaMetadataPayload,
} from '@/Domains/Media/Components/MediaMetadataModal/MediaMetadataModal';
import type { MediaAsset, MediaLibraryProps, MediaTreeItem } from '@/Domains/Media/types';
import { uploadMedia } from '@/Domains/Media/uploadMedia';
import { mediaExplorerConfig } from './mediaExplorerConfig';
import { MediaInspectorContext, useMediaInspector, type MediaInspectorActions } from './mediaInspectorContext';
import * as S from './styled';

const MEDIA_QUERY_PARAM = 'media';

function MediaLibraryHeader({ uploading }: { uploading: boolean }) {
    const { openUploadDialog } = useMediaInspector();

    return (
        <ExplorerS.HeaderActions>
            <NewFolderButton />
            <Button size="sm" loading={uploading} onClick={openUploadDialog}>
                <Icon icon="lucide:upload" width={14} />
                <ExplorerS.BtnLabel>Upload</ExplorerS.BtnLabel>
            </Button>
        </ExplorerS.HeaderActions>
    );
}

/** Upload payload describing the current explorer location (folder, team, workspace or owner). */
function uploadLocation(props: MediaLibraryProps): Record<string, Id | string | null> {
    const { currentFolder, filters } = props;
    if (currentFolder) return { folder_id: currentFolder.id };
    if (filters.view === 'workspace') {
        return filters.team_id
            ? { visibility: 'team', team_id: filters.team_id }
            : { visibility: 'workspace' };
    }
    return filters.owner_id ? { owner_id: filters.owner_id } : {};
}

function itemUrl(basePath: string, item: MediaTreeItem, activeTag: string | null): string {
    const isShared = item.visibility !== 'owner';
    const base = getLocationUrl(basePath, item.folder_id, {
        view: isShared ? 'workspace' : null,
        owner_id: item.visibility === 'owner' ? item.owner_id : null,
        team_id: item.visibility === 'team' ? item.team_id : null,
        persistent_filters: activeTag ? { tag: activeTag } : {},
    });
    return `${base}${base.includes('?') ? '&' : '?'}${MEDIA_QUERY_PARAM}=${item.id}`;
}

export default function MediaLibrary(props: MediaLibraryProps) {
    const { inspectingItem: deepLinkedItem, items, maxUploadSize } = props;
    const { toast } = useToast();
    const { settings } = usePageProps();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);
    const uploadInFlightRef = useRef(false);
    const [inspectingId, setInspectingId] = useState<Id | null>(
        () => new URLSearchParams(window.location.search).get(MEDIA_QUERY_PARAM),
    );
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dropActive, setDropActive] = useState(false);
    const resetUploadDrag = useCallback(() => {
        dragDepthRef.current = 0;
        setDropActive(false);
    }, []);
    useGlobalDragReset(resetUploadDrag);

    const inspectingItem = useMemo(
        () => (String(deepLinkedItem?.id ?? '') === String(inspectingId ?? '') ? deepLinkedItem : null)
            ?? items.data.find(item => String(item.id) === String(inspectingId ?? ''))
            ?? null,
        [deepLinkedItem, items.data, inspectingId],
    );

    useEffect(() => {
        if (deepLinkedItem) setInspectingId(deepLinkedItem.id);
    }, [deepLinkedItem]);

    useEffect(() => {
        // Drop the deep link once the modal has been opened so a reload does not reopen it.
        if (inspectingId === null) return;
        const url = new URL(window.location.href);
        if (url.searchParams.has(MEDIA_QUERY_PARAM)) {
            url.searchParams.delete(MEDIA_QUERY_PARAM);
            window.history.replaceState(window.history.state, '', url.toString());
        }
    }, [inspectingId]);

    const uploadFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;
        if (uploadInFlightRef.current) {
            toast('Wait for the current upload to finish.', 'error');
            return;
        }
        if (files.length > settings.media_upload.max_files) {
            toast(`Upload at most ${settings.media_upload.max_files} files at a time.`, 'error');
            return;
        }
        const oversizedFile = files.find(file => file.size > maxUploadSize);
        if (oversizedFile) {
            const fileMb = (oversizedFile.size / 1024 / 1024).toFixed(1);
            const limitMb = (maxUploadSize / 1024 / 1024).toFixed(0);
            toast(`${oversizedFile.name} is ${fileMb} MB. The maximum file size is ${limitMb} MB.`, 'error');
            return;
        }
        uploadInFlightRef.current = true;
        setUploading(true);
        setUploadProgress(0);
        try {
            await uploadMedia(
                files,
                setUploadProgress,
                uploadLocation(props),
                settings.media_upload.transport,
                settings.media_upload.checksum_algorithm,
            );
            toast(`${files.length} file${files.length === 1 ? '' : 's'} uploaded.`);
            router.reload();
        } catch (exception) {
            toast(
                exception instanceof Error
                    ? exception.message
                    : 'The upload failed for an unknown reason.',
                'error',
            );
        } finally {
            uploadInFlightRef.current = false;
            setUploading(false);
            setUploadProgress(0);
        }
    }, [
        maxUploadSize,
        props,
        settings.media_upload.checksum_algorithm,
        settings.media_upload.max_files,
        settings.media_upload.transport,
        toast,
    ]);

    const inspectorActions = useMemo<MediaInspectorActions>(() => ({
        inspect: item => router.visit(itemUrl(mediaExplorerConfig.basePath, item, props.activeTag)),
        openUploadDialog: () => fileInputRef.current?.click(),
    }), [props.activeTag]);

    /** Runs a mutation on the inspected item, closing the modal on success. */
    const mutateInspected = (run: (options: Parameters<typeof router.patch>[2]) => void, success: string, failure: string) => {
        setSaving(true);
        run({
            preserveScroll: true,
            onSuccess: () => {
                setInspectingId(null);
                toast(success);
            },
            onError: () => toast(failure, 'error'),
            onFinish: () => setSaving(false),
        });
    };

    const saveMetadata = (item: MediaAsset, payload: MediaMetadataPayload) => mutateInspected(
        options => router.patch(`/media-library/media/${item.id}`, { ...payload }, options),
        'Media details updated.',
        'The media details could not be saved.',
    );

    const deleteMedia = (item: MediaAsset) => mutateInspected(
        options => router.delete(`/media-library/media/${item.id}`, options),
        'Media deleted.',
        'The media could not be deleted.',
    );

    // Only OS file drags open the upload overlay; explorer items (which may carry a
    // thumbnail image, hence "Files") are handled by the folder drop targets.
    const isFileDrag = (event: React.DragEvent) => !uploading
        && event.dataTransfer.types.includes('Files')
        && !isExplorerDrag(event);

    const renderContent = (content: React.ReactNode) => (
        <S.DropZone
            onDragEnter={event => {
                if (isFileDrag(event)) {
                    dragDepthRef.current += 1;
                    setDropActive(true);
                }
            }}
            onDragLeave={event => {
                if (!isFileDrag(event)) return;
                dragDepthRef.current -= 1;
                if (dragDepthRef.current <= 0) {
                    dragDepthRef.current = 0;
                    setDropActive(false);
                }
            }}
            onDragOver={event => {
                if (isFileDrag(event)) event.preventDefault();
            }}
            onDrop={event => {
                dragDepthRef.current = 0;
                setDropActive(false);
                if (isFileDrag(event) && event.dataTransfer.files.length > 0) {
                    event.preventDefault();
                    event.stopPropagation();
                    uploadFiles(Array.from(event.dataTransfer.files));
                }
            }}
        >
            {content}
            {dropActive && (
                <S.DropOverlay>
                    <S.DropTarget>
                        <Icon icon="lucide:upload-cloud" width={34} />
                        <S.DropTitle>Upload here</S.DropTitle>
                        <S.DropText>Release to add files to the current location.</S.DropText>
                    </S.DropTarget>
                </S.DropOverlay>
            )}
            {uploading && (
                <S.UploadProgress role="status">
                    <S.UploadProgressHeader>
                        <S.UploadProgressLabel>Uploading files</S.UploadProgressLabel>
                        <S.UploadProgressValue>{Math.round(uploadProgress)}%</S.UploadProgressValue>
                    </S.UploadProgressHeader>
                    <S.ProgressTrack><S.ProgressFill $progress={uploadProgress} /></S.ProgressTrack>
                </S.UploadProgress>
            )}
        </S.DropZone>
    );
    const tagOptions = props.activeTag && !props.tagSuggestions.includes(props.activeTag)
        ? [props.activeTag, ...props.tagSuggestions]
        : props.tagSuggestions;

    return (
        <MediaInspectorContext.Provider value={inspectorActions}>
            <Explorer
                config={mediaExplorerConfig}
                data={props}
                toolbarFilters={[{
                    key: 'tag',
                    label: 'Filter by tag',
                    value: props.activeTag ?? '',
                    options: [
                        { value: '', label: 'All tags' },
                        ...tagOptions.map(tag => ({ value: tag, label: tag })),
                    ],
                }]}
                headerActions={(
                    <MediaLibraryHeader uploading={uploading} />
                )}
                renderContent={renderContent}
            >
                <S.HiddenFileInput
                    ref={fileInputRef}
                    type="file"
                    multiple
                    disabled={uploading}
                    onChange={event => {
                        uploadFiles(Array.from(event.target.files ?? []));
                        event.target.value = '';
                    }}
                />
                <MediaMetadataModal
                    item={inspectingItem}
                    tagSuggestions={props.tagSuggestions}
                    saving={saving}
                    onClose={() => setInspectingId(null)}
                    onSave={saveMetadata}
                    onDelete={deleteMedia}
                />
            </Explorer>
        </MediaInspectorContext.Provider>
    );
}
