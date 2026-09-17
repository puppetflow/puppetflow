import type { ReactNode } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { handleLinkClick } from '@/Shared/Utils/navigation';
import { TreeChevron, TreeIconSlot, TreeLabel, TreeRow } from './shared.styled';

interface Props {
    href: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    expanded: boolean;
    /** Shows the chevron; a section without content cannot be expanded. */
    hasContent: boolean;
    depth?: number;
    disabled?: boolean;
    onToggle: () => void;
}

// Header row of a sidebar section (personal, workspace, team, user): link + expand chevron.
export default function TreeSectionRow({
    href,
    label,
    icon,
    active,
    expanded,
    hasContent,
    depth = 0,
    disabled = false,
    onToggle,
}: Props) {
    return (
        <TreeRow
            href={disabled ? undefined : href}
            $depth={depth}
            $active={active}
            $disabled={disabled}
            aria-disabled={disabled}
            onClick={event => {
                if (disabled) {
                    event.preventDefault();
                    return;
                }
                handleLinkClick(event, href);
            }}
        >
            <TreeChevron
                $visible={hasContent && !disabled}
                $expanded={expanded}
                onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!disabled) onToggle();
                }}
            >
                <Icon icon="lucide:chevron-right" />
            </TreeChevron>
            <TreeIconSlot>{icon}</TreeIconSlot>
            <TreeLabel>{label}</TreeLabel>
        </TreeRow>
    );
}
