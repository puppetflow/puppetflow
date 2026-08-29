import { Icon } from '@/Shared/UI/Icon/Icon';
import * as S from './styled';

export interface PageTabItem<T extends string> {
    value: T;
    label: string;
    mobileLabel?: string;
    icon: string;
}

interface Props<T extends string> {
    tabs: PageTabItem<T>[];
    activeTab: T;
    ariaLabel: string;
    onTabChange: (tab: T) => void;
}

export default function PageTabs<T extends string>({
    tabs,
    activeTab,
    ariaLabel,
    onTabChange,
}: Props<T>) {
    return (
        <>
            <S.PageTabsDesktop>
                <S.SettingsTabs role="tablist" aria-label={ariaLabel}>
                    {tabs.map(tab => (
                        <S.SettingsTab
                            key={tab.value}
                            type="button"
                            role="tab"
                            $active={activeTab === tab.value}
                            aria-selected={activeTab === tab.value}
                            onClick={() => onTabChange(tab.value)}
                        >
                            <Icon icon={tab.icon} width={14} height={14} />
                            {tab.label}
                        </S.SettingsTab>
                    ))}
                </S.SettingsTabs>
            </S.PageTabsDesktop>

            <S.PageTabsMobile role="tablist" aria-label={ariaLabel}>
                {tabs.map(tab => (
                    <S.PageTabsMobileButton
                        key={tab.value}
                        type="button"
                        role="tab"
                        $active={activeTab === tab.value}
                        aria-selected={activeTab === tab.value}
                        onClick={() => onTabChange(tab.value)}
                    >
                        <Icon icon={tab.icon} />
                        <span>{tab.mobileLabel ?? tab.label}</span>
                    </S.PageTabsMobileButton>
                ))}
            </S.PageTabsMobile>
        </>
    );
}
