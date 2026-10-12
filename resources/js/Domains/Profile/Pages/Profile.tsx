import AppLayout from '@/App/Layout/AppLayout/AppLayout';
import { useAuth } from '@/App/Hooks/usePageProps';
import type {
    ApiKey,
    ProfileSso,
    ProfileTrigger,
    ProfileTriggerTeam,
    ProfileWorkspaceProxy,
} from '@/Domains/Profile/types';
import PageTabs, { type PageTabItem } from '@/Shared/UI/SettingsTabs/PageTabs';
import SsoIdentitySection from '@proprietary/Domains/Profile/SsoIdentitySection.pp';
import PersonalInfoSection from './Sections/PersonalInfoSection/PersonalInfoSection';
import SecuritySection from './Sections/SecuritySection';
import ApiKeysSection from './Sections/ApiKeysSection/ApiKeysSection';
import OnboardingSection from './Sections/OnboardingSection/OnboardingSection';
import TriggersSection from './Sections/TriggersSection/TriggersSection';
import * as S from './styled';
import { type ProfileTab, useProfileTab } from './useProfileTab';

const profileTabs: PageTabItem<ProfileTab>[] = [
    { value: 'general', label: 'General', icon: 'lucide:user-round' },
    { value: 'security', label: 'Security', icon: 'lucide:shield' },
    { value: 'api', label: 'API', icon: 'lucide:key-round' },
    { value: 'triggers', label: 'Triggers', icon: 'lucide:zap' },
];

const documentationPaths: Partial<Record<ProfileTab, string>> = {
    security: '/guide/users-teams-access#user-authentication',
    api: '/reference/api#authentication',
    triggers: '/guide/triggers-actions#triggers',
};

interface Props {
    apiKeys: ApiKey[];
    newApiKey: string | null;
    triggers: ProfileTrigger[];
    teams: ProfileTriggerTeam[];
    workspaceProxies: ProfileWorkspaceProxy[];
    canManageWorkspaceProxies: boolean;
    twoFactorEnabled: boolean;
    sso: ProfileSso;
}

export default function Profile({
    apiKeys,
    newApiKey,
    triggers,
    teams,
    workspaceProxies,
    canManageWorkspaceProxies,
    twoFactorEnabled,
    sso,
}: Props) {
    const { user } = useAuth();
    const { activeTab, changeTab } = useProfileTab();

    if (!user) return null;

    return (
        <AppLayout
            title="Profile"
            documentationPath={documentationPaths[activeTab]}
            documentationLabel="Open profile documentation"
        >
            <PageTabs
                tabs={profileTabs}
                activeTab={activeTab}
                ariaLabel="Profile sections"
                onTabChange={changeTab}
            />

            {activeTab === 'general' && (
                <S.Container>
                    <PersonalInfoSection user={user} />
                    <OnboardingSection />
                </S.Container>
            )}

            {activeTab === 'security' && (
                <S.SecurityContainer>
                    <SecuritySection twoFactorEnabled={twoFactorEnabled} />
                    <SsoIdentitySection sso={sso} />
                </S.SecurityContainer>
            )}

            {activeTab === 'api' && (
                <S.ApiTab>
                    <ApiKeysSection apiKeys={apiKeys} newApiKey={newApiKey} />
                </S.ApiTab>
            )}

            {activeTab === 'triggers' && (
                <TriggersSection
                    triggers={triggers}
                    teams={teams}
                    workspaceProxies={workspaceProxies}
                    canManageWorkspaceProxies={canManageWorkspaceProxies}
                />
            )}
        </AppLayout>
    );
}
