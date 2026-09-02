import React, { useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import type { FormDataConvertible } from '@inertiajs/core';
import Button from '@/Shared/UI/Button/Button';
import Modal from '@/Shared/UI/Modal/Modal';
import Switch from '@/Shared/UI/Switch/Switch';
import CustomSelect from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/NodeConfigModal/components/CustomSelect/CustomSelect';
import CreateMailboxModal from '@/Domains/Mailbox/Pages/CreateMailboxModal/CreateMailboxModal';
import type { CreatedMailbox, MailboxDomain } from '@/Domains/Mailbox/types';
import type { VisibilityPickerValue } from '@proprietary/Domains/Flow/Components/VisibilityPicker/VisibilityPicker.pp';
import { useResetOnOpen } from '@/Shared/Hooks/useResetOnOpen';
import type { FolderTree, TeamTree } from '@/Domains/Folder/types';
import FlowPreview from './components/FlowPreview/FlowPreview';
import ImportError from './components/ImportError/ImportError';
import ImportTargetFields from './components/ImportTargetFields/ImportTargetFields';
import SourceFileInput from './components/SourceFileInput/SourceFileInput';
import * as S from './styled';
import {
    baseNameFromFile,
    buildInitialVisibility,
    labelFromCode,
    metadataFromCode,
    metadataFromJson,
    parseFlowFile,
    titleFromBaseName,
    type ParsedFlowFile,
} from './utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    personalTree?: FolderTree[];
    workspaceTree?: FolderTree[];
    teamTrees?: TeamTree[];
    defaultVisibility?: VisibilityPickerValue['visibility'];
    defaultFolderId?: Id | null;
    defaultTeamId?: Id | null;
}

interface ImportMailboxOption {
    id: Id;
    address: string;
    group: string | null;
}

interface ImportMailboxResources {
    mailboxes: ImportMailboxOption[];
    domains: Pick<MailboxDomain, 'id' | 'name'>[];
}

const fetchImportMailboxResources = async (): Promise<ImportMailboxResources> => {
    const response = await fetch('/flows/import-mailboxes');
    if (!response.ok) throw new Error();
    const result = await response.json() as Partial<ImportMailboxResources>;

    return {
        mailboxes: result.mailboxes ?? [],
        domains: result.domains ?? [],
    };
};

