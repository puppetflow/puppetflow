import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/Shared/UI/Icon/Icon';
import * as S from './styled';

export type InspectorTab = 'json' | 'schema';

interface InspectorToolbarProps {
    title: string;
    tab: InspectorTab;
    hasValue: boolean;
    showSystemVariables: boolean;
    sourceControl?: ReactNode;
    onTabChange: (tab: InspectorTab) => void;
    onCopy: () => void;
    onToggleSystemVariables: () => void;
}

const TABS: InspectorTab[] = ['json', 'schema'];

export default function InspectorToolbar({
    title,
    tab,
    hasValue,
    showSystemVariables,
    sourceControl,
    onTabChange,
    onCopy,
    onToggleSystemVariables,
}: InspectorToolbarProps) {
    const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
    const showTooltip = (target: HTMLElement) => {
        const rect = target.getBoundingClientRect();
        setTooltipPosition({
            left: Math.min(rect.left, window.innerWidth - 292),
            top: rect.bottom + 9,
        });
    };

    return (
        <S.Header>
            <strong>{title}</strong>
            <S.Actions>
                {hasValue && (
                    <S.ActionButton type="button" title="Copy JSON" aria-label="Copy JSON" onClick={onCopy}>
                        <Icon icon="lucide:copy" width={11} height={11} />
                    </S.ActionButton>
                )}
                <S.SystemToggle
                    type="button"
                    $active={showSystemVariables}
                    aria-label={showSystemVariables ? 'Hide system variables' : 'Show system variables'}
                    aria-pressed={showSystemVariables}
                    onClick={onToggleSystemVariables}
                    onMouseEnter={event => showTooltip(event.currentTarget)}
                    onMouseLeave={() => setTooltipPosition(null)}
                    onFocus={event => showTooltip(event.currentTarget)}
                    onBlur={() => setTooltipPosition(null)}
                >
                    <S.SystemMark>$</S.SystemMark>
                    <S.ToggleTrack $active={showSystemVariables}>
                        <S.ToggleThumb $active={showSystemVariables} />
                    </S.ToggleTrack>
                </S.SystemToggle>
                <S.Tabs>
                    {TABS.map(item => (
                        <S.Tab key={item} type="button" $active={tab === item} onClick={() => onTabChange(item)}>
                            {item}
                        </S.Tab>
                    ))}
                </S.Tabs>
            </S.Actions>
            {sourceControl && <S.SourceControl>{sourceControl}</S.SourceControl>}
            {tooltipPosition && typeof document !== 'undefined' && createPortal(
                <S.Tooltip role="tooltip" style={tooltipPosition}>
                    <S.TooltipTitle>
                        {showSystemVariables ? 'System variables visible' : 'Local variables only'}
                    </S.TooltipTitle>
                    <span>
                        {showSystemVariables
                            ? 'Hide $input, $output and $context to focus on local node data.'
                            : 'Show $input, $output and $context alongside local node data.'}
                    </span>
                </S.Tooltip>,
                document.body,
            )}
        </S.Header>
    );
}
