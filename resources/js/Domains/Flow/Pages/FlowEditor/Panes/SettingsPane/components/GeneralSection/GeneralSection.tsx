import Input from '@/Shared/UI/Input/Input';
import type { SettingsForm } from '@/Domains/Flow/Pages/FlowEditor/Panes/SettingsPane/types';

interface GeneralSectionProps {
    form: SettingsForm;
}

export default function GeneralSection({ form }: GeneralSectionProps) {
    return (
        <>
            <Input
                label="Name"
                value={form.data.name}
                onChange={e => form.setData('name', e.target.value)}
                error={form.errors.name}
                maxLength={128}
                showCharCount
            />
            <Input
                label="Description"
                value={form.data.description}
                onChange={e => form.setData('description', e.target.value)}
            />
        </>
    );
}
