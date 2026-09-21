import styled from 'styled-components';

// Invisible wide strokes along each edge so hovering anywhere on the line,
// not just its midpoint, reveals the actions. Below the nodes (z-index 2).
export const EdgeHitLayer = styled.svg`
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
    z-index: 1;
`;

export const EdgeHitPath = styled.path`
    fill: none;
    stroke: transparent;
    stroke-width: 18;
    stroke-linecap: round;
    pointer-events: stroke;
`;

export const EdgeActionZone = styled.div`
    position: absolute;
    width: 96px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    z-index: 3;
`;

export const EdgeActionGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.sm};
    opacity: 0;
    pointer-events: none;
    transition: opacity ${({ theme }) => theme.transition.fast};

    ${EdgeActionZone}:hover &,
    ${EdgeActionZone}:focus-within &,
    ${EdgeActionZone}[data-edge-hovered='true'] & {
        opacity: 1;
        pointer-events: auto;
    }
`;

export const EdgeActionButton = styled.button<{ $danger?: boolean }>`
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: ${({ theme }) => theme.colors.text.secondary};
    background: transparent;
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.hover};
    }
`;
