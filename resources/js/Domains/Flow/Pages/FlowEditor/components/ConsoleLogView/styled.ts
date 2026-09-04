import styled from 'styled-components';
import { RunDetailPanel } from '@/Domains/Flow/Pages/FlowEditor/shared/runStatus.styled';

export const ConsoleLogPanel = styled(RunDetailPanel)`
    
`;

export const ConsoleLoader = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};

    @keyframes console-loader-spin {
        to { transform: rotate(360deg); }
    }

    svg {
        animation: console-loader-spin 1s linear infinite;
    }
`;

export const ConsoleContainer = styled.div`
    background: ${({ theme }) => theme.colors.bg.primary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    flex: 1;
    min-height: 0;
    overflow: auto;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11px;
    line-height: 1.6;
    padding: 6px 0;
`;

export const ConsoleVirtualContent = styled.div<{
    $paddingTop: number;
    $paddingBottom: number;
    $wrap: boolean;
}>`
    width: ${({ $wrap }) => $wrap ? '100%' : 'max-content'};
    min-width: 100%;
    box-sizing: border-box;
    padding-top: ${({ $paddingTop }) => $paddingTop}px;
    padding-bottom: ${({ $paddingBottom }) => $paddingBottom}px;
`;

export const ConsoleLine = styled.div<{
    $level: 'debug' | 'info' | 'warn' | 'error';
    $wrap: boolean;
}>`
    width: ${({ $wrap }) => $wrap ? '100%' : 'max-content'};
    min-width: 100%;
    box-sizing: border-box;
    padding: 1px 10px;
    color: ${({ theme, $level }) =>
        $level === 'error' ? theme.colors.accent.error :
        $level === 'warn' ? theme.colors.accent.warning :
        $level === 'debug' ? theme.colors.text.tertiary :
        theme.colors.text.secondary};
    white-space: ${({ $wrap }) => $wrap ? 'pre-wrap' : 'pre'};
    word-break: ${({ $wrap }) => $wrap ? 'break-all' : 'normal'};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
    }
`;

export const ConsoleLevel = styled.span<{ $level: 'debug' | 'info' | 'warn' | 'error' }>`
    display: inline-block;
    width: 40px;
    user-select: none;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-right: 6px;
    padding: 1px 0;
    border-radius: 3px;
    color: ${({ theme, $level }) =>
        $level === 'error' ? theme.colors.accent.error :
        $level === 'warn' ? theme.colors.accent.warning :
        $level === 'debug' ? theme.colors.text.tertiary :
        theme.colors.accent.info};
    background: ${({ theme, $level }) =>
        $level === 'error' ? theme.colors.accent.errorBg :
        $level === 'warn' ? theme.colors.accent.warningBg :
        $level === 'debug' ? theme.colors.bg.tertiary :
        theme.colors.accent.infoBg};
`;

export const ConsoleTimestamp = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    margin-right: 6px;
    user-select: none;
    font-size: 10px;
`;

export const ConsoleToolbar = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
`;

export const ConsoleFilter = styled.select`
    font-size: 10px;
    padding: 1px 4px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.secondary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    cursor: pointer;

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.colors.accent.primary};
    }
`;

export const ConsoleSearch = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    width: 150px;
    min-width: 80px;
    padding: 1px 5px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.tertiary};

    &:focus-within {
        border-color: ${({ theme }) => theme.colors.accent.primary};
        color: ${({ theme }) => theme.colors.text.secondary};
    }
`;

export const ConsoleSearchInput = styled.input`
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 10px;
    line-height: 16px;

    &::placeholder {
        color: ${({ theme }) => theme.colors.text.tertiary};
    }

    &::-webkit-search-cancel-button {
        cursor: pointer;
    }
`;

export const ConsoleToggle = styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    padding: 1px 5px;
    border: 1px solid ${({ theme, $active }) =>
        $active ? theme.colors.accent.primary : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme, $active }) =>
        $active ? theme.colors.accent.primary + '18' : theme.colors.bg.tertiary};
    color: ${({ theme, $active }) =>
        $active ? theme.colors.accent.primary : theme.colors.text.tertiary};
    font-size: 10px;
    line-height: 16px;
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;

export const ConsoleEmpty = styled.div`
    padding: 12px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-style: italic;
    text-align: center;
`;
