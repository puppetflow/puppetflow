import type { IfConditionCategory } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import {
    IF_CATEGORIES,
    IF_CATEGORY_ICONS,
    IF_CATEGORY_LABELS,
    IF_OPERATORS,
    type IfOperatorDef,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/utils/ifConditions';

const OPERATOR_OPTIONS = IF_CATEGORIES.flatMap(category => (
    IF_OPERATORS[category].map(operator => ({
        value: `${category}:${operator.value}`,
        label: operator.label,
        icon: IF_CATEGORY_ICONS[category],
        group: category,
        groupLabel: IF_CATEGORY_LABELS[category],
        groupIcon: IF_CATEGORY_ICONS[category],
    }))
));

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
        <CustomSelect
            value={`${category}:${operator.value}`}
            options={OPERATOR_OPTIONS}
            disabled={readOnly}
            showOptionValue={false}
            searchThreshold={0}
            onChange={nextValue => {
                const separatorIndex = nextValue.indexOf(':');
                const nextCategory = nextValue.slice(0, separatorIndex) as IfConditionCategory;
                const nextOperator = nextValue.slice(separatorIndex + 1);
                onChange(nextCategory, nextOperator);
            }}
        />
    );
}
