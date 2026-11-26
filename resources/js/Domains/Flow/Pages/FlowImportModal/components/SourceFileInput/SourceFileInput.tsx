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
            title={fileName || 'Drop a JavaScript, JSON or ZIP flow file here'}
            hint="or click to choose a file. JavaScript imports as raw code, JSON imports as Visual Builder graph, ZIP imports a downloaded flow with its snippets."
            accept=".js,.mjs,.json,.txt,.zip,text/javascript,application/javascript,application/json,text/plain,application/zip"
            hasError={hasError}
            onFiles={([file]) => void onFile(file)}
        />
    );
}
