import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from 'react';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { useToast } from '@/App/Hooks/useToast';
import type { MediaAsset } from '@/Domains/Media/types';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import { csrfHeaders } from '@/Shared/Utils/csrf';
import * as S from './styled';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    css: 'css',
    csv: 'plaintext',
    htm: 'html',
    html: 'html',
    js: 'javascript',
    json: 'json',
    jsonl: 'json',
    jsx: 'javascript',
    md: 'markdown',
    ndjson: 'json',
    php: 'php',
    py: 'python',
    sh: 'shell',
    sql: 'sql',
    svg: 'xml',
    toml: 'ini',
    ts: 'typescript',
    tsx: 'typescript',
    txt: 'plaintext',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
};

function responseError(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') return fallback;
    const response = payload as { message?: unknown; errors?: Record<string, unknown> };
    const contentError = response.errors?.content;
    if (Array.isArray(contentError) && typeof contentError[0] === 'string') return contentError[0];
    return typeof response.message === 'string' ? response.message : fallback;
}

export interface TextMediaEditorHandle {
    save: () => Promise<boolean>;
}

export interface TextMediaEditorState {
    loading: boolean;
    saving: boolean;
    dirty: boolean;
}

interface Props {
    item: MediaAsset;
    onStateChange?: (state: TextMediaEditorState) => void;
}

const TextMediaEditor = forwardRef<TextMediaEditorHandle, Props>(function TextMediaEditor(
    { item, onStateChange },
    ref,
) {
    const { resolved } = useThemeMode();
    const { toast } = useToast();
    const [content, setContent] = useState('');
    const [savedContent, setSavedContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const endpoint = `/media-library/media/${item.id}/content`;
    const language = useMemo(
        () => LANGUAGE_BY_EXTENSION[(item.extension ?? '').toLowerCase()] ?? 'plaintext',
        [item.extension],
    );
    const dirty = content !== savedContent;

    useEffect(() => {
        onStateChange?.({ loading, saving, dirty });
    }, [dirty, loading, onStateChange, saving]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        setContent('');
        setSavedContent('');
        fetch(endpoint, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            signal: controller.signal,
        })
            .then(async response => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(responseError(payload, 'The text file could not be loaded.'));
                const value = (payload as { content?: unknown }).content;
                if (typeof value !== 'string') throw new Error('The server returned invalid text content.');
                setContent(value);
                setSavedContent(value);
            })
            .catch(exception => {
                if (exception instanceof DOMException && exception.name === 'AbortError') return;
                setError(exception instanceof Error ? exception.message : 'The text file could not be loaded.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [endpoint]);

    const save = useCallback(async (): Promise<boolean> => {
        if (!item.can_manage || saving || !dirty) return true;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers: { ...csrfHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) throw new Error(responseError(payload, 'The text file could not be saved.'));
            setSavedContent(content);
            return true;
        } catch (exception) {
            const message = exception instanceof Error ? exception.message : 'The text file could not be saved.';
            setError(message);
            toast(message, 'error');
            return false;
        } finally {
            setSaving(false);
        }
    }, [content, dirty, endpoint, item.can_manage, saving, toast]);

    useImperativeHandle(ref, () => ({ save }), [save]);

    if (loading) return <S.EditorMessage>Loading text file...</S.EditorMessage>;
    if (error && content === '') return <S.EditorMessage $error>{error}</S.EditorMessage>;

    return (
        <S.TextEditor>
            <S.EditorToolbar>
                <S.EditorStatus $status={error ? 'error' : dirty ? 'dirty' : 'saved'}>
                    {error ?? (dirty ? 'Unsaved changes' : 'Saved')}
                </S.EditorStatus>
            </S.EditorToolbar>
            <S.EditorSurface>
                <CodeEditor
                    height="100%"
                    language={language}
                    theme={resolved === 'dark' ? 'vs-dark' : 'light'}
                    value={content}
                    onChange={value => setContent(value ?? '')}
                    options={{
                        automaticLayout: true,
                        fontSize: 13,
                        minimap: { enabled: false },
                        padding: { top: 12 },
                        readOnly: !item.can_manage,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                    }}
                />
            </S.EditorSurface>
        </S.TextEditor>
    );
});

export default TextMediaEditor;
