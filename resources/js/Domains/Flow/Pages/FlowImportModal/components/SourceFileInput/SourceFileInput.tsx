import FileDropZone from '@/Shared/UI/FileDropZone/FileDropZone';

interface Props {
    fileName: string | null;
    hasError: boolean;
    onFile: (file: File) => void | Promise<void>;
}

export default function SourceFileInput({
    fileName,
    hasError,
    onFile,
}: Props) {
    return (
        <FileDropZone
            title={fileName || 'Drop a JavaScript or JSON flow file here'}
            hint="or click to choose a file. JavaScript imports as raw code, JSON imports as Visual Builder graph."
            accept=".js,.mjs,.json,.txt,text/javascript,application/javascript,application/json,text/plain"
            hasError={hasError}
            onFiles={([file]) => void onFile(file)}
        />
    );
}
