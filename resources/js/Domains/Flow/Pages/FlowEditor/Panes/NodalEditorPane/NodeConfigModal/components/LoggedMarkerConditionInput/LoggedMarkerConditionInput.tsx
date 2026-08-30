import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import type { NodalParamDef } from '@/Domains/Flow/Pages/FlowEditor/types';
import { useGrabber } from '@/Domains/Flow/Pages/FlowEditor/Grabber/GrabberContext';
import type { NodalAutocompleteContext } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/staticAnalysis';
import type {
    IfConditionCategory,
    NodeParameterValue,
    ObjectFieldValueType,
    ObjectNodeParameterField,
    ObjectNodeParameterValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/types';
import {
    getObjectFields,
    normalizeObjectParameterValue,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/utils/objectParameters';
import { normalizeScalarParameterValue } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/utils/expression';
import ExpressionInput from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/ExpressionInput/ExpressionInput';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import {
    IF_CATEGORY_ICONS,
    IF_CATEGORY_LABELS,
    IF_OPERATORS,
} from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/utils/ifConditions';
import * as Shared from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/NodeParameters/shared.styled';
import * as S from './styled';

const MARKER_OPERATORS: Partial<Record<IfConditionCategory, string[]>> = {
    boolean: ['exists', 'doesNotExist'],
    number: [
        'equals',
        'notEquals',
        'greaterThan',
        'lessThan',
        'greaterThanOrEqual',
        'lessThanOrEqual',
    ],
};
const NUMBER_OPERATORS = new Set(MARKER_OPERATORS.number);
const MARKER_OPERATOR_OPTIONS = (['boolean', 'number'] as IfConditionCategory[]).flatMap(category => (
    IF_OPERATORS[category]
        .filter(operator => MARKER_OPERATORS[category]?.includes(operator.value))
        .map(operator => ({
            value: operator.value,
            label: operator.label,
            icon: IF_CATEGORY_ICONS[category],
            group: category,
            groupLabel: IF_CATEGORY_LABELS[category],
            groupIcon: IF_CATEGORY_ICONS[category],
        }))
));

interface LoggedMarkerConditionInputProps {
    meta: NodalParamDef;
    value: NodeParameterValue;
    outputData: unknown;
    autocompleteContext: NodalAutocompleteContext;
    currentSiteUrl?: string | null;
    flowId?: Id;
    readOnly?: boolean;
    invalid?: boolean;
    errorMessage?: string;
    onRemove?: () => void;
    onChange: (value: ObjectNodeParameterValue) => void;
}

export default function LoggedMarkerConditionInput({
    meta,
    value,
    outputData,
    autocompleteContext,
    currentSiteUrl,
    flowId,
    readOnly,
    invalid,
    errorMessage,
    onRemove,
    onChange,
}: LoggedMarkerConditionInputProps) {
    const objectValue = normalizeObjectParameterValue(value, meta);
    const fields = getObjectFields(objectValue, meta);
    const selectorField = fields.find(field => field.key === 'selector');
    const operatorField = fields.find(field => field.key === 'operator');
    const countField = fields.find(field => field.key === 'count');
    const operator = normalizeScalarParameterValue(operatorField?.value).value || 'exists';
    const category: IfConditionCategory = NUMBER_OPERATORS.has(operator) ? 'number' : 'boolean';
    const { available: grabberAvailable, grabSelector } = useGrabber();
    const [grabbing, setGrabbing] = useState(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggeredRef = useRef(false);

    useEffect(() => () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }, []);

    const fieldValueType = (key: string): ObjectFieldValueType | undefined => {
        const valueType = meta.objectFields?.[key]?.valueType;
        return ['string', 'number', 'dateTime', 'boolean', 'array', 'object', 'code'].includes(valueType ?? '')
            ? valueType as ObjectFieldValueType
            : undefined;
    };

    const updateField = (key: string, nextValue: NodeParameterValue) => {
        const existing = fields.find(field => field.key === key);
        const nextField: ObjectNodeParameterField = existing
            ? { ...existing, value: nextValue }
            : {
                id: `known-${key}`,
                key,
                valueType: fieldValueType(key),
                value: nextValue,
            };

        onChange({
            ...objectValue,
            inputMode: 'form',
            fields: existing
                ? fields.map(field => field.id === existing.id ? nextField : field)
                : [...fields, nextField],
        });
    };

    const updateOperator = (nextCategory: IfConditionCategory, nextOperator: string) => {
        const existingCount = normalizeScalarParameterValue(countField?.value).value;
        const nextFields = fields
            .filter(field => field.key !== 'operator' && field.key !== 'count');

        nextFields.push({
            id: operatorField?.id ?? 'known-operator',
            key: 'operator',
            valueType: fieldValueType('operator'),
            value: { mode: 'fixed', value: nextOperator },
        });
        if (nextCategory === 'number') {
            nextFields.push({
                id: countField?.id ?? 'known-count',
                key: 'count',
                valueType: fieldValueType('count'),
                value: { mode: 'fixed', value: existingCount || '0' },
            });
        }

        onChange({ ...objectValue, inputMode: 'form', fields: nextFields });
    };

    const handleGrab = async (forceOnboarding = false) => {
        if (readOnly || grabbing) return;
        setGrabbing(true);
        try {
            const result = await grabSelector(currentSiteUrl, { forceOnboarding });
            updateField('selector', { mode: 'fixed', value: result.selector });
        } catch {
            // The coordinator owns user-facing failure feedback.
        } finally {
            setGrabbing(false);
        }
    };

    const stopLongPress = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    };

    const startLongPress = () => {
        if (readOnly || grabbing) return;
        stopLongPress();
        longPressTriggeredRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            void handleGrab(true);
        }, 550);
    };

    const selectorLabel = (
        <Shared.PickerLabel>
            <label>Selector</label>
            <Shared.PickerButton
                type="button"
                disabled={readOnly || grabbing}
                $active={grabbing}
                title={grabberAvailable
                    ? 'Pick a selector. Shift-click or hold to show the introduction.'
                    : 'Connect or install Puppetflow Grabber'}
                onPointerDown={startLongPress}
                onPointerUp={stopLongPress}
                onPointerCancel={stopLongPress}
                onPointerLeave={stopLongPress}
                onClick={event => {
                    if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        event.preventDefault();
                        return;
                    }
                    void handleGrab(event.shiftKey);
                }}
            >
                <Icon icon={grabbing ? 'lucide:scan-search' : 'lucide:crosshair'} width={13} height={13} />
                {grabbing ? 'Picking...' : 'Grab'}
            </Shared.PickerButton>
        </Shared.PickerLabel>
    );

    return (
        <S.Root $invalid={invalid}>
            <S.Header>
                {onRemove && (
                    <S.RemoveButton
                        type="button"
                        disabled={readOnly}
                        title="Remove condition"
                        onClick={onRemove}
                    >
                        <Icon icon="lucide:trash-2" width={14} height={14} />
                    </S.RemoveButton>
                )}
                <div>
                    <label>{meta.label ?? 'Logged marker condition'}</label>
                    <S.Help>{meta.description}</S.Help>
                </div>
            </S.Header>
            {invalid && <S.Error>{errorMessage || 'Complete the marker condition.'}</S.Error>}
            <ExpressionInput
                label="Selector"
                labelSlot={selectorLabel}
                hint={meta.objectFields?.selector?.description}
                placeholder=".dashboard, [data-testid=&quot;account-menu&quot;]"
                inputType="text"
                value={normalizeScalarParameterValue(selectorField?.value)}
                outputData={outputData}
                autocompleteContext={autocompleteContext}
                flowId={flowId}
                readOnly={readOnly}
                onChange={nextValue => updateField('selector', nextValue)}
            />
            <S.ConditionBlock>
                <S.ConditionLabel>Condition</S.ConditionLabel>
                <CustomSelect
                    value={operator}
                    options={MARKER_OPERATOR_OPTIONS}
                    showOptionValue={false}
                    searchThreshold={0}
                    disabled={readOnly}
                    onChange={nextOperator => updateOperator(
                        NUMBER_OPERATORS.has(nextOperator) ? 'number' : 'boolean',
                        nextOperator,
                    )}
                />
                {category === 'number' && (
                    <S.CountField>
                        <ExpressionInput
                            label="Count"
                            hint={meta.objectFields?.count?.description}
                            inputType="number"
                            value={normalizeScalarParameterValue(countField?.value)}
                            outputData={outputData}
                            autocompleteContext={autocompleteContext}
                            flowId={flowId}
                            readOnly={readOnly}
                            onChange={nextValue => updateField('count', nextValue)}
                        />
                    </S.CountField>
                )}
            </S.ConditionBlock>
        </S.Root>
    );
}