export default function FlowImportModal({
    isOpen,
    onClose,
    personalTree = [],
    workspaceTree = [],
    teamTrees = [],
    defaultVisibility = 'owner',
    defaultFolderId = null,
    defaultTeamId = null,
}: Props) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [defaultInputs, setDefaultInputs] = useState<Record<string, unknown> | null>(null);
    const [parsedFile, setParsedFile] = useState<ParsedFlowFile | null>(null);
    const [createDataTables, setCreateDataTables] = useState(false);
    const [createMailboxWatchers, setCreateMailboxWatchers] = useState(false);
    const [mailboxOptions, setMailboxOptions] = useState<ImportMailboxOption[]>([]);
    const [mailboxDomains, setMailboxDomains] = useState<Pick<MailboxDomain, 'id' | 'name'>[]>([]);
    const [mailboxMappings, setMailboxMappings] = useState<Record<string, string>>({});
    const [mailboxCreationOpen, setMailboxCreationOpen] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [visibility, setVisibility] = useState<VisibilityPickerValue>(() => buildInitialVisibility(defaultVisibility, defaultFolderId, defaultTeamId));
    const [dragging, setDragging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const fileReadId = useRef(0);
    const mailboxCreationResolver = useRef<((mailboxId: string | null) => void) | null>(null);

    useResetOnOpen(isOpen, () => {
        fileReadId.current += 1;
        setName('');
        setDescription('');
        setDefaultInputs(null);
        setParsedFile(null);
        setCreateDataTables(false);
        setCreateMailboxWatchers(false);
        setMailboxOptions([]);
        setMailboxDomains([]);
        setMailboxMappings({});
        mailboxCreationResolver.current?.(null);
        mailboxCreationResolver.current = null;
        setMailboxCreationOpen(false);
        setFileName(null);
        setVisibility(buildInitialVisibility(defaultVisibility, defaultFolderId, defaultTeamId));
        setDragging(false);
        setSubmitting(false);
        setSubmitError(null);
    });

    const readFile = async (file: File) => {
        const requestId = ++fileReadId.current;
        try {
            const content = await file.text();
            if (requestId !== fileReadId.current) return;
            const parsed = parseFlowFile(content, file.name);
            const baseName = baseNameFromFile(file.name);
            const fallbackName = titleFromBaseName(baseName);
            const metadata = parsed.flowType === 'code' ? metadataFromCode(content) : metadataFromJson(content);

            let mailboxLoadError: string | null = null;
            if (parsed.mailboxWatchers.length > 0) {
                let options: ImportMailboxOption[] = [];
                let domains: Pick<MailboxDomain, 'id' | 'name'>[] = [];
                try {
                    const resources = await fetchImportMailboxResources();
                    options = resources.mailboxes;
                    domains = resources.domains;
                } catch {
                    mailboxLoadError = 'Unable to load available mailboxes. You can still import without creating Mailbox Watchers.';
                }
                if (requestId !== fileReadId.current) return;
                const mappings = Object.fromEntries(parsed.mailboxWatchers.map(watcher => {
                    const address = watcher.mailbox.address.trim().toLowerCase();
                    const match = options.find(option => option.address.trim().toLowerCase() === address);
                    return [watcher.mailbox.source_id, match ? String(match.id) : ''];
                }));
                setMailboxOptions(options);
                setMailboxDomains(domains);
                setMailboxMappings(mappings);
            } else {
                setMailboxOptions([]);
                setMailboxDomains([]);
                setMailboxMappings({});
            }
            setFileName(file.name);
            setParsedFile(parsed);
            setCreateDataTables(false);
            setCreateMailboxWatchers(false);
            setName(metadata.title || (parsed.flowType === 'code' ? labelFromCode(content, fallbackName) : fallbackName));
            setDescription(metadata.description || '');
            setDefaultInputs(metadata.defaultInputs ?? null);
            setSubmitError(mailboxLoadError);
        } catch (error) {
            if (requestId !== fileReadId.current) return;
            setFileName(file.name);
            setParsedFile(null);
            setSubmitError(error instanceof Error ? error.message : 'Unable to read this flow file.');
        }
    };

    const createMailbox = () => new Promise<string | null>(resolve => {
        mailboxCreationResolver.current = resolve;
        setMailboxCreationOpen(true);
    });

    const closeMailboxCreation = () => {
        setMailboxCreationOpen(false);
        mailboxCreationResolver.current?.(null);
        mailboxCreationResolver.current = null;
    };

    const handleMailboxCreated = async (mailbox: CreatedMailbox) => {
        const mailboxId = String(mailbox.id);
        try {
            const resources = await fetchImportMailboxResources();
            setMailboxOptions(resources.mailboxes);
            setMailboxDomains(resources.domains);
        } catch {
            setMailboxOptions(current => [
                ...current.filter(option => String(option.id) !== mailboxId),
                {
                    id: mailbox.id,
                    address: `${mailbox.slug}@${mailbox.domain.name}`,
                    group: null,
                },
            ]);
        }
        setMailboxCreationOpen(false);
        mailboxCreationResolver.current?.(mailboxId);
        mailboxCreationResolver.current = null;
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitError(null);

        if (!parsedFile) {
            setSubmitError('Drop a JavaScript or JSON flow file before importing.');
            return;
        }

        if (!name.trim()) {
            setSubmitError('Flow name is required.');
            return;
        }

        if (visibility.visibility === 'team' && !visibility.teamId) {
            setSubmitError('Select a team for team visibility.');
            return;
        }

        if (
            createMailboxWatchers
            && parsedFile.mailboxWatchers.some(watcher => !mailboxMappings[watcher.mailbox.source_id])
        ) {
            setSubmitError('Select a destination mailbox for every referenced Mailbox Watcher.');
            return;
        }

        const payload: Record<string, FormDataConvertible> = {
            name: name.trim(),
            description: description.trim() || null,
            visibility: visibility.visibility,
            source_type: 'code',
            flow_type: parsedFile.flowType,
            code: parsedFile.code,
            default_inputs: defaultInputs as FormDataConvertible,
        };

        if (parsedFile.flowType === 'nodal') {
            payload.nodal_graph = parsedFile.nodalGraph;
        }
        if (createDataTables && parsedFile.dataTables.length > 0) {
            payload.create_data_tables = true;
            payload.data_table_schemas = parsedFile.dataTables as unknown as FormDataConvertible;
        }
        if (createMailboxWatchers && parsedFile.mailboxWatchers.length > 0) {
            payload.create_mailbox_watchers = true;
            payload.mailbox_watcher_schemas = parsedFile.mailboxWatchers as unknown as FormDataConvertible;
            payload.mailbox_mappings = mailboxMappings as FormDataConvertible;
        }

        if (visibility.visibility === 'owner') {
            payload.folder_id = visibility.personalFolderId;
        } else if (visibility.visibility === 'workspace') {
            payload.workspace_folder_id = visibility.wsFolderId;
        } else {
            payload.team_id = visibility.teamId;
            payload.workspace_folder_id = visibility.teamFolderId
                ?? teamTrees.find(team => team.id === visibility.teamId)?.root_folder_id
                ?? null;
        }

        setSubmitting(true);
        router.post('/flows', payload, {
            onError: errors => {
                setSubmitError(Object.values(errors)[0] || 'Import failed.');
            },
            onSuccess: () => {
                onClose();
            },
            onFinish: () => {
                setSubmitting(false);
            },
        });
    };

    return (
        <>
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Import Flow"
            caption={fileName ?? 'Configure and review the flow before importing'}
            fullScreen
        >
            <S.ImportForm onSubmit={handleSubmit}>
                <S.ImportLayout>
                    <S.FormPanel>
                        <S.FormScroller>
                            <SourceFileInput
                                fileName={fileName}
                                dragging={dragging}
                                hasError={!!submitError && !parsedFile}
                                onDraggingChange={setDragging}
                                onFile={readFile}
                            />

                            {parsedFile && (
                                <>
                                    <ImportTargetFields
                                        name={name}
                                        description={description}
                                        parsedFile={parsedFile}
                                        visibility={visibility}
                                        personalTree={personalTree}
                                        workspaceTree={workspaceTree}
                                        teamTrees={teamTrees}
                                        onNameChange={setName}
                                        onDescriptionChange={setDescription}
                                        onVisibilityChange={setVisibility}
                                    />
                                    {parsedFile.dataTables.length > 0 && (
                                        <S.ResourceImportOption htmlFor="create-referenced-data-tables">
                                            <Switch
                                                id="create-referenced-data-tables"
                                                checked={createDataTables}
                                                onChange={setCreateDataTables}
                                                ariaLabel="Create referenced Data Tables"
                                            />
                                            <S.ResourceImportText>
                                                <S.ResourceImportTitle>Create referenced Data Tables</S.ResourceImportTitle>
                                                <S.ResourceImportDescription>
                                                    Create {parsedFile.dataTables.length} Data Table
                                                    {parsedFile.dataTables.length === 1 ? '' : 's'} with the imported flow.
                                                </S.ResourceImportDescription>
                                            </S.ResourceImportText>
                                        </S.ResourceImportOption>
                                    )}
                                    {parsedFile.mailboxWatchers.length > 0 && (
                                        <S.MailboxImportOption>
                                            <S.ResourceImportHeader htmlFor="create-referenced-mailbox-watchers">
                                                <Switch
                                                    id="create-referenced-mailbox-watchers"
                                                    checked={createMailboxWatchers}
                                                    onChange={setCreateMailboxWatchers}
                                                    ariaLabel="Create referenced Mailbox Watchers"
                                                />
                                                <S.ResourceImportText>
                                                    <S.ResourceImportTitle>Create referenced Mailbox Watchers</S.ResourceImportTitle>
                                                    <S.ResourceImportDescription>
                                                        Create {parsedFile.mailboxWatchers.length} Mailbox Watcher
                                                        {parsedFile.mailboxWatchers.length === 1 ? '' : 's'} with the imported flow.
                                                    </S.ResourceImportDescription>
                                                </S.ResourceImportText>
                                            </S.ResourceImportHeader>
                                            {createMailboxWatchers && (
                                                <S.MailboxMappings>
                                                    {[...new Map(parsedFile.mailboxWatchers.map(watcher => [
                                                        watcher.mailbox.source_id,
                                                        watcher.mailbox,
                                                    ])).values()].map(mailbox => (
                                                        <S.MailboxMapping key={mailbox.source_id}>
                                                            <S.MailboxMappingLabel>Select destination mailbox</S.MailboxMappingLabel>
                                                            <CustomSelect
                                                                value={mailboxMappings[mailbox.source_id] ?? ''}
                                                                options={mailboxOptions.map(option => ({
                                                                    value: String(option.id),
                                                                    label: option.address,
                                                                    group: option.group || 'Ungrouped',
                                                                }))}
                                                                placeholder="Select destination mailbox"
                                                                searchThreshold={0}
                                                                showOptionValue={false}
                                                                actionSlot={mailboxDomains.length > 0 ? {
                                                                    label: '+ Add Mailbox',
                                                                    onAction: createMailbox,
                                                                } : undefined}
                                                                onChange={value => setMailboxMappings(current => ({
                                                                    ...current,
                                                                    [mailbox.source_id]: value,
                                                                }))}
                                                            />
                                                        </S.MailboxMapping>
                                                    ))}
                                                </S.MailboxMappings>
                                            )}
                                        </S.MailboxImportOption>
                                    )}
                                </>
                            )}

                            {submitError && <ImportError message={submitError} />}
                        </S.FormScroller>
                        <S.Footer>
                            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button type="submit" loading={submitting} disabled={!parsedFile || !name.trim()}>
                                Import
                            </Button>
                        </S.Footer>
                    </S.FormPanel>
                    <S.PreviewPanel>
                        {parsedFile ? (
                            <FlowPreview parsedFile={parsedFile} />
                        ) : (
                            <S.PreviewPlaceholder>
                                <S.PreviewPlaceholderTitle>Flow preview</S.PreviewPlaceholderTitle>
                                <S.PreviewPlaceholderText>
                                    Select a JavaScript or JSON flow to inspect it before import.
                                </S.PreviewPlaceholderText>
                            </S.PreviewPlaceholder>
                        )}
                    </S.PreviewPanel>
                </S.ImportLayout>
            </S.ImportForm>
        </Modal>
        <CreateMailboxModal
            isOpen={mailboxCreationOpen}
            onClose={closeMailboxCreation}
            domains={mailboxDomains}
            teams={teamTrees.map(team => ({ id: team.id, name: team.name }))}
            groups={[...new Set(mailboxOptions
                .map(option => option.group)
                .filter((group): group is string => Boolean(group)))]}
            onCreated={mailbox => void handleMailboxCreated(mailbox)}
            zIndex={1100}
            quickMode
        />
        </>
    );
}
