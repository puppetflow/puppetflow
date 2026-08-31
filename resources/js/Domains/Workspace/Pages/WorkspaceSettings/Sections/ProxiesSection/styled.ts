import styled from 'styled-components';

export const Rows = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    padding-bottom: 60px;
    min-width: 0;
    width: 100%;
`;

export const Card = styled.div`
    min-width: 0;
    max-width: 100%;
    background: ${({ theme }) => theme.colors.bg.secondary};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    padding: 20px 24px;
`;

export const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
`;

export const CardTitle = styled.h2`
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${({ theme }) => theme.colors.text.primary};
`;

export const HeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

export const AddButtonLabel = styled.span`
    @media (max-width: 520px) {
        display: none;
    }
`;

export const SectionHint = styled.div`
    font-size: 12px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    margin-top: -10px;
    line-height: 1.45;
`;

export const EmptyState = styled.div`
    border: 1px dashed ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    padding: 18px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 13px;
    text-align: center;
    margin-top: 18px;
`;

export const TableWrapper = styled.div<{ $hasSelection?: boolean }>`
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin-top: ${({ $hasSelection }) => $hasSelection ? '0' : '18px'};
    overflow-x: auto;
`;

export const ProxySelectionBar = styled.div`
    margin-top: 18px;

    > div {
        border-bottom: 0;
    }
`;

export const Table = styled.table`
    width: 100%;
    min-width: 900px;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};

    th {
        padding: 10px 14px;
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-size: 11px;
        font-weight: 600;
        text-align: left;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
        background: ${({ theme }) => theme.colors.bg.secondary};
    }

    thead th:first-child { border-top-left-radius: ${({ theme }) => theme.radius.lg}; }
    thead th:last-child { border-top-right-radius: ${({ theme }) => theme.radius.lg}; }

    td {
        padding: 8px 14px;
        color: ${({ theme }) => theme.colors.text.primary};
        font-size: 13px;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
        white-space: nowrap;
    }

    tbody tr:last-child > td {
        border-bottom: 0;
    }

    tbody tr:last-child > td:first-child {
        border-bottom-left-radius: ${({ theme }) => theme.radius.lg};
    }

    tbody tr:last-child > td:last-child {
        border-bottom-right-radius: ${({ theme }) => theme.radius.lg};
    }
`;

export const GroupRow = styled.tr`
    td {
        padding: 0;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: ${({ theme }) => theme.colors.text.tertiary};
        background: ${({ theme }) => theme.colors.bg.tertiary};
    }
`;

export const GroupButton = styled.button<{ $depth: number }>`
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 6px 14px;
    padding-left: ${({ $depth }) => `${14 + $depth * 16}px`};
    font: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
        color: ${({ theme }) => theme.colors.text.secondary};
        background: ${({ theme }) => theme.colors.bg.secondary};
    }
`;

export const GroupCount = styled.span`
    margin-left: auto;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    opacity: 0.8;
`;

export const Row = styled.tr<{ $indent: number }>`
    td {
        background: ${({ theme }) => theme.colors.bg.primary};
    }

    td:first-child {
        padding-left: ${({ $indent }) => $indent ? `${$indent}px` : undefined};
    }
`;

export const ProxyName = styled.div`
    display: inline-block;
    max-width: 220px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;
    font-weight: 500;
    font-family: ${({ theme }) => theme.font.mono};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    padding: 1px 6px;
    border-radius: ${({ theme }) => theme.radius.sm};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const ProxyIdentity = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

export const ManagedBadge = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bg.tertiary};
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 10px;
    font-weight: 500;
`;

export const CountryAvatar = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.bg.tertiary};
    font-size: 15px;
    line-height: 1;
`;

export const InlineCell = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${({ theme }) => theme.colors.text.primary};
`;

export const Endpoint = styled.span`
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 11px;
    color: ${({ theme }) => theme.colors.text.secondary};
`;

export const ScopeBadge = styled.span<{ $scope: string }>`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ $scope, theme }) =>
        $scope === 'workspace' ? '#3b82f618' :
        $scope === 'team' ? (theme.colors.accent.success || '#22c55e') + '18' :
        '#eab30818'};
    color: ${({ $scope, theme }) =>
        $scope === 'workspace' ? '#3b82f6' :
        $scope === 'team' ? (theme.colors.accent.success || '#22c55e') :
        '#eab308'};
`;

export const Muted = styled.span`
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const OwnerName = styled.span`
    display: inline-block;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
`;

export const Actions = styled.div`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
    position: relative;
`;

export const OverflowWrapper = styled.div`
    position: relative;
    flex-shrink: 0;
`;

export const OverflowButton = styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.radius.md};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.text.secondary};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;

export const OverflowMenu = styled.div`
    position: fixed;
    z-index: 10000;
    min-width: 150px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
    padding: 6px;
`;

export const MenuItem = styled.button`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 8px 10px;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.text.secondary};

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.text.primary};
    }
`;

export const DangerMenuItem = styled(MenuItem)`
    color: ${({ theme }) => theme.colors.accent.error};

    &:hover {
        background: ${({ theme }) => theme.colors.accent.errorBg};
        color: ${({ theme }) => theme.colors.accent.error};
    }
