import styled, { keyframes } from 'styled-components';

// Mirrors the ripple burned into the replay by recording.pp.js.
const expand = keyframes`
    from {
        transform: translate(-50%, -50%) scale(0.3);
        opacity: 1;
    }
    to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0;
    }
`;

interface RippleProps {
    $left: number;
    $top: number;
    $size: number;
}

export const Ripple = styled.div.attrs<RippleProps>(({ $left, $top, $size }) => ({
    style: { left: $left, top: $top, width: $size, height: $size },
}))<RippleProps>`
    position: absolute;
    z-index: 1;
    border: 3px solid #ef4444;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.28);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85), inset 0 0 0 2px rgba(255, 255, 255, 0.85);
    pointer-events: none;
    animation: ${expand} 0.7s cubic-bezier(0, 0, 0.58, 1) forwards;
`;
