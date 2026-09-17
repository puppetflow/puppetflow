import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useGlobalDragReset } from '@/Shared/Explorer/useGlobalDragReset';
import { Icon } from '@/Shared/UI/Icon/Icon';
import * as S from './styled';

interface Props {
    title: ReactNode;
    hint?: ReactNode;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    hasError?: boolean;
    icon?: string;
    onFiles: (files: File[]) => void;
}

function accepts(file: File, accept?: string): boolean {
    if (!accept) return true;
    const filename = file.name.toLowerCase();
    const mime = file.type.toLowerCase();

    return accept.split(',').some(raw => {
        const rule = raw.trim().toLowerCase();
        if (rule.startsWith('.')) return filename.endsWith(rule);
        if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1));
        return rule !== '' && mime === rule;
    });
}

/** Click-or-drop file picker with a dashed target. */
export default function FileDropZone({
    title,
    hint,
    accept,
    multiple = false,
    disabled = false,
    hasError = false,
    icon = 'lucide:upload-cloud',
    onFiles,
}: Props) {
    const [dragging, setDragging] = useState(false);
    const [rejected, setRejected] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const resetDragging = useCallback(() => setDragging(false), []);
    useGlobalDragReset(resetDragging);

    const emit = (list: FileList | null) => {
        const files = Array.from(list ?? []);
        if (files.length === 0 || disabled) return;
        if (files.some(file => !accepts(file, accept))) {
            setRejected(true);
            return;
        }
        setRejected(false);
        onFiles(multiple ? files : files.slice(0, 1));
    };

    return (
        <S.DropZone
            $dragging={dragging}
            $hasError={hasError || rejected}
            $disabled={disabled}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-invalid={hasError || rejected}
            onKeyDown={event => {
                if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onDragOver={event => {
                event.preventDefault();
                if (!disabled) setDragging(true);
            }}
            onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resetDragging();
            }}
            onDrop={event => {
                event.preventDefault();
                resetDragging();
                emit(event.dataTransfer.files);
            }}
        >
            <Icon icon={icon} width={24} />
            <S.DropTitle>{title}</S.DropTitle>
            {(hint || rejected) && (
                <S.DropHint>{rejected ? 'This file type is not accepted.' : hint}</S.DropHint>
            )}
            <S.HiddenFileInput
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                onChange={event => {
                    emit(event.target.files);
                    event.target.value = '';
                }}
            />
        </S.DropZone>
    );
}
