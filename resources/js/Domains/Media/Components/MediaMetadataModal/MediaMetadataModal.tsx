import { useEffect, useRef, useState, type Ref } from 'react';
import { useAuth } from '@/App/Hooks/usePageProps';
import Button, { ButtonLink } from '@/Shared/UI/Button/Button';
import Input, { TextArea } from '@/Shared/UI/Input/Input';
import Modal from '@/Shared/UI/Modal/Modal';
import UserPicker from '@/Shared/UI/UserPicker/UserPicker';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useConfirm } from '@/Shared/Hooks/useConfirm';
import { useExplorer } from '@/Shared/Explorer/ExplorerContext';
import VisibilityPicker, { type VisibilityPickerValue } from '@proprietary/Domains/Flow/Components/VisibilityPicker/VisibilityPicker.pp';
import type { ExplorerScope } from '@/Shared/Explorer/types';
import type { MediaAsset } from '@/Domains/Media/types';
import { formatMediaSize, isEditableTextMedia } from '@/Domains/Media/types';
import MediaTagSelect from '@/Domains/Media/Components/MediaTagSelect/MediaTagSelect';
import TextMediaEditor, {
    type TextMediaEditorHandle,
    type TextMediaEditorState,
} from './TextMediaEditor';
import * as S from './styled';

interface MediaMetadataModalProps {
    item: MediaAsset | null;
    tagSuggestions: string[];
    saving: boolean;
    onClose: () => void;
    onSave: (item: MediaAsset, payload: MediaMetadataPayload) => void;
    onDelete: (item: MediaAsset) => void;
}

export interface MediaMetadataPayload {
    name: string;
    alt_text: string | null;
    description: string | null;
    tags: string[];
    folder_id: Id | null;
    visibility: ExplorerScope;
    user_id: Id;
    team_id: Id | null;
}

function pickerValueFor(item: MediaAsset): VisibilityPickerValue {
    return {
        visibility: item.visibility,
        personalFolderId: item.visibility === 'owner' ? item.folder_id : null,
        wsFolderId: item.visibility === 'workspace' ? item.folder_id : null,
        teamId: item.visibility === 'team' ? item.team_id : null,
        teamFolderId: item.visibility === 'team' ? item.folder_id : null,
    };
}

function Preview({
    item,
    editorRef,
    onEditorStateChange,
}: {
    item: MediaAsset;
    editorRef: Ref<TextMediaEditorHandle>;
    onEditorStateChange: (state: TextMediaEditorState) => void;
}) {
    const mime = item.mime_type.toLowerCase();
    if (mime.startsWith('image/')) {
        return <S.ImagePreview src={item.url} alt={item.alt_text || item.name} />;
    }
    if (mime.startsWith('video/')) {
        return <S.VideoPreview src={item.url} controls preload="metadata" />;
    }
    if (mime.startsWith('audio/')) {
        return (
            <S.AudioPreview>
                <Icon icon="lucide:audio-lines" width={54} />
                <S.AudioName>{item.name}</S.AudioName>
                <S.AudioControl src={item.url} controls preload="metadata" />
            </S.AudioPreview>
        );
    }
    if (mime === 'application/pdf') {
        return <S.PdfPreview title={`Preview of ${item.name}`} src={item.url} />;
    }
    if (isEditableTextMedia(mime, item.extension)) {
        return <TextMediaEditor ref={editorRef} item={item} onStateChange={onEditorStateChange} />;
    }
    return (
        <S.UnsupportedPreview>
            <S.UnsupportedIcon><Icon icon="lucide:file-question" width={46} /></S.UnsupportedIcon>
            <S.UnsupportedTitle>Preview unavailable</S.UnsupportedTitle>
            <S.UnsupportedText>This file type cannot be safely previewed in the browser.</S.UnsupportedText>
            <ButtonLink href={item.download_url || item.url} size="sm" download>
                <Icon icon="lucide:download" width={14} />
                Download file
            </ButtonLink>
        </S.UnsupportedPreview>
    );
}

