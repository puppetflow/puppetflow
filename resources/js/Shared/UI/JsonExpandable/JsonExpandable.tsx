import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { CodeEditor } from '@/Shared/CodeEditor/components/CodeEditor';
import Modal from '@/Shared/UI/Modal/Modal';
import { useThemeMode } from '@/App/Hooks/useThemeMode';
import { ExpandBtn, FullEditorWrap, TopBar, Wrapper } from './styled';

interface Props {
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
    title?: string;
    hideDefaultTrigger?: boolean;
    openRef?: React.MutableRefObject<(() => void) | null>;
    children: React.ReactNode;
}

export default function JsonExpandable({ value, onChange, readOnly, title, hideDefaultTrigger, openRef, children }: Props) {
    const [open, setOpen] = useState(false);
    const { resolved: resolvedTheme } = useThemeMode();
    const handleFullChange = useCallback((v: string | undefined) => {
        onChange?.(v || '{}');
    }, [onChange]);

    useEffect(() => {
        if (!openRef) return;
        openRef.current = () => setOpen(true);
        return () => {
            openRef.current = null;
        };
    }, [openRef]);

    return (
        <Wrapper>
            {!hideDefaultTrigger && (
                <TopBar>
                    <ExpandBtn type="button" onClick={() => setOpen(true)} title="Open in fullscreen">
                        <Icon icon="lucide:external-link" width={12} height={12} />
                    </ExpandBtn>
                </TopBar>
            )}
            {children}
            {open && (
                <Modal isOpen onClose={() => setOpen(false)} title={title || 'JSON Editor'} fullScreen>
                    <FullEditorWrap>
                        <CodeEditor
                            height="100%"
                            language="json"
                            theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                            value={value}
                            onChange={handleFullChange}
                            options={{
                                fontSize: 14,
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                lineNumbers: 'on',
                                tabSize: 2,
                                wordWrap: 'off',
                                padding: { top: 12 },
                                readOnly,
                            }}
                        />
                    </FullEditorWrap>
                </Modal>
            )}
        </Wrapper>
    );
}
