import FileDropZone from '@/Shared/UI/FileDropZone/FileDropZone';
import Switch from '@/Shared/UI/Switch/Switch';
import * as S from './styled';

interface Props {
    raw: string;
    fileName: string | null;
    showEditor: boolean;
    accept: string;
    title: string;
    hint: string;
    placeholder: string;
    hasFileError?: boolean;
    hasContentError?: boolean;
    onSourceChange: (raw: string, fileName: string | null) => void;
    onEditorToggle: (showEditor: boolean) => void;
}

export default function TextFileImportInput({
    raw,
    fileName,
    showEditor,
    accept,
    title,
    hint,
    placeholder,
    hasFileError = false,
    hasContentError = false,
    onSourceChange,
    onEditorToggle,
}: Props) {
    const readFile = async (file: File) => {
        onSourceChange(await file.text(), file.name);
    };

    return (
        <>
            {!showEditor && (
                <FileDropZone
                    title={fileName || title}
                    hint={hint}
                    accept={accept}
                    hasError={hasFileError}
                    onFiles={([file]) => void readFile(file)}
                />
            )}

            <S.EditorToggle>
                <Switch
                    checked={showEditor}
                    onChange={onEditorToggle}
                    label="Paste or edit the content manually"
                />
            </S.EditorToggle>

            {showEditor && (
                <S.Editor
                    value={raw}
                    onChange={event => onSourceChange(event.target.value, null)}
                    $hasError={hasContentError}
                    placeholder={placeholder}
                />
            )}
        </>
    );
}
