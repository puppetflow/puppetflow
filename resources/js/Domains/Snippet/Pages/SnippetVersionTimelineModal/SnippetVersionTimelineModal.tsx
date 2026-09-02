import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { Flow } from '@/Domains/Flow/types';
import type { Snippet, SnippetType } from '@/Domains/Snippet/types';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { useConfirm } from '@/Shared/Hooks/useConfirm';
import Modal from '@/Shared/UI/Modal/Modal';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import { formatDateTime } from '@/Shared/Utils/formatDate';
import type { Id } from '@/Shared/types';
import NodalEditorPane from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodalEditorPane';
import { normalizeNodalFunctionGraph } from '@/Domains/Flow/Pages/FlowEditor/nodalCompiler';
import { buildLibraryCompliantCode, buildLibraryCompliantNodalSnippet } from '@/Domains/Library/Utils/libraryCodeExport';
import CodeSnapshotEditor from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/CodePane/components/CodeSnapshotEditor/CodeSnapshotEditor';
import NodalSnapshotFrame from '@/Domains/Flow/Pages/FlowEditor/Modals/RunDetailModal/CodePane/components/NodalSnapshotFrame/NodalSnapshotFrame';
import { downloadTextFile, getDownloadBaseName } from '../utils';
import * as S from '@/Domains/Flow/Pages/FlowEditor/Modals/VersionTimelineModal/styled';

interface VersionMetadata {
    id: number;
    version: number;
    snippet_type: SnippetType;
    published_at: string;
    publisher: { id: Id; name: string } | null;
}

interface VersionDetail extends VersionMetadata {
    args: string | null;
    code: string | null;
    nodal_graph: Snippet['nodal_graph'];
}

interface Props {
    snippet: Snippet;
    canEdit: boolean;
    isOpen: boolean;
    initialVersionId?: number | null;
    getDraftUpdatedAt: () => string | null;
    onClose: () => void;
    onRestored: () => void;
    onVersionPublished: (snippetId: Id, versionId: number, version: number) => void;
}

