import AppLayout from '@/App/Layout/AppLayout/AppLayout';
import { useAuth } from '@/App/Hooks/usePageProps';
import type { ApiKey, ProfileSso } from '@/Domains/Profile/types';
import PageTabs, { type PageTabItem } from '@/Shared/UI/SettingsTabs/PageTabs';
import SsoIdentitySection from '@proprietary/Domains/Profile/SsoIdentitySection.pp';
import PersonalInfoSection from './Sections/PersonalInfoSection/PersonalInfoSection';
import SecuritySection from './Sections/SecuritySection';
import ApiKeysSection from './Sections/ApiKeysSection/ApiKeysSection';
import OnboardingSection from './Sections/OnboardingSection/OnboardingSection';
import * as S from './styled';
import { type ProfileTab, useProfileTab } from './useProfileTab';

const profileTabs: PageTabItem<ProfileTab>[] = [
    { value: 'general', label: 'General', icon: 'lucide:user-round' },
    { value: 'security', label: 'Security', icon: 'lucide:shield' },
    { value: 'api', label: 'API', icon: 'lucide:key-round' },
];

interface Props {
    apiKeys: ApiKey[];
    newApiKey: string | null;
    twoFactorEnabled: boolean;
    sso: ProfileSso;
}

export default function Profile({ apiKeys, newApiKey, twoFactorEnabled, sso }: Props) {
    const { user } = useAuth();
    const { activeTab, changeTab } = useProfileTab();

    if (!user) return null;

    return (
        <AppLayout title="Profile">
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
        </AppLayout>
    );
}
