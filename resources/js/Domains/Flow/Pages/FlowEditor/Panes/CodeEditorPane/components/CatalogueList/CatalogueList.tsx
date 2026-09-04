import { Icon } from '@/Shared/UI/Icon/Icon';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import { EvalButton } from '@/Shared/CodeEditor/shared/evaluation-modal.styled';
import {
    HelpDesc,
    HelpEntry,
    HelpEntryContent,
    HelpEntryActions,
    HelpEntryEditLink,
    HelpEntryIcon,
    HelpEntryRow,
    HelpEntryTop,
    HelpOptions,
    HelpSignature,
    HelpSignatureRow,
} from '@/Shared/CodeEditor/shared/help-entries.styled';
import {
    HelpEmptySearch,
    HelpPanelContent,
} from '@/Shared/CodeEditor/shared/help-toolbox.styled';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { getHelpEntryActionsWidth, getHelpEntryDocumentationPath } from '@/Domains/Flow/Pages/FlowEditor/utils/helpDocumentation';
import { formatHelpEntryLabel, getHelpCategoryColor, getHelpIcon } from '@/Domains/Flow/Pages/FlowEditor/utils/helpToolbox';

interface CatalogueListProps {
    entries: HelpEntryDef[];
    activeIndex: number;
    entryRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
    onActiveIndexChange: (index: number) => void;
    onInsert: (entry: HelpEntryDef) => void;
    onEvaluate: (entry: HelpEntryDef) => void;
}

export function CatalogueList({
    entries,
    activeIndex,
    entryRefs,
    onActiveIndexChange,
    onInsert,
    onEvaluate,
}: CatalogueListProps) {
    if (entries.length === 0) {
        return (
            <HelpPanelContent>
                <HelpEmptySearch>No matching functions.</HelpEmptySearch>
            </HelpPanelContent>
        );
    }

    return (
        <HelpPanelContent>
            {entries.map((entry, index) => {
                const entryColor = getHelpCategoryColor(entry);
                const documentationPath = getHelpEntryDocumentationPath(entry);
                const actionsWidth = getHelpEntryActionsWidth(entry, documentationPath);

                return (
                    <HelpEntryRow
                        key={`${entry.category}:${entry.name}`}
                        onMouseEnter={() => onActiveIndexChange(index)}
                    >
                        <HelpEntry
                            ref={element => {
                                entryRefs.current[index] = element;
                            }}
                            type="button"
                            $active={activeIndex === index}
                            $color={entryColor}
                            $actionsWidth={actionsWidth}
                            onClick={() => onInsert(entry)}
                        >
                            <HelpEntryIcon $color={entryColor}>
                                <Icon icon={getHelpIcon(entry)} width={14} height={14} />
                            </HelpEntryIcon>
                            <HelpEntryContent>
                                <HelpEntryTop>
                                    <strong>{formatHelpEntryLabel(entry)}</strong>
                                    <small>{entry.category}</small>
                                </HelpEntryTop>
                                <HelpSignatureRow>
                                    <HelpSignature>{entry.signature}</HelpSignature>
                                    {entry.evalExpr && (
                                        <EvalButton
                                            onClick={event => {
                                                event.stopPropagation();
                                                onEvaluate(entry);
                                            }}
                                            title="Run example"
                                        >
                                            <Icon icon="lucide:play" />
                                        </EvalButton>
                                    )}
                                </HelpSignatureRow>
                                {entry.desc && <HelpDesc>{entry.desc}</HelpDesc>}
                                {entry.options && <HelpOptions>{entry.options}</HelpOptions>}
                            </HelpEntryContent>
                        </HelpEntry>
                        {actionsWidth > 0 && (
                            <HelpEntryActions>
                                {documentationPath && (
                                    <DocHelpLink
                                        className="entry-documentation-link"
                                        path={documentationPath}
                                        label={`Open ${formatHelpEntryLabel(entry)} documentation`}
                                    />
                                )}
                                {entry.editUrl && (
                                    <HelpEntryEditLink
                                        href={entry.editUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Open ${formatHelpEntryLabel(entry)} snippet`}
                                        aria-label={`Open ${formatHelpEntryLabel(entry)} snippet editor`}
                                    >
                                        <Icon icon="lucide:square-pen" width={13} height={13} />
                                    </HelpEntryEditLink>
                                )}
                            </HelpEntryActions>
                        )}
                    </HelpEntryRow>
                );
            })}
        </HelpPanelContent>
    );
}