const ignoreGraphChange = () => {};
const formatPublishedAt = (value: string) => formatDateTime(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function SnippetVersionTimelineModal({
    snippet,
    canEdit,
    isOpen,
    initialVersionId = null,
    getDraftUpdatedAt,
    onClose,
    onRestored,
    onVersionPublished,
}: Props) {
    const { resolved } = useThemeMode();
    const { confirm, ConfirmModal } = useConfirm();
    const [versions, setVersions] = useState<VersionMetadata[]>([]);
    const [currentVersionId, setCurrentVersionId] = useState<number | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [detail, setDetail] = useState<VersionDetail | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [versionAction, setVersionAction] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) setOpenMenuId(null);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const controller = new AbortController();
        setLoadingList(true);
        setError(null);
        setVersions([]);
        setCurrentVersionId(null);
        setSelectedVersionId(null);
        setDetail(null);

        void fetch(`/snippets/${snippet.id}/versions`, {
            headers: csrfHeaders(),
            signal: controller.signal,
        }).then(async response => {
            if (!response.ok) throw new Error('Unable to load version history.');
            return response.json() as Promise<{
                current_version_id: number | null;
                versions: VersionMetadata[];
            }>;
        }).then(result => {
            setVersions(result.versions);
            setCurrentVersionId(result.current_version_id);
            const requestedVersionExists = result.versions.some(version => version.id === initialVersionId);
            setSelectedVersionId(
                requestedVersionExists
                    ? initialVersionId
                    : result.current_version_id ?? result.versions[0]?.id ?? null,
            );
        }).catch(fetchError => {
            if (!controller.signal.aborted) {
                setError(fetchError instanceof Error ? fetchError.message : 'Unable to load version history.');
            }
        }).finally(() => {
            if (!controller.signal.aborted) setLoadingList(false);
        });

        return () => controller.abort();
    }, [initialVersionId, isOpen, snippet.id]);

    useEffect(() => {
        if (!isOpen || selectedVersionId === null) return;
        const controller = new AbortController();
        setLoadingDetail(true);
        setError(null);
        setDetail(null);

        void fetch(`/snippets/${snippet.id}/versions/${selectedVersionId}`, {
            headers: csrfHeaders(),
            signal: controller.signal,
        }).then(async response => {
            if (!response.ok) throw new Error('Unable to load this version.');
            return response.json() as Promise<VersionDetail>;
        }).then(setDetail).catch(fetchError => {
            if (!controller.signal.aborted) {
                setError(fetchError instanceof Error ? fetchError.message : 'Unable to load this version.');
            }
        }).finally(() => {
            if (!controller.signal.aborted) setLoadingDetail(false);
        });

        return () => controller.abort();
    }, [isOpen, selectedVersionId, snippet.id]);

    useEffect(() => {
        if (openMenuId === null) return;
        const close = (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest('[data-version-menu]')) return;
            setOpenMenuId(null);
        };
        const closeOnViewportChange = () => setOpenMenuId(null);
        document.addEventListener('mousedown', close);
        window.addEventListener('resize', closeOnViewportChange);
        window.addEventListener('scroll', closeOnViewportChange, true);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('resize', closeOnViewportChange);
            window.removeEventListener('scroll', closeOnViewportChange, true);
        };
    }, [openMenuId]);

    const selectedMetadata = versions.find(version => version.id === selectedVersionId);
    const openMenuVersion = versions.find(version => version.id === openMenuId) ?? null;
    const functionArguments = useMemo(
        () => (detail?.args ?? '').split(',').map(argument => argument.trim()).filter(Boolean),
        [detail?.args],
    );
    const previewFlow = useMemo(() => ({
        id: snippet.id,
        name: String(snippet.id),
        default_inputs: Object.fromEntries(functionArguments.map(argument => [argument, undefined])),
        latest_run: null,
        viewport_width: 1280,
        viewport_height: 720,
        keyboard_speed: 100,
        flow_type: 'nodal',
        nodal_graph: detail?.nodal_graph,
    } as Flow), [detail?.nodal_graph, functionArguments, snippet.id]);

    const loadVersion = async (versionId: number) => {
        const response = await fetch(`/snippets/${snippet.id}/versions/${versionId}`, {
            headers: csrfHeaders(),
        });
        if (!response.ok) throw new Error('Unable to load this version.');
        return response.json() as Promise<VersionDetail>;
    };

    const restoreVersion = async (version: VersionMetadata) => {
        setOpenMenuId(null);
        if (!await confirm({
            title: `Restore version ${version.version}?`,
            message: 'This version will replace the current draft. The published version will not change.',
            confirmLabel: 'Restore version',
            variant: 'danger',
        })) return;

        setVersionAction(`restore:${version.id}`);
        setError(null);
        try {
            const response = await fetch(`/snippets/${snippet.id}/versions/${version.id}/restore`, {
                method: 'POST',
                headers: {
                    ...csrfHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ client_updated_at: getDraftUpdatedAt() }),
            });
            if (!response.ok) {
                const result = await response.json().catch(() => null) as
                    { errors?: Record<string, string[]> } | null;
                const conflictMessage = result?.errors ? Object.values(result.errors).flat()[0] : null;
                throw new Error(conflictMessage ?? 'Unable to restore this version.');
            }
            onRestored();
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Unable to restore this version.');
        } finally {
            setVersionAction(null);
        }
    };

    const publishVersion = async (version: VersionMetadata) => {
        setOpenMenuId(null);
        if (!await confirm({
            title: `Publish version ${version.version}?`,
            message: 'Snippet executions will use this historical version. Your current draft will not change.',
            confirmLabel: 'Publish version',
            variant: 'primary',
        })) return;

        setVersionAction(`publish:${version.id}`);
        setError(null);
        try {
            const response = await fetch(`/snippets/${snippet.id}/versions/${version.id}/publish`, {
                method: 'POST',
                headers: csrfHeaders(),
            });
            if (!response.ok) throw new Error('Unable to publish this version.');
            setCurrentVersionId(version.id);
            onVersionPublished(snippet.id, version.id, version.version);
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Unable to publish this version.');
        } finally {
            setVersionAction(null);
        }
    };

    const downloadVersion = async (version: VersionMetadata) => {
        setOpenMenuId(null);
        setVersionAction(`download:${version.id}`);
        setError(null);
        try {
            const snapshot = detail?.id === version.id ? detail : await loadVersion(version.id);
            const isNodal = snapshot.snippet_type === 'nodal';
            const content = isNodal
                ? buildLibraryCompliantNodalSnippet({
                    title: `${snippet.label} v${version.version}`,
                    description: snippet.description ?? '',
                    args: snapshot.args ?? '',
                    graph: normalizeNodalFunctionGraph(snapshot.nodal_graph),
                })
                : buildLibraryCompliantCode({
                    title: `${snippet.label} v${version.version}`,
                    description: snippet.description ?? '',
                    args: snapshot.args ?? '',
                    code: snapshot.code ?? '',
                });
            downloadTextFile(
                `${getDownloadBaseName(snippet.label)}-v${version.version}.${isNodal ? 'json' : 'js'}`,
                content,
                isNodal ? 'application/json;charset=utf-8' : 'text/javascript;charset=utf-8',
            );
        } catch {
            setError('Unable to download this version.');
        } finally {
            setVersionAction(null);
        }
    };

    const openVersionInNewTab = (version: VersionMetadata) => {
        setOpenMenuId(null);
        const url = new URL('/snippets', window.location.origin);
        url.searchParams.set('s', String(snippet.id));
        url.searchParams.set('version', String(version.id));
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                fullScreen
                title={<S.Title><Icon icon="lucide:history" />Version timeline</S.Title>}
                caption={selectedMetadata
                    ? `${snippet.label} - Version ${selectedMetadata.version}`
                    : snippet.label}
            >
                <S.Layout>
                    <S.Preview>
                        {loadingDetail && !detail ? (
                            <S.State>Loading version...</S.State>
                        ) : error ? (
                            <S.State>{error}</S.State>
                        ) : detail ? (
                            <S.PreviewContent>
                                {detail.snippet_type === 'nodal' && detail.nodal_graph ? (
                                    <NodalSnapshotFrame>
                                        <NodalEditorPane
                                            key={detail.id}
                                            flow={previewFlow}
                                            graph={normalizeNodalFunctionGraph(detail.nodal_graph)}
                                            graphContext="function"
                                            functionArguments={functionArguments}
                                            documentExtension="snippet.json"
                                            saved
                                            readOnly
                                            allowShortcutsInModal
                                            onGraphChange={ignoreGraphChange}
                                        />
                                    </NodalSnapshotFrame>
                                ) : (
                                    <CodeSnapshotEditor
                                        code={detail.code ?? ''}
                                        resolvedTheme={resolved}
                                        activeLine={null}
                                        passedLines={[]}
                                    />
                                )}
                            </S.PreviewContent>
                        ) : (
                            <S.State>Select a published version.</S.State>
                        )}
                    </S.Preview>

                    <S.Sidebar>
                        <S.SidebarHeader>
                            <S.SidebarTitle>Published versions</S.SidebarTitle>
                            <S.SidebarCaption>{versions.length} version{versions.length === 1 ? '' : 's'}</S.SidebarCaption>
                        </S.SidebarHeader>
                        <S.Timeline>
                            {loadingList ? (
                                <S.State>Loading timeline...</S.State>
                            ) : versions.length === 0 ? (
                                <S.State>No published version yet.</S.State>
                            ) : versions.map(version => {
                                const current = version.id === currentVersionId;
                                return (
                                    <S.VersionRow key={version.id}>
                                        <S.VersionButton
                                            type="button"
                                            $active={version.id === selectedVersionId}
                                            onClick={() => setSelectedVersionId(version.id)}
                                        >
                                            <S.TimelineMarker $current={current} />
                                            <S.VersionBody>
                                                <S.VersionHeading>
                                                    <S.VersionName>Version {version.version}</S.VersionName>
                                                    {current && <S.CurrentBadge>Current</S.CurrentBadge>}
                                                </S.VersionHeading>
                                                <S.VersionMeta>
                                                    {formatPublishedAt(version.published_at)}
                                                    {' - '}
                                                    {version.publisher?.name ?? 'System'}
                                                </S.VersionMeta>
                                            </S.VersionBody>
                                        </S.VersionButton>
                                        <S.VersionActions data-version-menu>
                                            <S.VersionMenuButton
                                                type="button"
                                                $open={openMenuId === version.id}
                                                aria-label={`Actions for version ${version.version}`}
                                                onClick={event => {
                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                    const menuHeight = canEdit ? 150 : 82;
                                                    setMenuPosition({
                                                        top: rect.bottom + menuHeight > window.innerHeight
                                                            ? rect.top - menuHeight - 4
                                                            : rect.bottom + 4,
                                                        left: Math.max(8, rect.right - 190),
                                                    });
                                                    setOpenMenuId(value => value === version.id ? null : version.id);
                                                }}
                                            >
                                                <Icon icon="lucide:ellipsis" />
                                            </S.VersionMenuButton>
                                        </S.VersionActions>
                                    </S.VersionRow>
                                );
                            })}
                        </S.Timeline>
                    </S.Sidebar>
                </S.Layout>
            </Modal>
            {openMenuVersion && createPortal(
                <S.VersionMenu data-version-menu style={menuPosition}>
                    {canEdit && (
                        <>
                            <S.VersionMenuItem
                                type="button"
                                disabled={versionAction !== null || snippet.library_locked}
                                onClick={() => void restoreVersion(openMenuVersion)}
                            >
                                <Icon icon="lucide:rotate-ccw" />
                                Restore version
                            </S.VersionMenuItem>
                            <S.VersionMenuItem
                                type="button"
                                disabled={versionAction !== null || openMenuVersion.id === currentVersionId}
                                onClick={() => void publishVersion(openMenuVersion)}
                            >
                                <Icon icon="lucide:upload" />
                                Publish version
                            </S.VersionMenuItem>
                        </>
                    )}
                    <S.VersionMenuItem
                        type="button"
                        disabled={versionAction !== null}
                        onClick={() => openVersionInNewTab(openMenuVersion)}
                    >
                        <Icon icon="lucide:external-link" />
                        Open in new tab
                    </S.VersionMenuItem>
                    <S.VersionMenuItem
                        type="button"
                        disabled={versionAction !== null}
                        onClick={() => void downloadVersion(openMenuVersion)}
                    >
                        <Icon icon="lucide:download" />
                        Download
                    </S.VersionMenuItem>
                </S.VersionMenu>,
                document.body,
            )}
            <ConfirmModal />
        </>
    );
}
