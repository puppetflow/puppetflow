import { useId, type ReactNode } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { DocHelpLink } from '@/Shared/UI/DocHelpLink/DocHelpLink';
import * as S from './styled';
import type { CollapsibleSize } from './styled';

interface CollapsibleSectionProps {
    icon: string;
    title: string;
    description?: string;
    open: boolean;
    onToggle: () => void;
    size?: CollapsibleSize;
    modified?: boolean;
    hasError?: boolean;
    docPath?: string;
    docLabel?: string;
    children: ReactNode;
}

/**
 * Named, expandable settings block. Header shows a "Modified" badge when the section holds
 * unsaved changes and an "Error" badge when a field inside failed validation, so nothing
 * important stays hidden behind a collapsed header.
 */
export default function CollapsibleSection({
    icon,
    title,
    description,
    open,
    onToggle,
    size = 'md',
    modified = false,
    hasError = false,
    docPath,
    docLabel,
    children,
}: CollapsibleSectionProps) {
    const bodyId = useId();
    const iconSize = size === 'sm' ? 14 : 17;

    return (
        <S.Section $open={open} $error={hasError}>
            <S.Header type="button" $size={size} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
                <S.IconBox $size={size} $open={open}>
                    <Icon icon={icon} width={iconSize} height={iconSize} />
                </S.IconBox>
                <S.Heading>
                    <S.Title $size={size}>
                        {title}
                        {docPath && (
                            <DocHelpLink
                                path={docPath}
                                label={docLabel ?? `Open ${title} documentation`}
                                onClick={event => event.stopPropagation()}
                            />
                        )}
                    </S.Title>
                    {description && <S.Description $size={size}>{description}</S.Description>}
                </S.Heading>
                <S.Badges>
                    {hasError && <S.Badge $tone="error">Error</S.Badge>}
                    {!hasError && modified && <S.Badge $tone="modified">Modified</S.Badge>}
                    <S.Chevron $open={open}>
                        <Icon icon="lucide:chevron-down" width={size === 'sm' ? 14 : 16} height={size === 'sm' ? 14 : 16} />
                    </S.Chevron>
                </S.Badges>
            </S.Header>
            <S.Body id={bodyId} $size={size} $open={open} aria-hidden={!open}>{children}</S.Body>
        </S.Section>
    );
}
