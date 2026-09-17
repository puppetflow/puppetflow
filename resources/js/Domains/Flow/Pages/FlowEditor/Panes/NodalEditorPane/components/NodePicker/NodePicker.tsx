import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { useActiveOptionScroll } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/hooks/useActiveOptionScroll';
import {
    getNodeInputPorts,
    getNodeOutputPorts,
    NODE_CATEGORIES,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/constants';
import {
    formatToolboxNodeLabel,
    getNodeCategoryColor,
    getNodeIcon,
    VISUAL_HELP_ENTRIES,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/catalog';
import { getHelpEntryActionsWidth, getHelpEntryDocumentationPath } from '@/Domains/Flow/Pages/FlowEditor/utils/helpDocumentation';
import type { PendingConnectionTarget, PendingEdgeInsertion } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { isEdgeInsertableEntry } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/node';
import * as S from './styled';

interface NodePickerProps {
    search: string;
    activeCategoryKey: string;
    visibleEntries: HelpEntryDef[];
    pendingConnectionTarget: PendingConnectionTarget | null;
    pendingEdgeInsertion: PendingEdgeInsertion | null;
    onSearchChange: (value: string) => void;
    onSelectCategory: (categoryKey: string) => void;
    onClose: () => void;
    onAddNode: (entry: HelpEntryDef) => void;
}

export default function NodePicker({
    search,
    activeCategoryKey,
    visibleEntries,
    pendingConnectionTarget,
    pendingEdgeInsertion,
    onSearchChange,
    onSelectCategory,
    onClose,
    onAddNode,
}: NodePickerProps) {
    const hasSearch = Boolean(search.trim());
    const toolConnection = pendingConnectionTarget?.connectionType === 'ai_tool';
    const compatibleEntries = useMemo(() => {
        if (pendingEdgeInsertion) return visibleEntries.filter(isEdgeInsertableEntry);
        if (!pendingConnectionTarget) return visibleEntries;
        const candidates = toolConnection ? VISUAL_HELP_ENTRIES : visibleEntries;
        const matchingPorts = (entry: HelpEntryDef) => (
            pendingConnectionTarget.fromSide === 'output'
                ? getNodeInputPorts(entry.name)
                : getNodeOutputPorts(entry.name, entry)
        );
        const compatible = candidates.filter(entry => matchingPorts(entry).some(port => (
            (port.connectionType ?? 'flow') === pendingConnectionTarget.connectionType
        )));
        if (!toolConnection || !search.trim()) return compatible;

        const query = search.trim().toLowerCase();
        return compatible.filter(entry => (
            formatToolboxNodeLabel(entry).toLowerCase().includes(query)
            || entry.name.toLowerCase().includes(query)
            || (entry.nodalDesc ?? entry.desc).toLowerCase().includes(query)
        ));
    }, [pendingConnectionTarget, pendingEdgeInsertion, search, toolConnection, visibleEntries]);
    const pickerCategories = toolConnection
        ? NODE_CATEGORIES.filter(category => category.key === 'ai')
        : NODE_CATEGORIES;
    const [activeIndex, setActiveIndex] = useState(0);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    useActiveOptionScroll({
        open: true,
        itemsDependency: compatibleEntries,
        queryDependency: search,
        activeIndex,
        setActiveIndex,
        optionRefs,
    });

    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (compatibleEntries.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(current => Math.min(compatibleEntries.length - 1, current + 1));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(current => Math.max(0, current - 1));
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            onAddNode(compatibleEntries[activeIndex] ?? compatibleEntries[0]);
        }
    };

    return createPortal(
        <S.NodePicker
            data-node-picker
            onWheel={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
            onPointerMove={event => event.stopPropagation()}
            onPointerUp={event => event.stopPropagation()}
        >
            <S.PickerHeader>
                <S.PickerTitle>
                    <strong>
                        {pendingEdgeInsertion
                            ? 'Insert node in connection'
                            : pendingConnectionTarget
                                ? 'Add connected node'
                                : 'Node Toolbox'}
                    </strong>
                    <span>
                        {pendingEdgeInsertion
                            ? 'Pick a node to place it between these two nodes'
                            : pendingConnectionTarget
                                ? 'Pick a node to connect it automatically'
                                : 'Pick a category, then add a block to the canvas'}
                    </span>
                </S.PickerTitle>
                <S.ClosePicker
                    type="button"
                    onClick={onClose}
                    title="Close"
                >
                    <Icon icon="lucide:x" width={16} height={16} />
                </S.ClosePicker>
            </S.PickerHeader>
            <S.SearchWrap>
                <Icon icon="lucide:search" width={14} height={14} />
                <S.SearchInput
                    placeholder="Search nodes..."
                    value={search}
                    onChange={event => onSearchChange(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                />
            </S.SearchWrap>
            <S.PickerBody>
                <S.CategoryRail>
                    {pickerCategories.map(category => (
                        <S.CategoryPageButton
                            key={category.key}
                            type="button"
                            $active={!hasSearch && (toolConnection || activeCategoryKey === category.key)}
                            $color={category.color}
                            onClick={() => onSelectCategory(category.key)}
                        >
                            <S.CategoryPageIcon $active={!hasSearch && (toolConnection || activeCategoryKey === category.key)} $color={category.color}>
                                <Icon icon={category.icon} width={14} height={14} />
                            </S.CategoryPageIcon>
                            <span>{category.label}</span>
                        </S.CategoryPageButton>
                    ))}
                </S.CategoryRail>
                <S.PickerContent>
                    {compatibleEntries.length === 0 ? (
                        <S.EmptySearch>No matching nodes.</S.EmptySearch>
                    ) : (
                        compatibleEntries.map((entry, index) => {
                            const entryColor = getNodeCategoryColor(entry);
                            const entryDescription = [entry.nodalDesc, entry.desc]
                                .find(description => description?.trim())
                                ?.trim();
                            const documentationPath = getHelpEntryDocumentationPath(entry);
                            const actionsWidth = getHelpEntryActionsWidth(entry, documentationPath);

                            return (
                                <S.NodeOptionRow
                                    key={entry.signature}
                                    onMouseEnter={() => setActiveIndex(index)}
                                >
                                    <S.NodeOption
                                        ref={element => {
                                            optionRefs.current[index] = element;
                                        }}
                                        type="button"
                                        $active={activeIndex === index}
                                        $color={entryColor}
                                        $actionsWidth={actionsWidth}
                                        $hasDescription={Boolean(entryDescription)}
                                        onClick={() => onAddNode(entry)}
                                    >
                                        <S.NodeOptionIcon $color={entryColor}>
                                            <Icon icon={getNodeIcon(entry)} width={14} height={14} />
                                        </S.NodeOptionIcon>
                                        <S.NodeOptionContent>
                                            <S.NodeOptionTop>
                                                <strong>{formatToolboxNodeLabel(entry)}</strong>
                                                <small>{entry.category}</small>
                                            </S.NodeOptionTop>
                                            {entryDescription && <span>{entryDescription}</span>}
                                        </S.NodeOptionContent>
                                    </S.NodeOption>
                                    {actionsWidth > 0 && (
                                        <S.NodeOptionActions>
                                            {documentationPath && (
                                                <DocHelpLink
                                                    className="node-documentation-link"
                                                    path={documentationPath}
                                                    label={`Open ${formatToolboxNodeLabel(entry)} documentation`}
                                                />
                                            )}
                                            {entry.editUrl && (
                                                <S.NodeOptionEditLink
                                                    href={entry.editUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={`Open ${formatToolboxNodeLabel(entry)} snippet`}
                                                    aria-label={`Open ${formatToolboxNodeLabel(entry)} snippet editor`}
                                                >
                                                    <Icon icon="lucide:square-pen" width={13} height={13} />
                                                </S.NodeOptionEditLink>
                                            )}
                                        </S.NodeOptionActions>
                                    )}
                                </S.NodeOptionRow>
                            );
                        })
                    )}
                </S.PickerContent>
            </S.PickerBody>
        </S.NodePicker>,
        document.body,
    );
}
