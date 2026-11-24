import Input from '@/Shared/UI/Input/Input';
import * as Shared from '@/Shared/UI/Input/shared.styled';
import Switch from '@/Shared/UI/Switch/Switch';
import CustomSelect, { type CustomSelectOption } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import UserAgentInput from '@/Shared/UI/UserAgentInput/UserAgentInput';
import LanguageSelect from '@/Shared/UI/LanguageSelect/LanguageSelect';
import { formatBrowserLanguage } from '@/Shared/Utils/browserLanguages';
import type { SettingsForm } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/types';
import type { SettingsLimits } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/useSettingsLimits';
import * as S from './styled';

interface BrowserSectionProps {
    form: SettingsForm;
    viewport: SettingsLimits['wsViewport'];
    keyboardSpeed: SettingsLimits['wsKeyboardSpeed'];
    userAgent: SettingsLimits['wsUserAgent'];
    language: SettingsLimits['wsLanguage'];
    clickMarkersEnabled: SettingsLimits['wsClickMarkersEnabled'];
}

type ClickMarkersChoice = 'inherit' | 'on' | 'off';

export default function BrowserSection({ form, viewport, keyboardSpeed, userAgent, language, clickMarkersEnabled }: BrowserSectionProps) {
    const inheritedLanguage = formatBrowserLanguage(language);
    const clickMarkersValue: ClickMarkersChoice = form.data.click_markers_enabled === null
        ? 'inherit'
        : form.data.click_markers_enabled ? 'on' : 'off';
    const clickMarkersOptions: CustomSelectOption<ClickMarkersChoice>[] = [
        {
            value: 'inherit',
            label: `Workspace default (${clickMarkersEnabled ? 'shown' : 'hidden'})`,
            detail: 'Follows the workspace browser settings',
            icon: 'lucide:corner-left-up',
        },
        {
            value: 'on',
            label: 'Show click animations',
            detail: 'Ripple drawn in the replay and the live view',
            icon: 'lucide:mouse-pointer-click',
            dividerBefore: true,
        },
        {
            value: 'off',
            label: 'Hide click animations',
            detail: 'Raw recording, no overlay',
            icon: 'lucide:mouse-pointer-ban',
        },
    ];
    return (
        <>
            <S.ViewportRow>
                <Input
                    label="Viewport width"
                    type="number"
                    placeholder={String(viewport.width)}
                    value={form.data.viewport_width === '' ? '' : String(form.data.viewport_width)}
                    onChange={e => form.setData('viewport_width', e.target.value === '' ? '' : Number(e.target.value))}
                    error={form.errors.viewport_width}
                />
                <S.ViewportSep>x</S.ViewportSep>
                <Input
                    label="Viewport height"
                    type="number"
                    placeholder={String(viewport.height)}
                    value={form.data.viewport_height === '' ? '' : String(form.data.viewport_height)}
                    onChange={e => form.setData('viewport_height', e.target.value === '' ? '' : Number(e.target.value))}
                    error={form.errors.viewport_height}
                />
            </S.ViewportRow>
            <S.SettingsHint>
                Override browser viewport for this flow. Leave empty to use workspace default ({viewport.width}x{viewport.height}).
            </S.SettingsHint>

            <Input
                label="Keyboard speed"
                type="number"
                placeholder={String(keyboardSpeed)}
                value={form.data.keyboard_speed === '' ? '' : String(form.data.keyboard_speed)}
                onChange={e => form.setData('keyboard_speed', e.target.value === '' ? '' : Number(e.target.value))}
                error={form.errors.keyboard_speed}
            />
            <S.SettingsHint>
                Override the delay between keystrokes for this flow. Leave empty to use workspace default ({keyboardSpeed} ms).
            </S.SettingsHint>

            <UserAgentInput
                label="User agent"
                placeholder={userAgent || 'Runtime default (Chrome)'}
                value={form.data.user_agent}
                onChange={value => form.setData('user_agent', value)}
                error={form.errors.user_agent}
            />
            <S.SettingsHint>
                Override the browser user agent for this flow. Leave empty to inherit the workspace default, then the instance default.
            </S.SettingsHint>

            <LanguageSelect
                label="Browser language"
                inheritLabel={inheritedLanguage ? `Inherit (${inheritedLanguage})` : 'Inherit (runtime default)'}
                inheritedValue={language}
                value={form.data.language}
                onChange={value => form.setData('language', value)}
                error={form.errors.language}
            />
            <S.SettingsHint>
                Language the browser asks websites for (Accept-Language and navigator.language). Inherits the workspace default, then the instance default. Some websites ignore it and pick a language from the IP address or the account instead; use a proxy in the target country for those.
            </S.SettingsHint>

            <Shared.Wrapper $fullWidth>
                <Shared.Label as="span">Click animations</Shared.Label>
                <CustomSelect<ClickMarkersChoice>
                    value={clickMarkersValue}
                    options={clickMarkersOptions}
                    searchThreshold={8}
                    showOptionValue={false}
                    ariaLabel="Click animations"
                    invalid={Boolean(form.errors.click_markers_enabled)}
                    onChange={value => form.setData('click_markers_enabled', value === 'inherit' ? null : value === 'on')}
                />
                {form.errors.click_markers_enabled && <Shared.Error>{form.errors.click_markers_enabled}</Shared.Error>}
            </Shared.Wrapper>
            <S.SettingsHint>
                Draw a ripple where automated clicks land, in the run replay and the live view.
            </S.SettingsHint>

            <Switch
                id="disable_web_security"
                checked={form.data.disable_web_security}
                onChange={value => form.setData('disable_web_security', value)}
                label="Disable web security"
            />
            <S.SettingsHint>Launch the browser with --disable-web-security (allows cross-origin requests).</S.SettingsHint>
        </>
    );
}
