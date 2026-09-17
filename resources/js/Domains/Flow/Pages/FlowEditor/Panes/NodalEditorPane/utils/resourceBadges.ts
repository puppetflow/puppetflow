import type { ReferenceDisplay } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/DataInspector/referenceDisplays';
import type {
    CanvasNode,
    NodeParameterValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';

const staticValue = (value: NodeParameterValue | string | undefined) => {
    if (typeof value === 'string') return value;
    if (value?.mode === 'fixed') return value.value;
    return null;
};

export function getNodeResourceDisplays(
    node: CanvasNode,
    references: ReadonlyMap<string, ReferenceDisplay>,
): ReferenceDisplay[] {
    const referenceKeys: string[] = [];
    if (node.entry.name === '$notify' || node.entry.name === '$waitHumanValidation') {
        const channelId = staticValue(node.values.channelId);
        if (channelId) referenceKeys.push(`channels.${channelId}`);
    }
    if (node.entry.name === '$aiMessage' || node.entry.name === '$aiControl') {
        const aiModelId = staticValue(node.values.aiModelId);
        if (aiModelId) referenceKeys.push(`aiModels.${aiModelId}`);
    }

    const seen = new Set<string>();
    return referenceKeys.flatMap(key => {
        const display = references.get(key);
        const identity = display?.resourceKind && display.resourceId != null
            ? `${display.resourceKind}:${display.resourceId}`
            : null;
        if (!display || !identity || seen.has(identity)) return [];
        seen.add(identity);
        return [display];
    });
}
