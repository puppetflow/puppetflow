import AppLayout from '@/App/Layout/AppLayout/AppLayout';
import { usePageProps } from '@/App/Hooks/usePageProps';
import FeatureUnavailablePanel from '@/Domains/Licensing/Components/FeatureFlags/FeatureUnavailablePanel/FeatureUnavailablePanel';
import type { Workspace, WorkspaceUser } from '@/Domains/Workspace/types';
import PageTabs, { type PageTabItem } from '@/Shared/UI/SettingsTabs/PageTabs';
import MemberListCard from './MemberListCard/MemberListCard';
import TeamsCard from '@proprietary/Domains/Workspace/Pages/WorkspaceMembers/TeamsCard/TeamsCard.pp';
import type { MembersTab, PendingInvitation, RegistrationRequest, Team } from './types';
import { useWorkspaceMembersTab } from './useWorkspaceMembersTab';
import * as S from './styled';

const memberTabs: PageTabItem<MembersTab>[] = [
    { value: 'users', label: 'Users', icon: 'lucide:users' },
    { value: 'teams', label: 'Teams', icon: 'lucide:users-round' },
];

export type { PendingInvitation, RegistrationRequest, Team, TeamUser } from './types';
export { formatDate, menuPositionFromEvent } from './utils';

interface Props {
    workspace: Workspace & { users: WorkspaceUser[] };
    isWorkspaceAdmin: boolean;
    callerWorkspaceRole: 'admin' | 'manager' | 'member';
    pendingInvitations: PendingInvitation[];
    registrationRequests: RegistrationRequest[];
    teams: Team[];
    canCreateTeam: boolean;
}

export default function WorkspaceMembers({
    workspace,
    isWorkspaceAdmin,
    callerWorkspaceRole,
    pendingInvitations,
    registrationRequests,
    teams,
    canCreateTeam,
}: Props) {
    const { settings } = usePageProps();
    const teamsEnabled = settings?.teams_enabled ?? false;
    const { activeTab, handleTabChange } = useWorkspaceMembersTab();

    return (
        <AppLayout
            title="Workspace Members"
            documentationPath="/guide/users-teams-access"
            documentationLabel="Open users, teams, and access documentation"
        >
            <PageTabs
                tabs={memberTabs}
                activeTab={activeTab}
                ariaLabel="Workspace member sections"
                onTabChange={handleTabChange}
            />

            <S.Page>
                {activeTab === 'users' && (
                    <MemberListCard
                        workspace={workspace}
                        isWorkspaceAdmin={isWorkspaceAdmin}
                        callerWorkspaceRole={callerWorkspaceRole}
                        teams={teams}
                        pendingInvitations={pendingInvitations}
                        registrationRequests={registrationRequests}
                    />
                )}
                {activeTab === 'teams' && (
                    teamsEnabled
                        ? (
                            <TeamsCard
                                teams={teams}
                                members={workspace.users ?? []}
                                isWorkspaceAdmin={isWorkspaceAdmin}
                                canCreateTeam={canCreateTeam}
                            />
                        )
                        : <FeatureUnavailablePanel message={settings.disabled_feature_message} />
                )}
            </S.Page>
        </AppLayout>
    );
}
