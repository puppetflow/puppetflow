import styled from 'styled-components';

export const EditorScope = styled.div<{
    $height: string;
    $fontFamily: string;
    $fontSize: number;
    $lineHeight?: number;
    $paddingTop: number;
    $paddingBottom: number;
    $contextMenu: boolean;
}>`
    width: 100%;
    height: ${({ $height }) => $height};
    min-width: 0;
    overflow: hidden;

    > .cm-theme,
    > .cm-theme-light,
    > .cm-theme-dark {
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background: ${({ theme }) => theme.colors.bg.primary};
    }

    .cm-editor {
        width: 100%;
        height: 100%;
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.primary} !important;
        font-family: ${({ $fontFamily }) => $fontFamily};
        font-size: ${({ $fontSize }) => $fontSize}px;
        line-height: ${({ $lineHeight }) => $lineHeight ? `${$lineHeight}px` : '1.55'};
    }

    .cm-scroller {
        height: 100%;
        min-height: 100%;
        overflow: auto;
        background: ${({ theme }) => theme.colors.bg.primary} !important;
        font-family: inherit;
    }

    .cm-content {
        align-self: stretch;
        box-sizing: border-box;
        min-height: 100% !important;
        padding-top: ${({ $paddingTop }) => $paddingTop}px;
        padding-bottom: ${({ $paddingBottom }) => $paddingBottom}px;
        background: ${({ theme }) => theme.colors.bg.primary} !important;
        caret-color: ${({ theme }) => theme.colors.text.primary};
    }

    .cm-gutters {
        color: ${({ theme }) => theme.colors.text.tertiary};
        background: ${({ theme }) => theme.colors.bg.primary};
        border: 0;
    }

    .cm-pf-code-gizmo-gutter {
        min-width: 26px;
    }

    .cm-pf-code-gizmo-line {
        display: flex;
        min-width: max-content;
        align-items: center;
        gap: 3px;
        padding: 0 4px;
    }

    .cm-pf-code-gizmo {
        display: grid;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        place-items: center;
        border-radius: 50%;
        background: ${({ theme }) => theme.colors.bg.elevated};
        box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.border.default};
    }

    .cm-pf-code-gizmo-favicon {
        background: ${({ theme }) => theme.colors.bg.secondary};
    }

    .cm-pf-code-gizmo img {
        width: 14px;
        height: 14px;
    }

    .cm-pf-code-gizmo-icon {
        width: 14px;
        height: 14px;
        background: var(--pf-gizmo-color);
        mask: var(--pf-gizmo-icon) center / contain no-repeat;
    }

    .cm-pf-code-gizmo-clickable {
        cursor: pointer;
    }

    .cm-activeLine,
    .cm-activeLineGutter {
        background: ${({ theme }) => theme.colors.bg.secondary};
    }

    .cm-line.cm-missing-await-line {
        background: ${({ theme }) => theme.colors.accent.warning}10 !important;
    }

    .cm-line.cm-error-line,
    .cm-line:has(.cm-pf-error-mark) {
        background: ${({ theme }) => theme.colors.accent.error}15 !important;
    }

    .cm-gutter-lint {
        width: 14px;
    }

    .cm-gutter-lint .cm-gutterElement {
        display: flex;
        align-items: stretch;
        padding: 0 4px;
    }

    .cm-lint-marker-error {
        width: 5px !important;
        height: auto !important;
        min-height: 100%;
        align-self: stretch;
        background: ${({ theme }) => theme.colors.accent.error};
        clip-path: none;
        content: none !important;
    }

    .cm-focused {
        outline: none;
    }

    .cm-selectionBackground,
    .cm-content ::selection {
        background: ${({ theme }) => theme.colors.accent.primary}33 !important;
    }

    .cm-content ::selection {
        color: ${({ theme }) => theme.colors.brandText} !important;
    }

    .cm-tooltip {
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.primary};
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: ${({ theme }) => theme.radius.sm};
        box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
        pointer-events: auto !important;
    }

    .cm-tooltip-autocomplete {
        display: block;
        width: min(380px, calc(55vw - 8px));
        height: auto;
        min-height: min(140px, calc(100vh - 16px));
        max-height: min(231px, calc(100vh - 16px));
        max-width: calc(100vw - 16px);
        overflow: visible;
        align-items: stretch;
        background: ${({ theme }) => theme.colors.bg.primary};
    }

    .cm-tooltip-autocomplete:not(:has(> .cm-completionInfo)) {
        margin-left: 0 !important;
    }

    .cm-tooltip-autocomplete > ul {
        width: 100%;
        height: auto;
        min-width: 0;
        max-width: 100%;
        min-height: 0 !important;
        max-height: min(231px, calc(100vh - 16px)) !important;
        padding: 4px;
        box-sizing: border-box;
        overflow-x: hidden !important;
        background: ${({ theme }) => theme.colors.bg.primary};
        font-family: inherit;
        font-size: 12px;
        line-height: 1.35;
        pointer-events: auto !important;
    }

    .cm-tooltip-autocomplete > ul > li {
        display: flex;
        min-width: 0;
        min-height: 26px;
        align-items: center;
        gap: 5px;
        padding: 3px 7px;
        overflow: hidden;
        border-radius: 0;
        cursor: pointer;
        pointer-events: auto !important;
    }

    .cm-tooltip-autocomplete > ul > li[aria-selected] {
        color: ${({ theme }) => theme.colors.text.primary} !important;
        background: ${({ theme }) => theme.colors.bg.tertiary} !important;
    }

    .cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionLabel {
        color: ${({ theme }) => theme.colors.text.primary} !important;
    }

    .cm-pf-completion-kind {
        display: inline-block;
        width: 14px;
        height: 14px;
        flex: 0 0 16px;
        color: ${({ theme }) => theme.colors.text.tertiary};
        background: currentColor;
        mask: var(--pf-completion-kind-icon) center / contain no-repeat;
    }

    .cm-pf-completion-kind-function,
    .cm-pf-completion-kind-method {
        color: ${({ theme }) => theme.colors.accent.primary};
    }

    .cm-pf-completion-kind-namespace {
        color: ${({ theme }) => theme.colors.accent.info};
    }

    .cm-pf-completion-kind-constant {
        color: ${({ theme }) => theme.colors.accent.warning};
    }

    .cm-completionLabel {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cm-completionDetail {
        display: block;
        min-width: 0;
        max-width: 48%;
        flex: 0 1 auto;
        margin-left: auto;
        overflow: hidden;
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-size: 11px;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cm-section-header {
        position: sticky;
        z-index: 2;
        top: 0;
        min-height: 22px !important;
        padding: 5px 7px !important;
        border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.primary} !important;
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .cm-completionInfo {
        position: absolute !important;
        top: 0 !important;
        bottom: 0 !important;
        width: min(324px, calc(45vw - 8px)) !important;
        height: auto !important;
        min-width: 0;
        max-width: calc(100vw - 24px);
        min-height: 100%;
        max-height: 100%;
        padding: 12px 14px;
        box-sizing: border-box;
        border: 1px solid ${({ theme }) => theme.colors.border.default} !important;
        border-radius: 0;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        white-space: normal;
        background: ${({ theme }) => theme.colors.bg.tertiary};
        box-shadow: none !important;
    }

    .cm-puppetflow-completion-info {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        overflow-wrap: anywhere;
    }

    .cm-puppetflow-completion-info code,
    .cm-puppetflow-hover code {
        display: block;
        max-width: 100%;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        color: ${({ theme }) => theme.colors.accent.primary};
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
    }

    .cm-puppetflow-completion-info p,
    .cm-puppetflow-hover p {
        max-width: 100%;
        margin: 10px 0 0;
        overflow-wrap: anywhere;
        white-space: normal;
        color: ${({ theme }) => theme.colors.text.secondary};
        font-family: sans-serif;
        font-size: 12px;
        line-height: 1.5;
    }

    .cm-puppetflow-completion-details {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: 5px 10px;
        margin: 12px 0 0;
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 11px;
    }

    .cm-puppetflow-completion-details dt {
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-weight: 600;
    }

    .cm-puppetflow-completion-details dd {
        min-width: 0;
        margin: 0;
        overflow-wrap: anywhere;
        color: ${({ theme }) => theme.colors.text.primary};
    }

    .cm-puppetflow-completion-schema {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid ${({ theme }) => theme.colors.border.default};
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 11px;
    }

    .cm-puppetflow-completion-schema > strong {
        display: block;
        margin-bottom: 6px;
        color: ${({ theme }) => theme.colors.text.primary};
    }

    .cm-puppetflow-completion-schema > div {
        display: flex;
        min-width: 0;
        justify-content: space-between;
        gap: 12px;
        padding: 3px 0;
    }

    .cm-puppetflow-completion-schema code {
        display: inline;
        min-width: 0;
        overflow-wrap: anywhere;
        color: ${({ theme }) => theme.colors.text.primary};
        font-size: 11px;
    }

    .cm-puppetflow-completion-schema span {
        flex: 0 0 auto;
        color: ${({ theme }) => theme.colors.text.tertiary};
    }

    .cm-puppetflow-completion-info pre {
        margin: 12px 0 0;
        padding: 9px 10px;
        overflow: hidden;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: 6px;
        background: ${({ theme }) => theme.colors.bg.secondary};
        font-family: inherit;
        font-size: 11px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }

    .cm-puppetflow-doc-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid ${({ theme }) => theme.colors.border.default};
        color: ${({ theme }) => theme.colors.accent.primary};
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 11px;
        font-weight: 650;
        text-decoration: none;
    }

    .cm-puppetflow-doc-link::after {
        content: '↗';
    }

    .cm-puppetflow-doc-link:hover {
        color: ${({ theme }) => theme.colors.accent.primaryHover};
    }

    .cm-puppetflow-hover {
        max-width: 420px;
        padding: 10px 12px;
    }

    ${({ $contextMenu }) => !$contextMenu && `
        .cm-panels,
        .cm-search {
            display: none;
        }
    `}
`;
