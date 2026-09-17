import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioChunkMeta {
    sampleRate: number;
    channels: number;
    ts: number;
    sourceId: string;
    tabName?: string;
}

interface UseBrowserAudioOptions {
    runId: number;
}

const STORAGE_KEY = 'puppetflow.live-view.audio';
// Scheduling slack so chunks arriving with jitter still play back to back.
const SCHEDULE_AHEAD_SECONDS = 0.08;
// Beyond this the playhead is re-anchored instead of drifting further behind live.
const MAX_LAG_SECONDS = 1.2;
const ACTIVITY_WINDOW_MS = 700;

function readStoredPreference(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
        return true;
    }
}

function decodePcm16(data: ArrayBuffer, channels: number): Float32Array<ArrayBuffer>[] {
    const samples = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
    const frames = Math.floor(samples.length / channels);
    const output: Float32Array<ArrayBuffer>[] = [];
    for (let channel = 0; channel < channels; channel++) {
        const buffer = new Float32Array(new ArrayBuffer(frames * 4));
        for (let i = 0; i < frames; i++) {
            buffer[i] = samples[i * channels + channel] / 0x8000;
        }
        output.push(buffer);
    }
    return output;
}

// Plays the PCM chunks relayed from the remote browser through Web Audio.
export function useBrowserAudio({ runId }: UseBrowserAudioOptions) {
    const contextRef = useRef<AudioContext | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const enabledRef = useRef(readStoredPreference());
    const cursorsRef = useRef(new Map<string, number>());
    const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [enabled, setEnabled] = useState(enabledRef.current);
    const [blocked, setBlocked] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [hasAudio, setHasAudio] = useState(false);

    const ensureContext = useCallback(() => {
        if (contextRef.current) return contextRef.current;
        const AudioContextImpl = window.AudioContext
            || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextImpl) return null;
        const context = new AudioContextImpl({ latencyHint: 'interactive' });
        const gain = context.createGain();
        gain.connect(context.destination);
        contextRef.current = context;
        gainRef.current = gain;
        context.onstatechange = () => {
            setBlocked(context.state !== 'running');
        };
        setBlocked(context.state !== 'running');
        return context;
    }, []);

    const unlock = useCallback(() => {
        if (!enabledRef.current) return;
        const context = ensureContext();
        if (context && context.state !== 'running') {
            context.resume().catch(() => {});
        }
    }, [ensureContext]);

    const markActivity = useCallback(() => {
        setPlaying(true);
        if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
        activityTimerRef.current = setTimeout(() => {
            activityTimerRef.current = null;
            setPlaying(false);
        }, ACTIVITY_WINDOW_MS);
    }, []);

    const pushChunk = useCallback((meta: AudioChunkMeta, data: ArrayBuffer) => {
        setHasAudio(true);
        if (!enabledRef.current) return;
        const context = ensureContext();
        if (!context || !gainRef.current || data.byteLength < 2) return;
        if (context.state !== 'running') {
            setBlocked(true);
            return;
        }

        const channels = meta.channels === 2 ? 2 : 1;
        const decoded = decodePcm16(data, channels);
        const frames = decoded[0].length;
        if (frames === 0) return;

        const buffer = context.createBuffer(channels, frames, meta.sampleRate);
        decoded.forEach((channelData, index) => buffer.copyToChannel(channelData, index));

        const now = context.currentTime;
        const cursors = cursorsRef.current;
        let startAt = cursors.get(meta.sourceId) ?? 0;
        if (startAt < now + 0.01 || startAt > now + MAX_LAG_SECONDS) {
            startAt = now + SCHEDULE_AHEAD_SECONDS;
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gainRef.current);
        source.start(startAt);
        cursors.set(meta.sourceId, startAt + buffer.duration);
        markActivity();
    }, [ensureContext, markActivity]);

    const toggle = useCallback(() => {
        const next = !enabledRef.current;
        enabledRef.current = next;
        setEnabled(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
        } catch {
            // Preference persistence is best effort.
        }
        if (next) {
            unlock();
        } else {
            cursorsRef.current.clear();
            setPlaying(false);
        }
    }, [unlock]);

    useEffect(() => {
        cursorsRef.current.clear();
        setHasAudio(false);
        setPlaying(false);
    }, [runId]);

    useEffect(() => {
        return () => {
            if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
            contextRef.current?.close().catch(() => {});
            contextRef.current = null;
            gainRef.current = null;
        };
    }, []);

    return {
        blocked: enabled && blocked,
        enabled,
        hasAudio,
        playing: enabled && playing,
        pushChunk,
        toggle,
        unlock,
    };
}
