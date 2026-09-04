import styled from 'styled-components';

export const ModeLabel = styled.div`
    display: inline-flex;
    width: fit-content;
    align-items: center;
    margin-bottom: 12px;
    padding: 3px 8px;
    border: 1px solid ${({ theme }) => theme.colors.accent.primary};
    border-radius: 999px;
    color: ${({ theme }) => theme.colors.accent.primary};
    background: color-mix(in srgb, ${({ theme }) => theme.colors.accent.primary} 10%, transparent);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
`;

export const SectionHint = styled.div`
    max-width: 820px;
    margin-top: -10px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
    line-height: 1.55;
`;

export const EndpointRow = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
    margin-top: 18px;

    @media (max-width: 640px) {
        grid-template-columns: minmax(0, 1fr);

        > button {
            justify-self: start;
        }
    }
`;

export const Flow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
`;

export const Step = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 7px;

    > svg {
        color: ${({ theme }) => theme.colors.text.tertiary};
    }
`;

export const StepNumber = styled.span`
    display: inline-grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 50%;
    color: #fff;
    background: ${({ theme }) => theme.colors.accent.primary};
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
`;

export const Separator = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 14px;

    @media (max-width: 640px) {
        display: none;
    }
`;