// Full screen viewer: metadata and placement on the left, preview on the right.
export default function MediaMetadataModal({
    item,
    tagSuggestions,
    saving,
    onClose,
    onSave,
    onDelete,
}: MediaMetadataModalProps) {
    const { user } = useAuth();
    const { data } = useExplorer<MediaAsset>();
    const { confirm, ConfirmModal } = useConfirm();
    const textEditorRef = useRef<TextMediaEditorHandle>(null);
    const [name, setName] = useState('');
    const [altText, setAltText] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [ownerId, setOwnerId] = useState<Id | null>(null);
    const [textEditorState, setTextEditorState] = useState<TextMediaEditorState>({
        loading: false,
        saving: false,
        dirty: false,
    });
    const [placement, setPlacement] = useState<VisibilityPickerValue>({
        visibility: 'owner',
        personalFolderId: null,
        wsFolderId: null,
        teamId: null,
        teamFolderId: null,
    });

    useEffect(() => {
        if (!item) return;
        setName(item.name);
        setAltText(item.alt_text ?? '');
        setDescription(item.description ?? '');
        setTags(item.tags ?? []);
        setOwnerId(item.owner_id);
        setPlacement(pickerValueFor(item));
        setTextEditorState({ loading: false, saving: false, dirty: false });
    }, [item]);

    if (!item) return null;

    const ownerChanged = ownerId !== null && ownerId !== item.owner_id;
    // Personal folders must come from the selected owner's tree.
    const personalTree = ownerId === user?.id
        ? data.folderTree
        : data.userTrees.find(tree => String(tree.id) === String(ownerId ?? ''))?.tree ?? [];
    const textMode = isEditableTextMedia(item.mime_type, item.extension);
    const normalizedMime = item.mime_type.toLowerCase();
    const flushPreview = textMode
        || normalizedMime === 'application/pdf'
        || normalizedMime.startsWith('video/');
    const plainPreviewBackground = flushPreview || normalizedMime.startsWith('image/');
    const canSave = name.trim() !== ''
        && (placement.visibility !== 'team' || placement.teamId !== null)
        && !textEditorState.loading;

    const save = async () => {
        if (!canSave || ownerId === null) return;
        const contentSaved = textMode ? await textEditorRef.current?.save() ?? true : true;
        if (!contentSaved) return;
        const folderId = placement.visibility === 'owner'
            ? placement.personalFolderId
            : placement.visibility === 'workspace'
                ? placement.wsFolderId
                : placement.teamFolderId;
        onSave(item, {
            name: name.trim(),
            alt_text: altText.trim() || null,
            description: description.trim() || null,
            tags: [...new Set(tags.map(tag => tag.trim()).filter(Boolean))],
            folder_id: folderId,
            visibility: placement.visibility,
            user_id: ownerId,
            team_id: placement.visibility === 'team' ? placement.teamId : null,
        });
    };

    const remove = async () => {
        const approved = await confirm({
            title: 'Delete media',
            message: `"${item.name}" will be permanently deleted.`,
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (approved) onDelete(item);
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={item.name}
            caption={`${item.mime_type}, ${formatMediaSize(item.size_bytes)}, ${new Date(item.updated_at).toLocaleString()}`}
            fullScreen
            footer={(
                <>
                    {item.can_manage && (
                        <Button variant="danger" onClick={remove} disabled={saving}>
                            <Icon icon="lucide:trash-2" width={14} />
                            Delete
                        </Button>
                    )}
                    <ButtonLink href={item.download_url || item.url} variant="secondary" download>
                        <Icon icon="lucide:download" width={14} />
                        Download
                    </ButtonLink>
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    {item.can_manage && (
                        <Button
                            loading={saving || textEditorState.saving}
                            disabled={!canSave || textEditorState.saving}
                            onClick={() => void save()}
                        >
                            Save
                        </Button>
                    )}
                </>
            )}
        >
            <S.ModalContent>
                <S.MetadataPanel>
                    <S.PanelHeading>File details</S.PanelHeading>
                    <S.Form>
                        <Input
                            label="Display name"
                            value={name}
                            disabled={!item.can_manage}
                            onChange={event => setName(event.target.value)}
                        />
                        {item.mime_type.startsWith('image/') && (
                            <Input
                                label="Alternative text"
                                value={altText}
                                disabled={!item.can_manage}
                                onChange={event => setAltText(event.target.value)}
                                placeholder="Describe this image for accessibility"
                            />
                        )}
                        <TextArea
                            label="Description"
                            value={description}
                            disabled={!item.can_manage}
                            onChange={event => setDescription(event.target.value)}
                            rows={4}
                        />
                        <MediaTagSelect
                            value={tags}
                            suggestions={tagSuggestions}
                            disabled={!item.can_manage}
                            onChange={setTags}
                        />
                    </S.Form>

                    {item.can_manage && (
                        <>
                            <S.PanelHeading as="h4" style={{ marginTop: 24 }}>Location</S.PanelHeading>
                            <S.Form>
                                <VisibilityPicker
                                    value={placement}
                                    onChange={setPlacement}
                                    personalTree={personalTree}
                                    workspaceTree={data.workspaceTree}
                                    teamTrees={data.teamTrees}
                                    ownerId={ownerId}
                                    ownerChanged={ownerChanged && ownerId !== user?.id}
                                    folderEndpoint="/media-library/folders"
                                    resourceLabel="media file"
                                />
                                <S.Field>
                                    <S.Label>Owner</S.Label>
                                    <UserPicker
                                        value={ownerId}
                                        onChange={value => {
                                            setOwnerId(value);
                                            // The previous personal folder belongs to the old owner.
                                            setPlacement(current => ({
                                                ...current,
                                                personalFolderId: value === item.owner_id
                                                    ? (item.visibility === 'owner' ? item.folder_id : null)
                                                    : null,
                                            }));
                                        }}
                                        placeholder="Select owner..."
                                        clearable={false}
                                        disabled={!item.can_transfer_ownership}
                                    />
                                </S.Field>
                            </S.Form>
                        </>
                    )}

                    <S.TechnicalDetails>
                        <S.Detail><S.DetailLabel>Original name</S.DetailLabel><S.DetailValue>{item.original_filename}</S.DetailValue></S.Detail>
                        <S.Detail><S.DetailLabel>MIME type</S.DetailLabel><S.DetailValue>{item.mime_type}</S.DetailValue></S.Detail>
                        <S.Detail><S.DetailLabel>Reference</S.DetailLabel><S.DetailValue>{item.id}</S.DetailValue></S.Detail>
                        {item.owner && (
                            <S.Detail><S.DetailLabel>Owner</S.DetailLabel><S.DetailValue>{item.owner.name}</S.DetailValue></S.Detail>
                        )}
                    </S.TechnicalDetails>
                </S.MetadataPanel>
                <S.PreviewPanel $flush={flushPreview} $plainBackground={plainPreviewBackground}>
                    <Preview
                        item={item}
                        editorRef={textEditorRef}
                        onEditorStateChange={setTextEditorState}
                    />
                </S.PreviewPanel>
            </S.ModalContent>
            <ConfirmModal />
        </Modal>
    );
}
