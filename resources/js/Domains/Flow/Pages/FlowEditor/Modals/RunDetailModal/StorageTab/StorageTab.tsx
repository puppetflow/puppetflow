import type { FlowRun } from '@/Domains/Flow/types';
import { formatRunStorage } from '@/Domains/Flow/Pages/FlowEditor/utils/format';
import { formatDateTime } from '@/Shared/Utils/formatDate';
import { ucfirst } from '@/Shared/Utils/string';
import { getVisibleConsoleLogs } from '../runProgress';
import * as S from './styled';

interface StorageTabProps {
    run: FlowRun;
}

export default function StorageTab({ run }: StorageTabProps) {
    const storageRows = [
        ['Recording', run.recording_size_bytes],
        ['Screenshots', run.screenshots_size_bytes],
        ['Downloads', run.downloads_size_bytes],
        ['Flow data', run.flow_data_size_bytes],
        ['Console logs', run.console_logs_size_bytes],
    ] as const;
    const runRows = [
        ['Run', `#${run.id}`],
        ['Status', ucfirst(run.status)],
        ['Created', formatDateTime(run.created_at)],
        ['Duration', run.duration_ms == null ? '—' : `${(run.duration_ms / 1000).toFixed(1)}s`],
        ['Trigger', ucfirst(run.trigger?.label ?? run.trigger_type)],
        ['Triggered by', run.triggered_by_user?.name ?? '—'],
        ['Screenshots', String(run.screenshots_count)],
        ['Downloads', String(run.downloads_count)],
        ['Recording', run.has_recording ? 'Available' : 'None'],
        ['Console entries', String(getVisibleConsoleLogs(run.console_logs).length)],
        ['Actions', String(run.action_results?.length ?? 0)],
    ] as const;

    return (
        <S.Sections>
            <S.Section>
                <S.SectionTitle>Run summary</S.SectionTitle>
                <S.StorageTable>
                    <tbody>
                        {runRows.map(([label, value]) => (
                            <S.StorageRow key={label}>
                                <S.StorageLabel>{label}</S.StorageLabel>
                                <S.StorageValue>{value}</S.StorageValue>
                            </S.StorageRow>
                        ))}
                    </tbody>
                </S.StorageTable>
            </S.Section>
            <S.Section>
                <S.SectionTitle>Storage</S.SectionTitle>
                <S.StorageTable>
                    <tbody>
                        {storageRows.map(([label, bytes]) => (
                            <S.StorageRow key={label}>
                                <S.StorageLabel>{label}</S.StorageLabel>
                                <S.StorageValue>{formatRunStorage(bytes)}</S.StorageValue>
                            </S.StorageRow>
                        ))}
                        <S.StorageRow $total>
                            <S.StorageLabel>Total</S.StorageLabel>
                            <S.StorageValue>{formatRunStorage(run.storage_size_bytes)}</S.StorageValue>
                        </S.StorageRow>
                    </tbody>
                </S.StorageTable>
            </S.Section>
        </S.Sections>
    );
}
