import { Icon } from '@/Shared/UI/Icon/Icon';
import {
    runtimeInstanceDetails,
    runtimeInstanceLabel,
    runtimeInstanceTitle,
    type RuntimeInstanceSummary,
} from '@/Domains/Flow/Pages/FlowEditor/utils/runtimeInstances';
import * as S from './styled';

interface RuntimeInstanceBadgeProps {
    summary: RuntimeInstanceSummary;
    size?: 'sm' | 'md';
}

const ICONS: Record<RuntimeInstanceSummary['$runtime'], string> = {
    element: 'lucide:crosshair',
    handle: 'lucide:box',
    httpResponse: 'lucide:globe-2',
    page: 'lucide:panels-top-left',
};

const formatDetail = (value: unknown) => {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

/**
 * Compact representation of a Puppeteer instance recorded in a run preview. The tooltip lists
 * the captured details; the instance itself is not browsable in expressions.
 */
export default function RuntimeInstanceBadge({ summary, size = 'md' }: RuntimeInstanceBadgeProps) {
    const title = runtimeInstanceTitle(summary);
    const label = runtimeInstanceLabel(summary);
    const details = runtimeInstanceDetails(summary)
        .map(([key, value]) => `${key}: ${formatDetail(value)}`)
        .join('\n');
    const tooltip = `${title} (not a JSON value: properties are not accessible in expressions)${details ? `\n\n${details}` : ''}`;

    return (
        <S.Badge $size={size} title={tooltip}>
            <Icon icon={ICONS[summary.$runtime] ?? 'lucide:box'} width={size === 'sm' ? 10 : 12} height={size === 'sm' ? 10 : 12} />
            <S.Title>{title}</S.Title>
            {label && <S.Label>{label}</S.Label>}
        </S.Badge>
    );
}
