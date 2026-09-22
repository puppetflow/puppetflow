import { useEffect, useRef } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { getNodeCategoryColor, getNodeIcon } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/catalog';
import { getHelpEntryDocumentationPath } from '@/Domains/Flow/Pages/FlowEditor/utils/helpDocumentation';
import * as S from './styled';

interface NodeConfigHeaderProps {
    entry: HelpEntryDef;
    label: string;
    currentSiteUrl: string | null;
    readOnly?: boolean;
    snippetsRefreshing?: boolean;
    onRefreshSnippets?: () => void;
    onLabelChange: (label: string) => void;
    onCommitLabel: () => void;
    onClose: () => void;
}

export default function NodeConfigHeader({
    entry,
    label,
    currentSiteUrl,
    readOnly,
    snippetsRefreshing = false,
    onRefreshSnippets,
    onLabelChange,
    onCommitLabel,
    onClose,
}: NodeConfigHeaderProps) {
    const documentationPath = getHelpEntryDocumentationPath(entry);
    const isSnippet = entry.name.startsWith('$$');
    const refreshSnippetsRef = useRef(onRefreshSnippets);
    refreshSnippetsRef.current = onRefreshSnippets;

    // Opening a snippet node re-fetches the published signature so the version, the
    // draft badge and callArguments reflect what the snippet editor last published.
    useEffect(() => {
        if (isSnippet) {
            refreshSnippetsRef.current?.();
        }
    }, [isSnippet, entry.name]);

    return (
        <>
            <S.Header>
                <S.Title>
                    <S.TitleIcon $color={getNodeCategoryColor(entry)}>
                        <Icon icon={getNodeIcon(entry)} width={24} height={24} />
                    </S.TitleIcon>
                    <div>
                        <S.TitleInput
                            value={label}
                            disabled={readOnly}
                            aria-label="Node name"
                            onChange={event => onLabelChange(event.target.value)}
                            onBlur={onCommitLabel}
                            onKeyDown={event => {
                                event.stopPropagation();
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.currentTarget.blur();
                                }
                            }}
                        />
                        <S.CategoryRow>
                            <span>{entry.category}</span>
                            {documentationPath && (
                                <DocHelpLink
                                    className="node-config-documentation-link"
                                    path={documentationPath}
                                    label={`Open ${label} documentation`}
                                />
                            )}
                        </S.CategoryRow>
                    </div>
                </S.Title>
                <S.CloseButton type="button" onClick={onClose} title="Close">
                    <Icon icon="lucide:x" width={16} height={16} />
                </S.CloseButton>
            </S.Header>
            <S.CurrentSite
                as={currentSiteUrl ? 'a' : 'div'}
                href={currentSiteUrl ?? undefined}
                target={currentSiteUrl ? '_blank' : undefined}
                rel={currentSiteUrl ? 'noreferrer' : undefined}
                $available={Boolean(currentSiteUrl)}
            >
                <Icon icon={currentSiteUrl ? 'lucide:globe-2' : 'lucide:globe-lock'} width={14} height={14} />
                <span>Current page</span>
                <strong>{currentSiteUrl ?? 'No current page yet'}</strong>
                {currentSiteUrl && <Icon icon="lucide:external-link" width={13} height={13} />}
            </S.CurrentSite>
            {isSnippet && (
                <S.SnippetBar>
                    <S.SnippetLabel>Snippet</S.SnippetLabel>
                    {entry.snippetVersion != null && (
                        <S.SnippetVersion title="Published version used by this node">
                            v{entry.snippetVersion}
                        </S.SnippetVersion>
                    )}
                    {entry.snippetHasUnpublishedChanges && (
                        <S.SnippetDraftBadge title="The snippet has edits that are not published yet. This node keeps using the published version until they are.">
                            <Icon icon="lucide:file-pen" width={11} height={11} />
                            Unsaved Draft
                        </S.SnippetDraftBadge>
                    )}
                    <code title={entry.signature}>{entry.signature}</code>
                    <S.SnippetActions>
                        {onRefreshSnippets && (
                            <S.SnippetAction
                                type="button"
                                $spinning={snippetsRefreshing}
                                disabled={snippetsRefreshing}
                                title="Reload the published snippet signature"
                                aria-label="Reload the published snippet signature"
                                onClick={onRefreshSnippets}
                            >
                                <Icon icon="lucide:refresh-cw" width={14} height={14} />
                            </S.SnippetAction>
                        )}
                        {entry.editUrl && (
                            <S.SnippetAction
                                as="a"
                                href={entry.editUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open the snippet in a new tab"
                                aria-label="Open the snippet in a new tab"
                            >
                                <Icon icon="lucide:external-link" width={14} height={14} />
                            </S.SnippetAction>
                        )}
                    </S.SnippetActions>
                </S.SnippetBar>
            )}
        </>
    );
}
