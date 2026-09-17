import styled from 'styled-components';
import { checkboxStyles } from '@/Shared/UI/Checkbox/styles';

export const Card = styled.article<{ $view: 'grid' | 'list'; $selected: boolean; $selectionActive: boolean }>`
    position: relative;
    display: ${({ $view }) => $view === 'grid' ? 'flex' : 'grid'};
    flex-direction: column;
    grid-template-columns: ${({ $view }) => $view === 'list' ? '42px minmax(0, 1fr) auto' : 'none'};
    align-items: ${({ $view }) => $view === 'list' ? 'center' : 'stretch'};
    min-width: 0;
    border: 1px solid ${({ theme, $selected }) =>
        $selected ? theme.colors.accent.primary : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme, $selected }) => $selected ? `0 0 0 2px ${theme.colors.bg.tertiary}` : 'none'};
    overflow: hidden;
    cursor: pointer;
    transition: border-color ${({ theme }) => theme.transition.fast},
        transform ${({ theme }) => theme.transition.fast};

    &:hover {
        border-color: ${({ theme }) => theme.colors.border.light};
        transform: ${({ $view }) => $view === 'grid' ? 'translateY(-1px)' : 'none'};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.accent.primary};
        outline-offset: 2px;
    }

    &[draggable='true'] {
        cursor: grab;

        &:active {
            cursor: grabbing;
            opacity: 0.6;
        }
    }
`;

export const Selection = styled.input<{ $view: 'grid' | 'list'; $selected: boolean; $selectionActive: boolean }>`
    ${checkboxStyles}

    position: absolute;
    top: ${({ $view }) => $view === 'list' ? '50%' : 'auto'};
    right: ${({ $view }) => $view === 'grid' ? '10px' : 'auto'};
    bottom: ${({ $view }) => $view === 'grid' ? '10px' : 'auto'};
    left: ${({ $view }) => $view === 'list' ? '13px' : 'auto'};
    z-index: 2;
    width: 16px;
    height: 16px;
    opacity: ${({ $selected, $selectionActive }) => $selected || $selectionActive ? 1 : 0};
    transform: ${({ $view }) => $view === 'list' ? 'translateY(-50%)' : 'none'};

    ${Card}:hover &,
    ${Card}:focus-within & {
        opacity: 1;
    }
`;

export const Preview = styled.div<{ $view: 'grid' | 'list' }>`
    height: ${({ $view }) => $view === 'grid' ? '120px' : 'inherit'};
    width: ${({ $view }) => $view === 'grid' ? '100%' : 'inherit'};
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.bg.primary};
    align-self: stretch;

`;

export const PreviewContent = styled.div<{ $view: 'grid' | 'list'; $showCheckbox: boolean }>`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: ${({ $view, $showCheckbox }) => $view === 'list' && $showCheckbox ? 0 : 1};

    ${Card}:hover &,
    ${Card}:focus-within & {
        opacity: ${({ $view }) => $view === 'list' ? 0 : 1};
    }
`;

export const Thumbnail = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
`;

export const FileIcon = styled.div<{ $color?: string }>`
    display: flex;
    color: ${({ theme, $color }) => $color ?? theme.colors.text.tertiary};
`;

export const Details = styled.div<{ $view: 'grid' | 'list' }>`
    min-width: 0;
    padding: ${({ $view }) => $view === 'grid' ? '8px 10px 9px' : '5px 10px'};
`;

export const Name = styled.span`
    display: block;
    max-width: 100%;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const Meta = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    margin-top: 4px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
`;

export const Type = styled.span`
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const Separator = styled.span`
    width: 1px;
    height: 10px;
    flex: 0 0 1px;
    background: ${({ theme }) => theme.colors.border.light};
`;

export const Tags = styled.div<{ $view: 'grid' | 'list' }>`
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: ${({ $view }) => $view === 'grid' ? 'calc(100% - 16px)' : 'none'};
    margin-left: ${({ $view }) => $view === 'grid' ? '0' : 'auto'};
    overflow: hidden;
    position: ${({ $view }) => $view === 'grid' ? 'absolute' : 'static'};
    z-index: ${({ $view }) => $view === 'grid' ? 1 : 'auto'};
    top: ${({ $view }) => $view === 'grid' ? '8px' : 'auto'};
    left: ${({ $view }) => $view === 'grid' ? '8px' : 'auto'};
    pointer-events: ${({ $view }) => $view === 'grid' ? 'none' : 'auto'};
`;

export const Tag = styled.span`
    min-width: 0;
    max-width: 92px;
    padding: 2px 6px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: 3px;
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    font-size: 9px;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const TagCount = styled.span`
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 9px;
`;
