import { Icon } from '@/Shared/UI/Icon/Icon';
import type { NodalParamDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import * as S from './styled';

interface ObjectAddControlsProps {
    availableFieldKeys: string[];
    meta: NodalParamDef;
    allowCustomFields: boolean;
    addCustomFieldLabel?: string;
    readOnly?: boolean;
    onAddField: (key: string) => void;
    onAddCustomField: () => void;
}

export default function ObjectAddControls({
    availableFieldKeys,
    meta,
    allowCustomFields,
    addCustomFieldLabel,
    readOnly,
    onAddField,
    onAddCustomField,
}: ObjectAddControlsProps) {
    return (
        <>
            {(availableFieldKeys.length > 0 || (allowCustomFields && addCustomFieldLabel)) && (
                <CustomSelect
                    value=""
                    disabled={readOnly}
                    placeholder={addCustomFieldLabel ? 'Add Column Value...' : 'Add option...'}
                    showOptionValue={false}
                    options={availableFieldKeys.map(key => ({
                        value: key,
                        label: meta.objectFields?.[key]?.label ?? key,
                    }))}
                    actionSlot={allowCustomFields && addCustomFieldLabel ? {
                        label: addCustomFieldLabel,
                        onAction: async () => {
                            onAddCustomField();
                            return null;
                        },
                    } : undefined}
                    onChange={onAddField}
                />
            )}
            {allowCustomFields && !addCustomFieldLabel && (
                <S.AddRow>
                    <S.AddButton
                        type="button"
                        disabled={readOnly}
                        onClick={onAddCustomField}
                    >
                        <Icon icon="lucide:plus" width={12} height={12} />
                        Add entry
                    </S.AddButton>
                </S.AddRow>
            )}
        </>
    );
}
