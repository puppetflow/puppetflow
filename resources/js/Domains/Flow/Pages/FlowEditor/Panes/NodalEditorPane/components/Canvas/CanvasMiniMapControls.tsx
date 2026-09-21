import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
    MINI_MAP_HEIGHT,
    MINI_MAP_WIDTH,
} from './utils';
import * as S from './CanvasMiniMapControls.styled';

interface CanvasMiniMapControlsProps {
    children: React.ReactNode;
    fading?: boolean;
    onNavigate: (x: number, y: number) => void;
    // Called when the pointer starts or stops hovering the minimap, so the
    // auto-hide countdown can be suspended while the user interacts with it.
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
}

export default function CanvasMiniMapControls({
    children,
    fading,
    onNavigate,
    onHoldStart,
    onHoldEnd,
}: CanvasMiniMapControlsProps) {
    const [dragPointerId, setDragPointerId] = useState<number | null>(null);
    const hoveredRef = useRef(false);
    const onHoldEndRef = useRef(onHoldEnd);
    onHoldEndRef.current = onHoldEnd;

    const startHold = useCallback(() => {
        if (hoveredRef.current) return;
        hoveredRef.current = true;
        onHoldStart?.();
    }, [onHoldStart]);

    const endHold = useCallback(() => {
        if (!hoveredRef.current) return;
        hoveredRef.current = false;
        onHoldEndRef.current?.();
    }, []);

    // If the minimap unmounts while hovered (mode switch, graph emptied), the
    // hold must be released or the next reveal would never auto-hide.
    useEffect(() => () => {
        if (hoveredRef.current) {
            hoveredRef.current = false;
            onHoldEndRef.current?.();
        }
    }, []);

    const navigateToPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(MINI_MAP_WIDTH, event.clientX - rect.left));
        const y = Math.max(0, Math.min(MINI_MAP_HEIGHT, event.clientY - rect.top));
        onNavigate(x, y);
    }, [onNavigate]);

    const isPointerInside = (event: React.PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };

    // A drag keeps the minimap held even if the pointer wanders outside its
    // bounds; the hold ends on pointer up instead.
    const handlePointerLeave = () => {
        if (dragPointerId !== null) return;
        endHold();
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        startHold();
        setDragPointerId(event.pointerId);
        event.currentTarget.setPointerCapture(event.pointerId);
        navigateToPointer(event);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragPointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        navigateToPointer(event);
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragPointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        setDragPointerId(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        // Pointer capture swallowed the leave event while dragging: if the
        // button was released outside the minimap, end the hold now.
        if (!isPointerInside(event)) endHold();
    };

    return (
        <S.Controls
            role="button"
            aria-label="Move canvas viewport"
            tabIndex={0}
            $fading={fading}
            onPointerEnter={startHold}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {children}
        </S.Controls>
    );
}
