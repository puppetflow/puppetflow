import React from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { handleLinkClick } from '@/Shared/Utils/navigation';
import { useExplorer, useExplorerView } from '../../ExplorerContext';
import type { DropTarget } from '../../types';
import { getFolderUrl } from '../utils';
import { useDropTarget } from '../useExplorerDrop';
import * as S from './styled';

interface Props {
    onDrop: (event: React.DragEvent, target: DropTarget) => void;
}

interface Crumb {
    key: string;
    href: string;
    label: string;
    icon?: string;
    active: boolean;
    /** Drop target of the crumb, undefined when it cannot receive drops. */
    target?: DropTarget;
}

const crumbIconStyle = { marginRight: 4, verticalAlign: -1 } as const;

interface CrumbItemProps {
    crumb: Crumb;
    onDrop: (event: React.DragEvent, target: DropTarget) => void;
}

function CrumbItem({ crumb, onDrop }: CrumbItemProps) {
    const { dragOver, handlers } = useDropTarget(
        event => crumb.target && onDrop(event, crumb.target),
        { bubble: true },
    );

    return (
        <S.BreadcrumbItem
            href={crumb.href}
            $active={crumb.active}
            $dragOver={dragOver}
            onClick={event => handleLinkClick(event, crumb.href)}
            {...(crumb.target ? handlers : {})}
        >
            {crumb.icon && <Icon icon={crumb.icon} width={12} style={crumbIconStyle} />}
            {crumb.label}
        </S.BreadcrumbItem>
    );
}

export default function ExplorerNavigation({ onDrop }: Props) {
    const { config: { basePath }, data } = useExplorer();
    const { currentFolder, breadcrumbs, personalOwner, filters, teamTrees } = data;
    const { isWorkspaceView, isUsersView, isOtherOwner, resolveDropTarget } = useExplorerView();
    const workspaceUrl = `${basePath}?view=workspace`;
    const usersSection = isUsersView || isOtherOwner;
    // Virtual team roots (no physical root folder) get their own crumb.
    const virtualTeam = isWorkspaceView && filters.team_id
        ? teamTrees.find(team => String(team.id) === String(filters.team_id) && team.root_folder_id === null) ?? null
        : null;
    const rootTarget = resolveDropTarget(null);

    const crumbs: Crumb[] = [
        {
            key: 'root',
            href: isWorkspaceView ? workspaceUrl : usersSection ? `${basePath}?view=users` : basePath,
            label: isWorkspaceView ? 'Workspace' : usersSection ? 'Users' : 'Personal',
            icon: isWorkspaceView ? 'lucide:building-2' : usersSection ? 'lucide:users' : 'lucide:home',
            active: !currentFolder && !isOtherOwner && !virtualTeam,
            target: !usersSection && !virtualTeam ? rootTarget : undefined,
        },
        ...(isOtherOwner ? [{
            key: 'owner',
            href: `${basePath}?owner_id=${personalOwner.id}`,
            label: personalOwner.name,
            icon: 'lucide:user',
            active: !currentFolder,
            target: rootTarget,
        }] : []),
        ...(virtualTeam ? [{
            key: 'team',
            href: `${basePath}?view=workspace&team_id=${virtualTeam.id}`,
            label: virtualTeam.name,
            icon: 'lucide:users',
            active: !currentFolder,
            target: rootTarget,
        }] : []),
        ...breadcrumbs.map((breadcrumb, index) => ({
            key: `folder-${breadcrumb.id}`,
            href: breadcrumb.href ?? getFolderUrl(basePath, breadcrumb.id!, filters),
            label: breadcrumb.name,
            icon: isWorkspaceView && breadcrumb.team_id && index === 0 && !virtualTeam ? 'lucide:users' : undefined,
            active: index === breadcrumbs.length - 1,
            target: resolveDropTarget(breadcrumb.id ?? null),
        })),
    ];

    return (
        <>
            <S.MobilePills>
                <S.MobilePill
                    href={basePath}
                    $active={!isWorkspaceView}
                    onClick={event => handleLinkClick(event, basePath)}
                >
                    <Icon icon="lucide:home" />
                    Personal
                </S.MobilePill>
                <S.MobilePill
                    href={workspaceUrl}
                    $active={isWorkspaceView}
                    onClick={event => handleLinkClick(event, workspaceUrl)}
                >
                    <Icon icon="lucide:building-2" />
                    Workspace
                </S.MobilePill>
            </S.MobilePills>

            <S.Breadcrumbs>
                {crumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.key}>
                        {index > 0 && <S.BreadcrumbSep>/</S.BreadcrumbSep>}
                        <CrumbItem crumb={crumb} onDrop={onDrop} />
                    </React.Fragment>
                ))}
            </S.Breadcrumbs>
        </>
    );
}
