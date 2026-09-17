import styled from 'styled-components';

export const Wrapper = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const Label = styled.label`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    font-weight: 500;
`;

export const Control = styled.div<{ $focused: boolean; $disabled: boolean }>`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 38px;
    padding: 6px 8px;
    border: 1px solid ${({ theme, $focused }) =>
        $focused ? theme.colors.border.focus : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme, $disabled }) =>
        $disabled ? theme.colors.bg.tertiary : theme.colors.bg.primary};
    box-shadow: ${({ theme, $focused }) =>
        $focused ? `0 0 0 3px ${theme.colors.border.focus}26` : 'none'};
    cursor: ${({ $disabled }) => $disabled ? 'default' : 'text'};
    opacity: ${({ $disabled }) => $disabled ? 0.7 : 1};
`;

export const Chip = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    padding: 3px 5px 3px 8px;
    border: 1px solid ${({ theme }) => theme.colors.border.light};
    border-radius: 3px;
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    font-size: 11px;

    > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

export const Remove = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: transparent;
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.hover};
    }
`;

export const Input = styled.input`
    flex: 1 1 120px;
    min-width: 90px;
    padding: 2px 4px;
    border: 0;
    outline: 0;
    color: ${({ theme }) => theme.colors.text.primary};
    background: transparent;
    font-size: 12px;

    &::placeholder {
        color: ${({ theme }) => theme.colors.text.tertiary};
    }
`;

export const Options = styled.div`
    position: absolute;
    z-index: 60;
    top: calc(100% - 16px);
    right: 0;
    left: 0;
    max-height: 220px;
    padding: 4px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
    overflow-y: auto;
`;

export const Option = styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 9px;
    border: 0;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme, $active }) => $active ? theme.colors.bg.hover : 'transparent'};
    font-size: 12px;
    text-align: left;
    cursor: pointer;

    svg {
        flex-shrink: 0;
        color: ${({ theme }) => theme.colors.text.tertiary};
    }
`;

export const Hint = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
`;
