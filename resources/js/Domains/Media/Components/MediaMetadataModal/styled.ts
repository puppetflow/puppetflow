import styled from 'styled-components';

export const ModalContent = styled.div`
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(300px, 36%) minmax(0, 1fr);

    @media (max-width: 800px) {
        grid-template-columns: 1fr;
        overflow-y: auto;
    }
`;

export const MetadataPanel = styled.aside`
    position: relative;
    z-index: 2;
    min-height: 0;
    padding: 20px;
    border-right: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.bg.secondary};
    overflow-y: auto;

    @media (max-width: 800px) {
        border-right: 0;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
    }
`;

export const PanelHeading = styled.h3`
    margin-bottom: 18px;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 13px;
    font-weight: 700;
`;

export const Form = styled.div`
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

export const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const Label = styled.label`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 12px;
    font-weight: 600;
`;

export const TechnicalDetails = styled.dl`
    display: grid;
    gap: 9px;
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid ${({ theme }) => theme.colors.border.default};
`;

export const Detail = styled.div`
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr);
    gap: 10px;
`;

export const DetailLabel = styled.dt`
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 11px;
`;

export const DetailValue = styled.dd`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: 11px;
    overflow-wrap: anywhere;
`;

export const PreviewPanel = styled.div<{ $flush?: boolean; $plainBackground?: boolean }>`
    position: relative;
    z-index: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${({ $flush }) => $flush ? '0' : '24px'};
    background: ${({ theme, $plainBackground }) => $plainBackground
        ? theme.colors.bg.secondary
        : `
            linear-gradient(45deg, ${theme.colors.bg.primary} 25%, transparent 25%),
            linear-gradient(-45deg, ${theme.colors.bg.primary} 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, ${theme.colors.bg.primary} 75%),
            linear-gradient(-45deg, transparent 75%, ${theme.colors.bg.primary} 75%),
            ${theme.colors.bg.tertiary}
        `};
    background-size: ${({ $plainBackground }) => $plainBackground ? 'auto' : '20px 20px'};
    background-position: ${({ $plainBackground }) => $plainBackground ? 'initial' : '0 0, 0 10px, 10px -10px, -10px 0'};
    overflow: ${({ $flush }) => $flush ? 'hidden' : 'auto'};

    @media (max-width: 800px) {
        min-height: 420px;
    }
`;

export const ImagePreview = styled.img`
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: ${({ theme }) => theme.radius.md};
    background:
        linear-gradient(45deg, ${({ theme }) => theme.colors.bg.primary} 25%, transparent 25%),
        linear-gradient(-45deg, ${({ theme }) => theme.colors.bg.primary} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${({ theme }) => theme.colors.bg.primary} 75%),
        linear-gradient(-45deg, transparent 75%, ${({ theme }) => theme.colors.bg.primary} 75%),
        ${({ theme }) => theme.colors.bg.tertiary};
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
    box-shadow: ${({ theme }) => theme.shadow.lg};
`;

export const VideoPreview = styled.video`
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
`;

export const AudioPreview = styled.div`
    width: min(520px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 38px;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    color: ${({ theme }) => theme.colors.accent.primary};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const AudioName = styled.strong`
    max-width: 100%;
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const AudioControl = styled.audio`
    width: 100%;
`;

export const PdfPreview = styled.iframe`
    width: 100%;
    height: 100%;
    min-height: 540px;
    border: 0;
    background: #fff;
`;

export const TextEditor = styled.div`
    width: 100%;
    height: 100%;
    min-height: 420px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const EditorToolbar = styled.div`
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px 8px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
`;

export const EditorStatus = styled.span<{ $status: 'error' | 'dirty' | 'saved' }>`
    color: ${({ theme, $status }) =>
        $status === 'error'
            ? theme.colors.accent.error
            : $status === 'dirty'
                ? theme.colors.accent.warning
                : theme.colors.brand};
    font-size: 11px;
    font-weight: 600;
`;

export const EditorSurface = styled.div`
    min-width: 0;
    min-height: 0;
`;

export const EditorMessage = styled.div<{ $error?: boolean }>`
    color: ${({ theme, $error }) => $error ? theme.colors.accent.error : theme.colors.text.tertiary};
    font-size: 12px;
`;

export const UnsupportedPreview = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 360px;
    padding: 36px;
    text-align: center;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.bg.secondary};
`;

export const UnsupportedIcon = styled.div`
    color: ${({ theme }) => theme.colors.text.tertiary};
`;

export const UnsupportedTitle = styled.h3`
    color: ${({ theme }) => theme.colors.text.primary};
    font-size: 15px;
`;

export const UnsupportedText = styled.p`
    margin-bottom: 8px;
    color: ${({ theme }) => theme.colors.text.tertiary};
    font-size: 12px;
    line-height: 1.5;
`;
