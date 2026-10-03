import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@/Shared/UI/Icon/Icon';
import {
    RunDetailCopyButton,
    RunDetailPanelHeader,
    RunDetailPanelTitle,
} from '@/Domains/Flow/Pages/FlowEditor/shared/runStatus.styled';
import type { ConsoleLogEntry } from '@/Domains/Flow/types';
import { formatTime } from '@/Shared/Utils/formatDate';
import type { LogLevel } from '@/Domains/Flow/Pages/FlowEditor/types';
import * as S from './styled';

interface ConsoleLogViewProps {
    logs: ConsoleLogEntry[];
    onCopy: (text: string) => void;
}

interface SearchableConsoleLog {
    key: string;
    log: ConsoleLogEntry;
    timestamp: string;
    searchText: string;
}

const ESTIMATED_LINE_HEIGHT = 20;
const OVERSCAN = 12;
const PREPARATION_BATCH_SIZE = 250;
const SCROLL_THRESHOLD = 24;
const WRAP_MODE_STORAGE_KEY = 'nop-run-console-wrap-mode';
const AUTO_SCROLL_STORAGE_KEY = 'nop-run-console-auto-scroll';

export default function ConsoleLogView({ logs, onCopy }: ConsoleLogViewProps) {
    const [searchableLogs, setSearchableLogs] = useState<SearchableConsoleLog[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        let batchTimer = 0;
        let preparationFrame = 0;
        let offset = 0;
        const prepared: SearchableConsoleLog[] = [];

        const prepareBatch = () => {
            if (cancelled) return;

            const batchEnd = Math.min(offset + PREPARATION_BATCH_SIZE, logs.length);
            logs.slice(offset, batchEnd).forEach(log => {
                const index = prepared.length;
                const timestamp = formatTime(log.ts);
                prepared.push({
                    key: `${index}:${log.ts}:${log.level}`,
                    log,
                    timestamp,
                    searchText: `${timestamp} ${log.level} ${log.message}`.toLowerCase(),
                });
            });
            offset = batchEnd;

            if (offset < logs.length) {
                batchTimer = window.setTimeout(prepareBatch, 0);
            } else {
                setSearchableLogs(prepared);
            }
        };

        const openingFrame = requestAnimationFrame(() => {
            preparationFrame = requestAnimationFrame(prepareBatch);
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(openingFrame);
            cancelAnimationFrame(preparationFrame);
            window.clearTimeout(batchTimer);
        };
    }, [logs]);

    if (!searchableLogs) {
        return (
            <S.ConsoleLogPanel>
                <S.ConsoleLoader role="status" aria-label="Loading console logs">
                    <Icon icon="lucide:loader-2" width={18} height={18} />
                </S.ConsoleLoader>
            </S.ConsoleLogPanel>
        );
    }

    return <ConsoleLogContent searchableLogs={searchableLogs} onCopy={onCopy} />;
}

