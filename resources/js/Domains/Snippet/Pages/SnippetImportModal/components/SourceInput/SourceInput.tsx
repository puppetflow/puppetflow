import FileDropZone from '@/Shared/UI/FileDropZone/FileDropZone';

interface Props {
    fileName: string | null;
    hasError: boolean;
    onFile: (file: File) => Promise<void>;
}

export default function SourceInput({ fileName, hasError, onFile }: Props) {
    return (
        <FileDropZone
            title={fileName || 'Drop a JavaScript or nodal JSON snippet here'}
            hint="or click to choose a file. The filename is used as the default reference."
            accept=".js,.mjs,.json,.txt,text/javascript,application/javascript,application/json,text/plain"
            hasError={hasError}
            onFiles={([file]) => void onFile(file)}
        />
    );
}
