import styled from 'styled-components';

export { ProgressFill, ProgressTrack } from '@/Shared/UI/FileDropZone/styled';

export const HiddenFileInput = styled.input`
    display: none;
`;

/** Wraps the explorer content column to accept file drops for uploads. */
export const DropZone = styled.div`
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
`;

export const DropOverlay = styled.div`
    position: absolute;
    z-index: 20;
    inset: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed ${({ theme }) => theme.colors.accent.primary};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: color-mix(in srgb, ${({ theme }) => theme.colors.bg.secondary} 92%, transparent);
    pointer-events: none;
`;

export const DropTarget = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.accent.primary};
    text-align: center;
`;

export const DropTitle = styled.strong`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 16px;
`;

export const DropText = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
`;

export const UploadProgress = styled.div`
    position: absolute;
    right: 18px;
    bottom: 18px;
    z-index: 30;
    width: min(320px, calc(100% - 36px));
    padding: 13px 14px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
`;

export const UploadProgressHeader = styled.div`
    display: flex;
    justify-content: space-between;
    margin-bottom: 9px;
`;

export const UploadProgressLabel = styled.span`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 11px;
    font-weight: 600;
`;

export const UploadProgressValue = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
`;
