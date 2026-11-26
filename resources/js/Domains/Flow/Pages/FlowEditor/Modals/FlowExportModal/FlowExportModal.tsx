import React, { useEffect, useState } from 'react';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Modal from '@/Shared/UI/Modal/Modal';
import Switch from '@/Shared/UI/Switch/Switch';
import {
    downloadFlowPackage,
    hasOptionalFlowExportResources,
    type FlowExportPackage,
    type FlowExportSelection,
} from '@/Domains/Flow/Pages/FlowEditor/utils/flowExport';
import * as S from './styled';

interface Props {
    pkg: FlowExportPackage | null;
    onClose: () => void;
    zIndex?: number;
}

const FULL_SELECTION: FlowExportSelection = { snippets: true, dataTables: true, mailboxWatchers: true };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default function FlowExportModal({ pkg, onClose, zIndex }: Props) {
    const [selection, setSelection] = useState<FlowExportSelection>(FULL_SELECTION);

    useEffect(() => {
        if (pkg) setSelection(FULL_SELECTION);
    }, [pkg]);

    if (!pkg) return null;

    const toggle = (key: keyof FlowExportSelection) => (checked: boolean) => {
        setSelection(current => ({ ...current, [key]: checked }));
    };
    const hasResources = hasOptionalFlowExportResources(pkg);
    const snippetCount = selection.snippets ? pkg.snippets.length : 0;
    const fileName = snippetCount > 0
        ? `${pkg.baseName}.zip`
        : `${pkg.baseName}.${pkg.isNodalFlow ? 'json' : 'js'}`;
    const bundled = [
        snippetCount > 0 ? plural(snippetCount, 'snippet') : null,
        selection.dataTables && pkg.dataTables.length > 0 ? plural(pkg.dataTables.length, 'Data Table schema') : null,
        selection.mailboxWatchers && pkg.mailboxWatchers.length > 0 ? plural(pkg.mailboxWatchers.length, 'Mailbox Watcher') : null,
    ].filter((part): part is string => part !== null);
    const contents = bundled.length > 0
        ? `the flow and ${bundled.length > 1 ? `${bundled.slice(0, -1).join(', ')} and ${bundled.at(-1)}` : bundled[0]}`
        : 'the flow only';

    const handleDownload = () => {
        downloadFlowPackage(pkg, selection);
        onClose();
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Download flow"
            caption={hasResources
                ? 'Choose what to bundle. Bundled resources are recreated on import.'
                : 'This flow uses no snippet, Data Table or Mailbox Watcher.'}
            width="560px"
            zIndex={zIndex}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleDownload}>
                        <Icon icon="lucide:download" width={13} />
                        Download
                    </Button>
                </>
            }
        >
            <S.Body>
                {pkg.snippets.length > 0 && (
                    <S.ResourceCard>
                        <S.ResourceHeader htmlFor="export-snippets">
                            <Switch
                                id="export-snippets"
                                checked={selection.snippets}
                                onChange={toggle('snippets')}
                                ariaLabel="Include snippets"
                            />
                            <S.ResourceText>
                                <S.ResourceTitle>Snippets</S.ResourceTitle>
                                <S.ResourceDescription>
                                    Bundle the {plural(pkg.snippets.length, 'snippet')} this flow calls, directly or through other snippets.
                                </S.ResourceDescription>
                            </S.ResourceText>
                        </S.ResourceHeader>
                        {selection.snippets && (
                            <S.ResourceDetails>
                                {pkg.snippets.map(snippet => (
                                    <S.ResourceItem key={snippet.id}>
                                        <S.ResourceName>
                                            <S.ResourceIcon><Icon icon="lucide:puzzle" width={12} /></S.ResourceIcon>
                                            {snippet.label}
                                        </S.ResourceName>
                                        <S.ResourceMeta>{snippet.snippet_type === 'nodal' ? 'Visual' : 'Code'}</S.ResourceMeta>
                                    </S.ResourceItem>
                                ))}
                            </S.ResourceDetails>
                        )}
                    </S.ResourceCard>
                )}

                {pkg.dataTables.length > 0 && (
                    <S.ResourceCard>
                        <S.ResourceHeader htmlFor="export-data-tables">
                            <Switch
                                id="export-data-tables"
                                checked={selection.dataTables}
                                onChange={toggle('dataTables')}
                                ariaLabel="Include Data Table schemas"
                            />
                            <S.ResourceText>
                                <S.ResourceTitle>Data Table schemas</S.ResourceTitle>
                                <S.ResourceDescription>
                                    Describe the {plural(pkg.dataTables.length, 'Data Table')} used by the flow. They are recreated empty on import, rows are never exported.
                                </S.ResourceDescription>
                            </S.ResourceText>
                        </S.ResourceHeader>
                        {selection.dataTables && (
                            <S.ResourceDetails>
                                {pkg.dataTables.map(dataTable => (
                                    <S.ResourceItem key={dataTable.source_id}>
                                        <S.ResourceName>
                                            <S.ResourceIcon><Icon icon="lucide:table" width={12} /></S.ResourceIcon>
                                            {dataTable.name}
                                        </S.ResourceName>
                                        <S.ResourceMeta>{plural(dataTable.columns.length, 'column')}</S.ResourceMeta>
                                    </S.ResourceItem>
                                ))}
                            </S.ResourceDetails>
                        )}
                    </S.ResourceCard>
                )}

                {pkg.mailboxWatchers.length > 0 && (
                    <S.ResourceCard>
                        <S.ResourceHeader htmlFor="export-mailbox-watchers">
                            <Switch
                                id="export-mailbox-watchers"
                                checked={selection.mailboxWatchers}
                                onChange={toggle('mailboxWatchers')}
                                ariaLabel="Include Mailbox Watchers"
                            />
                            <S.ResourceText>
                                <S.ResourceTitle>Mailbox Watchers</S.ResourceTitle>
                                <S.ResourceDescription>
                                    Keep the rules of the {plural(pkg.mailboxWatchers.length, 'Mailbox Watcher')} used by the flow inputs.
                                </S.ResourceDescription>
                            </S.ResourceText>
                        </S.ResourceHeader>
                        {selection.mailboxWatchers && (
                            <S.ResourceDetails>
                                {pkg.mailboxWatchers.map(watcher => (
                                    <S.ResourceItem key={watcher.source_id}>
                                        <S.ResourceName>
                                            <S.ResourceIcon><Icon icon="lucide:mail-search" width={12} /></S.ResourceIcon>
                                            {watcher.name}
                                        </S.ResourceName>
                                        <S.ResourceMeta>{watcher.mailbox.address}</S.ResourceMeta>
                                    </S.ResourceItem>
                                ))}
                            </S.ResourceDetails>
                        )}
                    </S.ResourceCard>
                )}

                <S.Summary>
                    <Icon icon={snippetCount > 0 ? 'lucide:file-archive' : 'lucide:file-code'} width={14} />
                    <span>Downloads <strong>{fileName}</strong> with {contents}.</span>
                </S.Summary>
            </S.Body>
        </Modal>
    );
}
