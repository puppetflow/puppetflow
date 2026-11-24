import type { RefObject } from 'react';
import type { StreamClick } from '@/Domains/Flow/Components/BrowserPane/hooks/useBrowserStream';
import * as S from './styled';

interface ClickRipplesProps {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    clicks: StreamClick[];
    onDone: (id: number) => void;
}

// Draws automated clicks over the live canvas. Positions are relative to the
// canvas offset parent, so the parent must be positioned.
export default function ClickRipples({ canvasRef, clicks, onDone }: ClickRipplesProps) {
    const canvas = canvasRef.current;
    if (!canvas || clicks.length === 0) return null;

    return clicks.map((click) => {
        const scaleX = canvas.offsetWidth / click.viewportWidth;
        const scaleY = canvas.offsetHeight / click.viewportHeight;
        const radius = Math.max(14, Math.min(40, Math.round(Math.min(click.viewportWidth, click.viewportHeight) * 0.035)));

        return (
            <S.Ripple
                key={click.id}
                $left={canvas.offsetLeft + click.x * scaleX}
                $top={canvas.offsetTop + click.y * scaleY}
                $size={2 * radius * scaleX}
                onAnimationEnd={() => onDone(click.id)}
            />
        );
    });
}