function ConsoleLogContent({
    searchableLogs,
    onCopy,
}: {
    searchableLogs: SearchableConsoleLog[];
    onCopy: (text: string) => void;
}) {
    const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
    const [query, setQuery] = useState('');
    const [wrapMode, setWrapMode] = useState(() => {
        try {
            return window.localStorage.getItem(WRAP_MODE_STORAGE_KEY) !== 'false';
        } catch {
            return true;
        }
    });
    const [autoScroll, setAutoScroll] = useState(() => {
        try {
            return window.localStorage.getItem(AUTO_SCROLL_STORAGE_KEY) !== 'false';
        } catch {
            return true;
        }
    });
    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return searchableLogs.filter(({ log, searchText }) => {
            if (levelFilter !== 'all' && log.level !== levelFilter) return false;
            if (!normalizedQuery) return true;

            return searchText.includes(normalizedQuery);
        });
    }, [levelFilter, query, searchableLogs]);
    const counts = useMemo(() => {
        const c = { debug: 0, info: 0, warn: 0, error: 0 };
        searchableLogs.forEach(({ log }) => {
            if (log.level in c) c[log.level as keyof typeof c]++;
        });
        return c;
    }, [searchableLogs]);

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(autoScroll);
    const getItemKey = useCallback(
        (index: number) => filtered[index]?.key ?? index,
        [filtered],
    );
    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => ESTIMATED_LINE_HEIGHT,
        getItemKey,
        overscan: OVERSCAN,
    });

    const scrollToBottom = useCallback(() => {
        const el = containerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    const handleScroll = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;

        isAtBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
    }, []);

    useEffect(() => {
        if (!autoScroll) return;

        const frame = requestAnimationFrame(scrollToBottom);
        return () => cancelAnimationFrame(frame);
    }, [autoScroll, filtered.length, scrollToBottom]);

    useEffect(() => {
        rowVirtualizer.measure();
        if (!autoScroll) return;

        const frame = requestAnimationFrame(scrollToBottom);
        return () => cancelAnimationFrame(frame);
    }, [autoScroll, rowVirtualizer, scrollToBottom, wrapMode]);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        const observer = new ResizeObserver(() => {
            if (autoScroll || isAtBottomRef.current) scrollToBottom();
        });
        observer.observe(content);

        return () => observer.disconnect();
    }, [autoScroll, filtered.length, scrollToBottom]);

    const toggleWrapMode = useCallback(() => {
        setWrapMode(current => {
            const next = !current;
            try {
                window.localStorage.setItem(WRAP_MODE_STORAGE_KEY, String(next));
            } catch {}
            return next;
        });
    }, []);

    const toggleAutoScroll = useCallback(() => {
        setAutoScroll(current => {
            const next = !current;
            try {
                window.localStorage.setItem(AUTO_SCROLL_STORAGE_KEY, String(next));
            } catch {}
            return next;
        });
    }, []);

    // Manual scrolling only pauses auto-scroll for this view; the persisted preference is
    // changed through the explicit toggle.
    const disableAutoScroll = useCallback(() => setAutoScroll(false), []);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        const scrollbarWidth = el.offsetWidth - el.clientWidth;
        const scrollbarLeft = el.getBoundingClientRect().right - scrollbarWidth;

        if (scrollbarWidth > 0 && event.clientX >= scrollbarLeft) {
            disableAutoScroll();
        }
    }, [disableAutoScroll]);

    const virtualItems = rowVirtualizer.getVirtualItems();
    const firstVirtualItem = virtualItems[0];
    const lastVirtualItem = virtualItems[virtualItems.length - 1];

    return (
        <S.ConsoleLogPanel>
            <RunDetailPanelHeader>
                <S.ConsoleToolbar>
                    <RunDetailPanelTitle>Filter</RunDetailPanelTitle>
                    <S.ConsoleFilter value={levelFilter} onChange={e => setLevelFilter(e.target.value as LogLevel)}>
                        <option value="all">All ({searchableLogs.length})</option>
                        <option value="debug">Debug ({counts.debug})</option>
                        <option value="info">Info ({counts.info})</option>
                        <option value="warn">Warn ({counts.warn})</option>
                        <option value="error">Error ({counts.error})</option>
                    </S.ConsoleFilter>
                    <S.ConsoleSearch>
                        <Icon icon="lucide:search" width={11} height={11} />
                        <S.ConsoleSearchInput
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Escape') setQuery('');
                            }}
                            placeholder="Search logs..."
                            aria-label="Search console logs"
                        />
                    </S.ConsoleSearch>
                    <S.ConsoleToggle
                        type="button"
                        $active={wrapMode}
                        aria-pressed={wrapMode}
                        onClick={toggleWrapMode}
                    >
                        <Icon icon="lucide:scroll-text" width={11} height={11} />
                        Wrap
                    </S.ConsoleToggle>
                    <S.ConsoleToggle
                        type="button"
                        $active={autoScroll}
                        aria-pressed={autoScroll}
                        onClick={toggleAutoScroll}
                    >
                        <Icon icon="lucide:arrow-down-circle" width={11} height={11} />
                        Autoscroll
                    </S.ConsoleToggle>
                </S.ConsoleToolbar>
                <RunDetailCopyButton
                    onClick={() => onCopy(filtered.map(({ log }) => `[${log.level}] ${log.message}`).join('\n'))}
                >
                    Copy
                </RunDetailCopyButton>
            </RunDetailPanelHeader>
            <S.ConsoleContainer
                ref={containerRef}
                onScroll={handleScroll}
                onWheel={disableAutoScroll}
                onTouchMove={disableAutoScroll}
                onPointerDown={handlePointerDown}
            >
                {filtered.length > 0 ? (
                    <S.ConsoleVirtualContent
                        ref={contentRef}
                        $paddingTop={firstVirtualItem?.start ?? 0}
                        $paddingBottom={Math.max(
                            0,
                            rowVirtualizer.getTotalSize() - (lastVirtualItem?.end ?? 0),
                        )}
                        $wrap={wrapMode}
                    >
                        {virtualItems.map(virtualRow => {
                            const { key, log, timestamp } = filtered[virtualRow.index];

                            return (
                                <S.ConsoleLine
                                    key={key}
                                    ref={rowVirtualizer.measureElement}
                                    data-index={virtualRow.index}
                                    $level={log.level}
                                    $wrap={wrapMode}
                                >
                                    <S.ConsoleTimestamp>{timestamp}</S.ConsoleTimestamp>
                                    <S.ConsoleLevel $level={log.level}>{log.level}</S.ConsoleLevel>
                                    {log.message}
                                </S.ConsoleLine>
                            );
                        })}
                    </S.ConsoleVirtualContent>
                ) : (
                    <S.ConsoleEmpty>No logs matching filter.</S.ConsoleEmpty>
                )}
            </S.ConsoleContainer>
        </S.ConsoleLogPanel>
    );
}
