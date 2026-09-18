import React from 'react';
import { useForm, usePage } from '@inertiajs/react';
import type { PageProps as InertiaPageProps } from '@inertiajs/core';
import Input from '@/Shared/UI/Input/Input';
import Button from '@/Shared/UI/Button/Button';
import UserAgentInput from '@/Shared/UI/UserAgentInput/UserAgentInput';
import LanguageSelect from '@/Shared/UI/LanguageSelect/LanguageSelect';
import { formatBrowserLanguage } from '@/Shared/Utils/browserLanguages';
import { useDirtyReport } from '@/Shared/Hooks/useDirtyReport';
import type { PageProps } from '@/App/types';
import type { Workspace } from '@/Domains/Workspace/types';
import * as S from './BrowserSection.styled';

interface Props {
    workspace: Workspace;
    readOnly?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
}

export default function BrowserSection({ workspace, readOnly, onDirtyChange }: Props) {
    const { settings } = usePage<InertiaPageProps & PageProps>().props;
    const instanceUserAgent = settings.default_user_agent ?? '';
    const instanceLanguage = formatBrowserLanguage(settings.default_language);
    const form = useForm({
        viewport_width: workspace.viewport_width ?? 1280,
        viewport_height: workspace.viewport_height ?? 720,
        keyboard_speed: workspace.keyboard_speed ?? 100,
        default_user_agent: workspace.default_user_agent ?? '',
        default_language: workspace.default_language ?? '',
    });
    useDirtyReport(form.isDirty, onDirtyChange);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        form.put('/workspace');
    };

    return (
        <S.Form onSubmit={handleSubmit}>
            <S.FormRow>
                <Input
                    label="Default viewport width"
                    type="number"
                    value={String(form.data.viewport_width)}
                    onChange={e => form.setData('viewport_width', Number(e.target.value))}
                    error={form.errors.viewport_width}
                    disabled={readOnly}
                />
                <span style={{ marginTop: 18, color: '#888' }}>x</span>
                <Input
                    label="Default viewport height"
                    type="number"
                    value={String(form.data.viewport_height)}
                    onChange={e => form.setData('viewport_height', Number(e.target.value))}
                    error={form.errors.viewport_height}
                    disabled={readOnly}
                />
            </S.FormRow>
            <S.FieldHint>
                Default browser viewport size for all flows (320-3840 x 200-2160). Can be overridden per flow. Larger viewports increase disk usage when video recording is enabled.
            </S.FieldHint>
            <Input
                label="Default keyboard speed"
                type="number"
                value={String(form.data.keyboard_speed)}
                onChange={e => form.setData('keyboard_speed', Number(e.target.value))}
                error={form.errors.keyboard_speed}
                disabled={readOnly}
            />
            <S.FieldHint>
                Default delay between keystrokes in milliseconds (0-10000). Can be overridden per flow or run.
            </S.FieldHint>
            <UserAgentInput
                label="Default user agent"
                placeholder={instanceUserAgent || 'Runtime default (Chrome)'}
                value={form.data.default_user_agent}
                onChange={value => form.setData('default_user_agent', value)}
                error={form.errors.default_user_agent}
                disabled={readOnly}
            />
            <S.FieldHint>
                Default browser user agent for all flows in this workspace. Can be overridden per flow.
            </S.FieldHint>
            <LanguageSelect
                label="Default browser language"
                inheritLabel={instanceLanguage ? `Inherit (${instanceLanguage})` : 'Inherit (runtime default)'}
                inheritedValue={settings.default_language}
                value={form.data.default_language}
                onChange={value => form.setData('default_language', value)}
                error={form.errors.default_language}
                disabled={readOnly}
            />
            <S.FieldHint>
                Language the browser asks websites for (Accept-Language and navigator.language) in all flows of this workspace. Can be overridden per flow. Some websites ignore it and pick a language from the IP address or the account instead; use a proxy in the target country for those.
            </S.FieldHint>
            {!readOnly && (
                <S.FormActions>
                    <Button type="submit" size="sm" disabled={form.processing}>
                        Save
                    </Button>
                </S.FormActions>
            )}
        </S.Form>
    );
}
