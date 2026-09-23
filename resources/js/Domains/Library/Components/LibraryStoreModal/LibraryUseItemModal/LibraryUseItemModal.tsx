import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/Shared/UI/Modal/Modal';
import { TextArea } from '@/Shared/UI/Input/Input';
import Button from '@/Shared/UI/Button/Button';
import Switch from '@/Shared/UI/Switch/Switch';
import { Icon } from '@/Shared/UI/Icon/Icon';
import FlowPreview from '@/Domains/Flow/Pages/FlowImportModal/components/FlowPreview/FlowPreview';
import * as ImportS from '@/Domains/Flow/Pages/FlowImportModal/styled';
import VisibilityPicker, { type VisibilityPickerValue } from '@proprietary/Domains/Flow/Components/VisibilityPicker/VisibilityPicker.pp';
import UserPicker from '@/Shared/UI/UserPicker/UserPicker';
import type { FolderTree, TeamTree } from '@/Domains/Folder/types';
import type { LibraryCollection, LibraryStoreChild, LibraryStoreItem, LibraryTeamOption, LibraryUseFormData } from '@/Domains/Library/Components/LibraryStoreModal/types';
import FlowFields from './components/FlowFields/FlowFields';
import SnippetFields from './components/SnippetFields/SnippetFields';
import SnippetScopePicker from './components/SnippetScopePicker/SnippetScopePicker';
import * as S from './styled';

interface Props {
    isOpen: boolean;
    blueprint: LibraryStoreItem;
    collection: LibraryCollection;
    child: LibraryStoreChild;
    teams: LibraryTeamOption[];
    personalTree?: FolderTree[];
    workspaceTree?: FolderTree[];
    teamTrees?: TeamTree[];
    submitting: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (data: LibraryUseFormData) => void;
}

const INITIAL_VISIBILITY: VisibilityPickerValue = {
    visibility: 'owner',
    personalFolderId: null,
    wsFolderId: null,
    teamId: null,
    teamFolderId: null,
};

