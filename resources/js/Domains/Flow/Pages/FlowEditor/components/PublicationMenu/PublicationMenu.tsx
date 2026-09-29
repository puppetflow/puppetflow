import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { DraftSaveStatus } from '../../hooks/useFlowPersistence';
import * as S from './styled';

interface PublicationMenuProps {
    isPublished: boolean;
    publishedVersion: number | null;
    /** The saved draft differs from the published version. */
    hasUnpublishedChanges?: boolean;
    saveStatus: DraftSaveStatus;
    disabled?: boolean;
    draftEditable?: boolean;
    publicationEditable?: boolean;
    savingPublication?: boolean;
    onSaveDraft: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onViewTimeline: () => void;
}

export default function PublicationMenu({
    isPublished,
    publishedVersion,
    hasUnpublishedChanges = false,
    saveStatus,
    disabled = false,
    draftEditable = true,
    publicationEditable = true,
    savingPublication = false,
    onSaveDraft,
    onPublish,
    onUnpublish,
    onViewTimeline,
}: PublicationMenuProps) {
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const busy = saveStatus === 'saving' || savingPublication;
    const error = saveStatus === 'error' || saveStatus === 'conflict';
    // Only meaningful once the draft is persisted: unsaved edits already have their own label.
    const outOfSync = isPublished && hasUnpublishedChanges && saveStatus === 'saved';
    const label = saveStatus === 'saving'
        ? 'Draft saving...'
        : saveStatus === 'error'
            ? 'Draft save failed'
            : saveStatus === 'conflict'
                ? 'Draft conflict'
                : saveStatus === 'unsaved'
                    ? 'Unsaved changes'
                    : isPublished && publishedVersion
                        ? `Published v${publishedVersion}`
                        : 'Draft saved';

    useEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;
            setMenuPosition({
                top: rect.bottom + 6,
                left: Math.max(8, rect.right - 210),
            });
        };
        const close = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                !wrapperRef.current?.contains(target)
                && !menuRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };
        updatePosition();
        document.addEventListener('mousedown', close);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

    const run = (action: () => void) => {
        setOpen(false);
        action();
    };

    return (
        <S.Wrapper ref={wrapperRef}>
            <S.Trigger
                type="button"
                $error={error}
                disabled={disabled}
                aria-busy={savingPublication}
                title={outOfSync ? 'The saved draft differs from the published version' : undefined}
                onClick={() => setOpen(value => !value)}
            >
                <S.TriggerContent $hidden={savingPublication}>
                    <Icon icon={error ? 'lucide:triangle-alert' : isPublished ? 'lucide:badge-check' : 'lucide:file-pen'} />
                    {label}
                    {outOfSync && <S.OutOfSyncDot aria-label="Unpublished changes" />}
                    {!disabled && <Icon icon="lucide:chevron-down" />}
                </S.TriggerContent>
                {savingPublication && <S.Spinner aria-label="Publishing" />}
            </S.Trigger>
            {open && !disabled && createPortal(
                <S.Menu ref={menuRef} style={menuPosition}>
                    {outOfSync && (
                        <>
                            <S.StatusItem role="status">
                                <Icon icon="lucide:git-compare-arrows" width={14} height={14} />
                                <S.StatusText>
                                    Draft differs from v{publishedVersion}
                                    <small>Runs keep using the published version until you publish again.</small>
                                </S.StatusText>
                            </S.StatusItem>
                            <S.Divider />
                        </>
                    )}
                    <S.MenuItem type="button" onClick={() => run(onViewTimeline)}>
                        <Icon icon="lucide:history" />
                        View timeline
                    </S.MenuItem>
                    {publicationEditable && onPublish && (
                        <>
                            <S.Divider />
                            <S.MenuItem type="button" disabled={busy} onClick={() => run(onPublish)}>
                                <Icon icon="lucide:upload" />
                                Publish as new version
                            </S.MenuItem>
                            <S.MenuItem
                                type="button"
                                disabled={busy || !draftEditable || saveStatus === 'saved'}
                                onClick={() => run(onSaveDraft)}
                            >
                                <Icon icon="lucide:save" />
                                Save draft
                            </S.MenuItem>
                            {isPublished && onUnpublish && (
                                <>
                                    <S.Divider />
                                    <S.MenuItem type="button" $danger disabled={busy} onClick={() => run(onUnpublish)}>
                                        <Icon icon="lucide:circle-off" />
                                        Unpublish
                                    </S.MenuItem>
                                </>
                            )}
                        </>
                    )}
                </S.Menu>,
                document.body,
            )}
        </S.Wrapper>
    );
}
