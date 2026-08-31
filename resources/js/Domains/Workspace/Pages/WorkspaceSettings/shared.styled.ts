import styled from 'styled-components';

export const TwoColumns = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
    padding-bottom: 60px;
    min-width: 0;
    width: 100%;

    @media (max-width: 768px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

export const CardStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
`;

export const Card = styled.div`
    min-width: 0;
    max-width: 100%;
    background: ${({ theme }) => theme.colors.bg.secondary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    padding: 20px 24px;
`;

export const AccordionCard = styled.details`
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    background: ${({ theme }) => theme.colors.bg.secondary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};

    &[open] > summary svg[data-accordion-chevron] {
        transform: rotate(180deg);
    }
`;

export const AccordionSummary = styled.summary`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-width: 0;
    padding: 20px 24px;
    cursor: pointer;
    list-style: none;
    user-select: none;

    &::-webkit-details-marker {
        display: none;
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.accent.primary};
        outline-offset: -2px;
    }

    &:hover [data-accordion-toggle] {
        filter: brightness(1.08);
    }
`;

export const AccordionSummaryContent = styled.div`
    min-width: 0;
`;

export const AccordionToggle = styled.span.attrs({ 'data-accordion-toggle': true })`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-shrink: 0;
    min-width: 76px;
    padding: 7px 10px;
    border-radius: ${({ theme }) => theme.radius.md};
    color: #fff;
    background: ${({ theme }) => theme.colors.accent.primary};
    font-size: 12px;
    font-weight: 600;
    transition: filter ${({ theme }) => theme.transition.fast};

    svg {
        transition: transform ${({ theme }) => theme.transition.fast};
    }
`;

export const AccordionBody = styled.div`
    min-width: 0;
    padding: 18px 24px 20px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
`;

export const WideCard = styled(Card)`
    grid-column: 1 / -1;
`;

export const CardTitle = styled.h2`
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.text.primary};
`;