export default function LibraryUseItemModal({
    isOpen,
    blueprint,
    collection,
    child,
    teams,
    personalTree = [],
    workspaceTree = [],
    teamTrees,
    submitting,
    error,
    onClose,
    onSubmit,
}: Props) {
    const isFlow = collection === 'flows';
    const itemType = isFlow ? child.flow_type : child.snippet_type;
    const initial = useMemo<LibraryUseFormData>(() => ({
        name: child.label,
        label: child.label,
        description: child.description || blueprint.description || '',
        group: blueprint.category || '',
        scope: 'owner',
        team_id: null,
        owner_id: null,
        folder_id: null,
        workspace_folder_id: null,
        include_snippets: true,
    }), [blueprint.category, blueprint.description, child.description, child.label]);

    const [form, setForm] = useState<LibraryUseFormData>(initial);
    const [visibility, setVisibility] = useState<VisibilityPickerValue>(INITIAL_VISIBILITY);

    useEffect(() => {
        if (isOpen) {
            setForm(initial);
            setVisibility(INITIAL_VISIBILITY);
        }
    }, [initial, isOpen]);

    // Pages that do not load folder trees still know the teams: give the
    // picker root-only team trees so the team selector keeps working.
    const effectiveTeamTrees = useMemo<TeamTree[]>(
        () => teamTrees ?? teams.map(team => ({ id: team.id, name: team.name, root_folder_id: null, tree: [], rootItems: [] })),
        [teamTrees, teams],
    );

    const dependencies = useMemo(() => (
        (child.snippet_dependencies ?? []).map(reference => (
            blueprint.snippets.find(snippet => snippet.reference === reference)
            ?? { reference, label: reference, is_installed: false } as Pick<LibraryStoreChild, 'reference' | 'label' | 'is_installed'>
        ))
    ), [blueprint.snippets, child.snippet_dependencies]);
    const newDependencies = dependencies.filter(dependency => !dependency.is_installed);

    const update = <K extends keyof LibraryUseFormData>(key: K, value: LibraryUseFormData[K]) => {
        setForm(current => ({ ...current, [key]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const selectedTeam = effectiveTeamTrees.find(team => team.id === visibility.teamId);
        onSubmit({
            ...form,
            scope: visibility.visibility,
            team_id: visibility.visibility === 'team' ? visibility.teamId : null,
            folder_id: visibility.visibility === 'owner' ? visibility.personalFolderId : null,
            workspace_folder_id: visibility.visibility === 'workspace'
                ? visibility.wsFolderId
                : visibility.visibility === 'team'
                    ? (visibility.teamFolderId ?? selectedTeam?.root_folder_id ?? null)
                    : null,
        });
    };

    const submitDisabled = (isFlow ? !form.name.trim() : !form.label.trim())
        || (visibility.visibility === 'team' && !visibility.teamId);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={child.label}
            caption={`Configure this ${isFlow ? 'flow' : 'snippet'} before importing it into this workspace.`}
            fullScreen
        >
            <S.Form onSubmit={handleSubmit}>
                <S.Layout>
                    <S.FormPanel>
                        <S.FormScroller>
                            {dependencies.length > 0 && (
                                <>
                                    <ImportS.ResourceImportCard>
                                        <ImportS.ResourceImportHeader htmlFor="library-include-snippets">
                                            <Switch
                                                id="library-include-snippets"
                                                checked={form.include_snippets}
                                                onChange={value => update('include_snippets', value)}
                                                ariaLabel="Import referenced snippets"
                                            />
                                            <ImportS.ResourceImportText>
                                                <ImportS.ResourceImportTitle>Import referenced snippets</ImportS.ResourceImportTitle>
                                                <ImportS.ResourceImportDescription>
                                                    {newDependencies.length > 0
                                                        ? `Create ${newDependencies.length} snippet${newDependencies.length === 1 ? '' : 's'} from this blueprint with the imported ${isFlow ? 'flow' : 'snippet'}.`
                                                        : 'Every referenced snippet is already in use in this workspace.'}
                                                    {' '}Snippets already in use are reused, not duplicated.
                                                </ImportS.ResourceImportDescription>
                                            </ImportS.ResourceImportText>
                                        </ImportS.ResourceImportHeader>
                                        {form.include_snippets && (
                                            <ImportS.ResourceImportDetails>
                                                {dependencies.map(dependency => (
                                                    <ImportS.DataTableImportItem key={dependency.reference}>
                                                        <ImportS.DataTableImportName>
                                                            <S.DependencyIcon>
                                                                <Icon icon="lucide:puzzle" width={12} />
                                                            </S.DependencyIcon>
                                                            {dependency.label}
                                                        </ImportS.DataTableImportName>
                                                        <S.DependencyState $installed={Boolean(dependency.is_installed)}>
                                                            {dependency.is_installed ? 'In use, reused' : 'New'}
                                                        </S.DependencyState>
                                                    </ImportS.DataTableImportItem>
                                                ))}
                                            </ImportS.ResourceImportDetails>
                                        )}
                                    </ImportS.ResourceImportCard>
                                    <ImportS.ImportSectionDivider role="separator" />
                                </>
                            )}

                            {isFlow ? (
                                <FlowFields
                                    name={form.name}
                                    onNameChange={value => update('name', value)}
                                />
                            ) : (
                                <SnippetFields
                                    label={form.label}
                                    group={form.group}
                                    onLabelChange={value => update('label', value)}
                                    onGroupChange={value => update('group', value)}
                                />
                            )}

                            <TextArea
                                label="Description"
                                value={form.description}
                                onChange={event => update('description', event.target.value)}
                                placeholder={isFlow ? 'What does this flow do?' : 'What does this snippet do?'}
                                rows={3}
                            />

                            {isFlow ? (
                                <VisibilityPicker
                                    value={visibility}
                                    onChange={setVisibility}
                                    personalTree={personalTree}
                                    workspaceTree={workspaceTree}
                                    teamTrees={effectiveTeamTrees}
                                    ownerId={form.owner_id}
                                    ownerChanged={form.owner_id !== null}
                                />
                            ) : (
                                <SnippetScopePicker
                                    value={visibility}
                                    teamTrees={effectiveTeamTrees}
                                    onChange={setVisibility}
                                />
                            )}

                            <ImportS.ImportSectionDivider role="separator" />

                            <S.OwnerSection>
                                <S.OwnerLabel>Owner</S.OwnerLabel>
                                <UserPicker
                                    value={form.owner_id}
                                    onChange={value => {
                                        update('owner_id', value);
                                        // The picked personal folder belongs to the current
                                        // user's tree; another owner starts at their root.
                                        setVisibility(current => ({ ...current, personalFolderId: null }));
                                    }}
                                    placeholder="Myself (default)"
                                    portal
                                />
                            </S.OwnerSection>

                            {error && <S.ErrorBox>{error}</S.ErrorBox>}
                        </S.FormScroller>
                        <S.Footer>
                            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="secondary"
                                loading={submitting}
                                disabled={submitDisabled}
                            >
                                Confirm
                            </Button>
                        </S.Footer>
                    </S.FormPanel>
                    <S.PreviewPanel>
                        <FlowPreview
                            source={{
                                flowType: itemType === 'nodal' && child.nodal_graph ? 'nodal' : 'code',
                                code: child.code ?? '',
                                nodalGraph: child.nodal_graph ?? null,
                                graphContext: isFlow ? 'flow' : 'function',
                                documentExtension: isFlow ? 'flow' : 'snippet',
                            }}
                        />
                    </S.PreviewPanel>
                </S.Layout>
            </S.Form>
        </Modal>
    );
}
