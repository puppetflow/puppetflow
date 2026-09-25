import type { IfConditionCategory } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import CascadingSelect, {
    type CascadingSelectGroup,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CascadingSelect/CascadingSelect';
import {
    IF_CATEGORIES,
    IF_CATEGORY_ICONS,
    IF_CATEGORY_LABELS,
    IF_OPERATORS,
    type IfOperatorDef,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/utils/ifConditions';

const OPERATOR_GROUPS: CascadingSelectGroup[] = IF_CATEGORIES.map(category => ({
    value: category,
    label: IF_CATEGORY_LABELS[category],
    icon: IF_CATEGORY_ICONS[category],
    options: IF_OPERATORS[category].map(operator => ({
        value: operator.value,
        label: operator.label,
    })),
}));

interface IfOperatorDropdownProps {
    category: IfConditionCategory;
    operator: IfOperatorDef;
    readOnly?: boolean;
    onChange: (category: IfConditionCategory, operator: string) => void;
}

export default function IfOperatorDropdown({
    category,
    operator,
    readOnly,
    onChange,
}: IfOperatorDropdownProps) {
    return (
        <CascadingSelect
            value={{ group: category, option: operator.value }}
            groups={OPERATOR_GROUPS}
            ariaLabel="Operator"
            disabled={readOnly}
            onChange={(nextCategory, nextOperator) => onChange(nextCategory as IfConditionCategory, nextOperator)}
        />
    );
}
