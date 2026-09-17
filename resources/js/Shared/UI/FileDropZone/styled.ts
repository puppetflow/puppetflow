import styled from 'styled-components';

export const DropZone = styled.label<{ $dragging?: boolean; $hasError?: boolean; $disabled?: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 130px;
    padding: 20px;
    border: 1px dashed ${({ theme, $dragging, $hasError }) =>
        $hasError ? theme.colors.accent.error : $dragging ? theme.colors.accent.primary : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme, $dragging }) => $dragging ? `${theme.colors.accent.primary}10` : theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.secondary};
    cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
    opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
    text-align: center;
    transition: border-color ${({ theme }) => theme.transition.fast}, background ${({ theme }) => theme.transition.fast};

    &:hover {
        border-color: ${({ theme, $disabled }) => ($disabled ? theme.colors.border.default : theme.colors.accent.primary)};
        background: ${({ theme, $disabled }) => ($disabled ? theme.colors.bg.tertiary : theme.colors.bg.hover)};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.accent.primary};
        outline-offset: 2px;
    }
`;

export const DropTitle = styled.div`
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.primary};
`;

export const DropHint = styled.div`
    font-size: 12px;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const HiddenFileInput = styled.input`
    display: none;
`;

export const ProgressTrack = styled.div`
    height: 5px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.bg.tertiary};
    overflow: hidden;
`;

export const ProgressFill = styled.div<{ $progress: number }>`
    width: ${({ $progress }) => Math.max(0, Math.min(100, $progress))}%;
    height: 100%;
    border-radius: inherit;
    background: ${({ theme }) => theme.colors.accent.primary};
    transition: width 120ms ease;
`;
