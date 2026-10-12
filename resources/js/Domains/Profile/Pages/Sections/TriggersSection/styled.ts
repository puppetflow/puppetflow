import styled from 'styled-components';

export const Section = styled.section`
    width: 100%;
    padding-bottom: 60px;
`;

export const Header = styled.header`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
`;

export const HeaderCopy = styled.div`
    min-width: 0;
`;

export const Title = styled.h2`
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    color: ${({ theme }) => theme.colors.text.primary};
`;

export const Description = styled.p`
    margin: 5px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.text.secondary};
`;

export const Total = styled.div`
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex: 0 0 auto;
    padding: 8px 12px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const TotalValue = styled.span`
    font-size: 15px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text.primary};
`;

export const TotalLabel = styled.span`
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const FlowList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

export const FlowGroup = styled.section`
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.bg.primary};
`;

export const FlowHeader = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 43px;
    padding: 0 14px 0 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const FlowIdentity = styled.div`
    display: flex;
    align-self: stretch;
    align-items: center;
    min-width: 0;
`;

export const FlowRail = styled.div`
    width: 3px;
    align-self: stretch;
    margin-right: 12px;
    background: ${({ theme }) => theme.colors.accent.primary};
`;

export const FlowLink = styled.a`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 13px;
    font-weight: 650;
    text-decoration: none;

    &:hover {
        color: ${({ theme }) => theme.colors.accent.primary};
    }
`;

export const FlowCount = styled.span`
    flex: 0 0 auto;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const TriggerList = styled.div`
    display: flex;
    flex-direction: column;
`;

export const TriggerRow = styled.article<{ $inactive: boolean }>`
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 66px;
    padding: 10px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    opacity: ${({ $inactive }) => $inactive ? 0.64 : 1};
    transition:
        background ${({ theme }) => theme.transition.fast},
        opacity ${({ theme }) => theme.transition.fast};

    &:last-child {
        border-bottom: 0;
    }

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
    }

    @media (max-width: 760px) {
        grid-template-columns: 34px minmax(0, 1fr);
    }
`;

export const TriggerIcon = styled.div<{ $active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme, $active }) => $active
        ? theme.colors.accent.primary
        : theme.colors.text.tertiary};
    background: ${({ theme, $active }) => $active
        ? `${theme.colors.accent.primary}12`
        : theme.colors.bg.tertiary};
`;

export const TriggerDetails = styled.div`
    min-width: 0;
`;

export const TriggerTopline = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
`;

export const TriggerName = styled.span`
    min-width: 0;
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const TypeBadge = styled.span`
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    font-size: 10px;
    font-weight: 600;
`;

export const GroupBadge = styled(TypeBadge)`
    color: ${({ theme }) => theme.colors.accent.primary};
    background: ${({ theme }) => `${theme.colors.accent.primary}10`};
`;

export const TriggerMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin-top: 5px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
`;

export const ConfigValue = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const MetaSeparator = styled.span`
    flex: 0 0 auto;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.border.light};
`;

export const LastRun = styled.span`
    flex: 0 0 auto;
`;

export const RowActions = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;

    @media (max-width: 760px) {
        grid-column: 2;
        justify-content: flex-start;
    }
`;

export const IconButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: transparent;
    transition:
        color ${({ theme }) => theme.transition.fast},
        background ${({ theme }) => theme.transition.fast};

    &:hover {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.tertiary};
    }
`;

export const Empty = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 54px 20px;
    border: 1px dashed ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    text-align: center;
`;

export const EmptyIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-bottom: 13px;
    border-radius: 50%;
    color: ${({ theme }) => theme.colors.text.tertiary};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const EmptyTitle = styled.h3`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 14px;
`;

export const EmptyText = styled.p`
    margin: 5px 0 0;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
`;

export const Pagination = styled.footer`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 16px;
`;

export const PageSummary = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
`;

export const PageControls = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
`;

export const PageButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    color: ${({ theme }) => theme.colors.text.secondary};
    background: ${({ theme }) => theme.colors.bg.primary};

    &:hover:not(:disabled) {
        background: ${({ theme }) => theme.colors.bg.hover};
    }

    &:disabled {
        cursor: default;
        opacity: 0.4;
    }
`;

export const PageNumber = styled.span`
    min-width: 76px;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 11px;
    text-align: center;
`;
