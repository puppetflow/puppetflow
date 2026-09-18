import { Fragment } from 'react';
import RuntimeInstanceBadge from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/components/RuntimeInstanceBadge/RuntimeInstanceBadge';
import {
    asRuntimeInstanceSummary,
    isRuntimeInstancePreview,
    runtimeInstancePreviewSummary,
} from '@/Domains/Flow/Pages/FlowEditor/utils/runtimeInstances';
import { unresolvedResultLabel } from '../utils';
import UnresolvedBadge from './UnresolvedBadge/UnresolvedBadge';
import * as S from './styled';

interface ExpressionPreviewProps {
    value: unknown;
    /** Expression source; when it holds a template, an `undefined` result is shown explicitly. */
    source?: string;
}

export default function ExpressionPreview({ value, source }: ExpressionPreviewProps) {
    const unresolvedLabel = unresolvedResultLabel(value);

    if (unresolvedLabel) {
        return <UnresolvedBadge label={unresolvedLabel} />;
    }

    if (value === undefined && source?.includes('{{')) {
        return <S.UndefinedValue>undefined</S.UndefinedValue>;
    }

    // Puppeteer instances (ElementHandle, HTTPResponse...) are shown as instances, not JSON.
    const instanceSummary = isRuntimeInstancePreview(value)
        ? runtimeInstancePreviewSummary(value)
        : asRuntimeInstanceSummary(value);
    if (instanceSummary) {
        return <RuntimeInstanceBadge summary={instanceSummary} />;
    }

    if (typeof value === 'string') {
        const parts = [...value.matchAll(/\[Needs run: ([^\]]+)\]/g)];

        if (parts.length > 0) {
            let offset = 0;

            return (
                <S.ExpressionMixedPreview>
                    {parts.map((match, index) => {
                        const before = value.slice(offset, match.index);
                        offset = (match.index ?? 0) + match[0].length;

                        return (
                            <Fragment key={`${match[0]}-${index}`}>
                                {before}
                                <UnresolvedBadge label={match[1]} />
                                {index === parts.length - 1 ? value.slice(offset) : null}
                            </Fragment>
                        );
                    })}
                </S.ExpressionMixedPreview>
            );
        }
    }

    return (
        <pre>
            {typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2)}
        </pre>
    );
}
