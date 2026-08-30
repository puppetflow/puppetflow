import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { router } from '@inertiajs/react';
import { useBeforeUnloadProtection } from '@/Shared/Hooks/useBeforeUnloadProtection';

interface Options {
    dirty: boolean;
    draftKey: string;
    autosaveEnabled: boolean;
    dirtyRef: MutableRefObject<boolean>;
}

const AUTOSAVE_DELAY_MS = 1000;

// Protects unsaved snippet edits and routes keyboard saves through the controller.
export function useSnippetDirtyProtection({ dirty, draftKey, autosaveEnabled, dirtyRef }: Options) {
    const [justSaved, setJustSaved] = useState(false);
    const justSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const allowNavigationRef = useRef(false);
    const saveRef = useRef<() => Promise<boolean>>(async () => false);
    const flush = useCallback(async () => {
        let saved = true;
        do {
            saved = await saveRef.current();
        } while (saved && dirtyRef.current);
        return saved;
    }, [dirtyRef]);

    const markJustSaved = useCallback(() => {
        setJustSaved(true);
        if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
        justSavedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    }, []);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault();
                if (dirty) void saveRef.current();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [dirty]);

    useEffect(() => {
        if (!dirty || !autosaveEnabled) return;

        autosaveTimer.current = setTimeout(() => {
            autosaveTimer.current = null;
            void saveRef.current();
        }, AUTOSAVE_DELAY_MS);

        return () => {
            if (autosaveTimer.current) {
                clearTimeout(autosaveTimer.current);
                autosaveTimer.current = null;
            }
        };
    }, [autosaveEnabled, dirty, draftKey]);

    useEffect(() => {
        if (!dirty) return;

        return router.on('before', event => {
            const visit = event.detail.visit;
            const isCurrentPage = visit.url.pathname === window.location.pathname
                && visit.url.search === window.location.search;
            const isSnippetMutation = visit.method !== 'get'
                && visit.url.pathname.startsWith('/snippets');
            if (allowNavigationRef.current || visit.prefetch || isCurrentPage || isSnippetMutation) return;

            event.preventDefault();
            void flush().then(saved => {
                if (!saved) return;
                allowNavigationRef.current = true;
                router.visit(visit.url, {
                    method: visit.method,
                    data: visit.data,
                    replace: visit.replace,
                    preserveScroll: visit.preserveScroll,
                    preserveState: visit.preserveState,
                    only: visit.only,
                    except: visit.except,
                    headers: visit.headers,
                    errorBag: visit.errorBag,
                    forceFormData: visit.forceFormData,
                    queryStringArrayFormat: visit.queryStringArrayFormat,
                    async: visit.async,
                    showProgress: visit.showProgress,
                    fresh: visit.fresh,
                    reset: visit.reset,
                    preserveUrl: visit.preserveUrl,
                    invalidateCacheTags: visit.invalidateCacheTags,
                    viewTransition: visit.viewTransition,
                    onFinish: () => {
                        allowNavigationRef.current = false;
                    },
                });
            });
        });
    }, [dirty, flush]);

    useBeforeUnloadProtection({ active: dirty });

    useEffect(() => {
        return () => {
            if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
            if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        };
    }, []);

    return { justSaved, markJustSaved, saveRef, flush };
}
