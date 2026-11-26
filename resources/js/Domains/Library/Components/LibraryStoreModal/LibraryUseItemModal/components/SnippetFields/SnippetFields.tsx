import React, { useEffect, useState } from 'react';
import Input from '@/Shared/UI/Input/Input';
import GroupField from '@/Shared/UI/GroupField/GroupField';
import type { LibraryUseFormData } from '@/Domains/Library/Components/LibraryStoreModal/types';
import { requestLibraryJson } from '@/Domains/Library/Components/LibraryStoreModal/utils';
import * as S from './styled';

interface Props {
    isOpen: boolean;
    label: LibraryUseFormData['label'];
    group: LibraryUseFormData['group'];
    onLabelChange: (value: LibraryUseFormData['label']) => void;
    onGroupChange: (value: LibraryUseFormData['group']) => void;
}

export default function SnippetFields({
    isOpen,
    label,
    group,
    onLabelChange,
    onGroupChange,
}: Props) {
    const [groups, setGroups] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        requestLibraryJson<string[]>('/snippets/groups', { signal: controller.signal })
            .then(setGroups)
            .catch(() => setGroups([]));

        return () => controller.abort();
    }, [isOpen]);

    return (
        <>
            <S.Fields>
                <Input
                    label="Label"
                    value={label}
                    onChange={event => onLabelChange(event.target.value)}
                    placeholder="My snippet"
                    autoFocus
                />
            </S.Fields>
            <GroupField
                value={group}
                groups={groups}
                isModalOpen={isOpen}
                onChange={onGroupChange}
            />
        </>
    );
}
