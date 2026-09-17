import { useEffect, useState } from 'react';
import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import type { CanvasNode } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import { formatEntryLabel } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/catalog';

interface UseNodeLabelDraftOptions {
    node: CanvasNode;
    entry: HelpEntryDef;
    readOnly?: boolean;
    onClose: () => void;
    onRenameNode: (nodeId: string, label: string) => void;
}

// Editable label of the node shown in the modal header; always bound to the node being edited
// (not the deferred one used for previews) so renames and close land on the right node.
export default function useNodeLabelDraft({
    node,
    entry,
    readOnly,
    onClose,
    onRenameNode,
}: UseNodeLabelDraftOptions) {
    const defaultNodeLabel = formatEntryLabel(entry);
    const [labelDraft, setLabelDraft] = useState(node.label?.trim() || defaultNodeLabel);

    useEffect(() => {
        setLabelDraft(node.label?.trim() || defaultNodeLabel);
    }, [defaultNodeLabel, node.id, node.label]);

    const commitLabel = () => {
        onRenameNode(node.id, labelDraft);
        setLabelDraft(labelDraft.trim() || defaultNodeLabel);
    };
    const handleClose = () => {
        const currentLabel = node.label?.trim() || defaultNodeLabel;
        if (!readOnly && labelDraft.trim() !== currentLabel) {
            onRenameNode(node.id, labelDraft);
        }
        onClose();
    };

    return { labelDraft, setLabelDraft, commitLabel, handleClose };
}
