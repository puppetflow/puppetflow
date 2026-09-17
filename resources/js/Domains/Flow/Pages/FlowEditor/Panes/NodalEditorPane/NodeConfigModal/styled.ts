import styled from 'styled-components';

export const NodeConfigBackdrop = styled.div`
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: ${({ theme }) => theme.colors.bg.primary}cc;
    backdrop-filter: blur(3px);
    z-index: 1000;
    overflow-x: clip;
    cursor: default;
    user-select: text;

    * {
        cursor: auto;
        user-select: text;
    }

    button:not(:disabled),
    button:not(:disabled) *,
    select:not(:disabled),
    a[href],
    a[href] *,
    [role='button'],
    [role='button'] * {
        cursor: pointer;
    }

    input,
    textarea {
        cursor: text;
    }

    input:disabled,
    textarea:disabled,
    select:disabled {
        cursor: not-allowed;
        opacity: 1;
        color: ${({ theme }) => theme.colors.text.secondary};
        background: ${({ theme }) => theme.colors.bg.tertiary};
        border-color: ${({ theme }) => theme.colors.border.default};
        -webkit-text-fill-color: ${({ theme }) => theme.colors.text.secondary};
    }

    [draggable='true'] {
        cursor: grab;
    }
`;

export const NodeConfigShell = styled.div`
    position: relative;
    width: min(1360px, calc(100vw - 308px));
    height: calc(100vh - 32px);
    max-height: calc(100vh - 32px);

    @media (max-width: 1120px) {
        width: min(800px, 100%);
    }
`;

export const NodeConfigPanel = styled.div`
    width: 100%;
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: ${({ theme }) => theme.radius.lg};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
    overflow: hidden;
    user-select: text;
`;

export const NodeConfigBody = styled.div`
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
    padding: 16px;
    background: ${({ theme }) => theme.colors.bg.primary};
`;

export const NodeConfigLayout = styled.div`
    flex: 1;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(190px, 0.75fr) minmax(420px, 1.35fr) minmax(190px, 0.75fr);
    gap: 12px;
    align-items: stretch;

    @media (max-width: 1024px) {
        grid-template-columns: 1fr;
    }
`;

export const NodeConfigFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const NodeConfigMeta = styled.div`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

// Tinted while a run feeds the preview, neutral when the static preview is shown.
export const PreviewSourceBanner = styled.div<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 6px 8px 6px 12px;
    border: 1px solid ${({ theme, $active }) => ($active ? `${theme.colors.accent.info}55` : theme.colors.border.default)};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme, $active }) => ($active ? theme.colors.accent.infoBg : theme.colors.bg.primary)};
    font-size: 11px;
    color: ${({ theme, $active }) => ($active ? theme.colors.accent.info : theme.colors.text.secondary)};

    > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

export const PreviewSourceToggle = styled.button`
    flex-shrink: 0;
    padding: 3px 8px;
    border: 1px solid currentColor;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: transparent;
    font-size: 11px;
    font-weight: 600;
    color: inherit;
    cursor: pointer;

    &:hover {
        background: ${({ theme }) => theme.colors.bg.secondary};
    }
`;

export const NodeConfigDone = styled.button`
    padding: 7px 12px;
    border-radius: ${({ theme }) => theme.radius.md};
    font-size: 12px;
    font-weight: 600;
    color: white;
    background: ${({ theme }) => theme.colors.accent.primary};
    cursor: pointer;

    &:hover {
        filter: brightness(1.05);
    }
`;
