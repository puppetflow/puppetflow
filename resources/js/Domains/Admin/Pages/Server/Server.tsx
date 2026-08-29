import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import AppLayout from '@/App/Layout/AppLayout/AppLayout';
import type { PageProps } from '@/App/types';
import PageTabs, { type PageTabItem } from '@/Shared/UI/SettingsTabs/PageTabs';
import BrandingSection from '@proprietary/Domains/Admin/Pages/Server/BrandingSection.pp';
import SsoSection from '@proprietary/Domains/Admin/Pages/Server/SsoSection.pp';
import GeneralContent from './GeneralContent/GeneralContent';
import LicenseContent from '@proprietary/Domains/Admin/Pages/Server/LicenseContent/LicenseContent.pp';
import type { ServerProps, ServerTab } from './types';
import { getInitialTab } from './utils';
import * as S from './styled';

export default function Server({ serverSettings, license, about, storage, sso, ssoWorkspaces }: ServerProps) {
    const { auth, flash, settings, branding } = usePage<{ props: PageProps }>().props as unknown as PageProps;
    const [activeTab, setActiveTab] = useState<ServerTab>(() =>
        typeof window === 'undefined'
            ? 'general'
            : getInitialTab(window.location.search, settings.whitelabel_enabled, settings.sso_enabled),
    );
    const tabs: PageTabItem<ServerTab>[] = [
        { value: 'general', label: 'General', icon: 'lucide:settings' },
        { value: 'license', label: 'License', icon: 'lucide:key-round' },
        ...(settings.whitelabel_enabled
            ? [{ value: 'branding' as const, label: 'Branding', icon: 'lucide:palette' }]
            : []),
        ...(settings.sso_enabled
            ? [{ value: 'sso' as const, label: 'SSO', icon: 'lucide:shield-check' }]
            : []),
    ];

    const handleTabChange = (tab: ServerTab) => {
        setActiveTab(tab);

        const url = new URL(window.location.href);
        if (tab === 'general') {
            url.searchParams.delete('tab');
        } else {
            url.searchParams.set('tab', tab);
        }
        window.history.replaceState(null, '', url.toString());
    };

    return (
        <AppLayout title="Server">
            <PageTabs
                tabs={tabs}
                activeTab={activeTab}
                ariaLabel="Server settings sections"
                onTabChange={handleTabChange}
            />

            {(flash?.success || flash?.error) && (
                <S.FlashStack>
                    {flash?.success && <S.Flash $variant="success">{flash.success}</S.Flash>}
                    {flash?.error && <S.Flash $variant="error">{flash.error}</S.Flash>}
                </S.FlashStack>
            )}

            <GeneralContent
                active={activeTab === 'general'}
                serverSettings={serverSettings}
                about={about}
                storage={storage}
                userEmail={auth.user?.email ?? ''}
            />

            <LicenseContent active={activeTab === 'license'} license={license} />

            {settings.whitelabel_enabled && activeTab === 'branding' && (
                <S.TabContent>
                    <BrandingSection branding={branding} />
                </S.TabContent>
            )}

            {settings.sso_enabled && activeTab === 'sso' && sso && (
                <SsoSection sso={sso} workspaces={ssoWorkspaces} />
            )}

        </AppLayout>
    );
}