`;

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
    min-width: 0;
`;

export const FormLayout = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    min-width: 0;
`;

export const Fields = styled.div<{ $columns?: number }>`
    display: grid;
    grid-template-columns: ${({ $columns = 1 }) => `repeat(${$columns}, minmax(0, 1fr))`};
    gap: 12px;
    align-items: start;
    min-width: 0;

    @media (max-width: 560px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

export const CountryField = styled.div`
    position: relative;
    min-width: 0;
`;

export const CountryLabel = styled.label`
    display: block;
    margin-bottom: 4px;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    font-weight: 500;
`;

export const CountryControls = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 36px;
    gap: 6px;
`;

export const CountryTrigger = styled.button<{ $open: boolean; $hasValue: boolean }>`
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 7px;
    padding: 8px 10px;
    border: 1px solid ${({ theme, $open }) => $open
        ? theme.colors.accent.primary
        : theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme, $hasValue }) => $hasValue
        ? theme.colors.text.primary
        : theme.colors.text.tertiary};
    font-size: 13px;
    text-align: left;
    transition: border-color ${({ theme }) => theme.transition.fast};

    &:hover:not(:disabled) {
        border-color: ${({ theme }) => theme.colors.accent.primary};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }

    svg {
        flex-shrink: 0;
        margin-left: auto;
        color: ${({ theme }) => theme.colors.text.tertiary};
        transform: ${({ $open }) => $open ? 'rotate(180deg)' : 'none'};
        transition: transform 150ms ease;
    }
`;

export const CountryFlag = styled.span`
    width: 19px;
    flex-shrink: 0;
    font-size: 16px;
    line-height: 1;
    text-align: center;
`;

export const CountryValue = styled.span`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const CountryScanButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.secondary};
    transition:
        color ${({ theme }) => theme.transition.fast},
        border-color ${({ theme }) => theme.transition.fast},
        background ${({ theme }) => theme.transition.fast};

    &:hover:not(:disabled) {
        border-color: ${({ theme }) => theme.colors.accent.primary};
        background: ${({ theme }) => theme.colors.bg.hover};
        color: ${({ theme }) => theme.colors.accent.primary};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }

`;

export const CountrySpinner = styled.span`
    width: 15px;
    height: 15px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: country-scan-spin 600ms linear infinite;

    @keyframes country-scan-spin {
        to { transform: rotate(360deg); }
    }
`;

export const CountryPanel = styled.div`
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 42px;
    z-index: 1100;
    overflow: hidden;
    padding-top: 6px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.bg.secondary};
    box-shadow: ${({ theme }) => theme.shadow.lg};
`;

export const CountrySearch = styled.input`
    width: calc(100% - 12px);
    margin: 0 6px 6px;
    padding: 6px 8px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.sm};
    outline: none;
    background: ${({ theme }) => theme.colors.bg.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 12px;

    &:focus {
        border-color: ${({ theme }) => theme.colors.accent.primary};
    }

    &::placeholder {
        color: ${({ theme }) => theme.colors.text.tertiary};
    }
`;

export const CountryList = styled.div`
    max-height: 220px;
    overflow-y: auto;
    padding: 4px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
`;

export const CountryOption = styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    width: 100%;
    gap: 8px;
    padding: 7px 8px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme, $active }) => $active
        ? `${theme.colors.accent.primary}14`
        : 'transparent'};
    color: ${({ theme, $active }) => $active
        ? theme.colors.accent.primary
        : theme.colors.text.primary};
    font-size: 13px;
    font-weight: ${({ $active }) => $active ? 600 : 400};
    text-align: left;

    &:hover {
        background: ${({ theme }) => theme.colors.bg.hover};
    }
`;

export const CountryCode = styled.span`
    margin-left: auto;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 10px;
`;

export const CountryEmpty = styled.div`
    padding: 12px 10px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
    text-align: center;
`;

export const CountryDetectionError = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: -6px;
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 11px;
    line-height: 1.35;

    svg {
        flex-shrink: 0;
    }
`;

export const Error = styled.div`
    border: 1px solid ${({ theme }) => theme.colors.accent.error}40;
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.accent.errorBg};
    color: ${({ theme }) => theme.colors.accent.error};
    font-size: 12px;
    line-height: 1.4;
`;

export const ConnectionStatus = styled.div<{ $success: boolean }>`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid ${({ $success, theme }) =>
        $success ? '#22c55e30' : `${theme.colors.accent.error}25`};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ $success, theme }) =>
        $success ? '#22c55e0c' : `${theme.colors.accent.error}0a`};
    color: ${({ $success, theme }) =>
        $success ? '#22c55e' : theme.colors.accent.error};
    font-size: 12px;
    line-height: 1.4;

    svg {
        flex-shrink: 0;
        margin-top: 1px;
    }

    span {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    strong {
        font-weight: 600;
    }

    small {
        color: ${({ theme }) => theme.colors.text.secondary};
        font-size: 11px;
    }
`;

export const FormActions = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 28px;
`;

export const FormActionsSpacer = styled.span`
    flex: 1;
`;
