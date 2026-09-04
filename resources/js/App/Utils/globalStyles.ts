import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
    *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    html {
        --pf-border-default: ${({ theme }) => theme.colors.border.default};

        color-scheme: ${({ theme }) => theme.mode};
        font-size: 14px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    body {
        font-family: ${({ theme }) => theme.font.sans};
        background: ${({ theme }) => theme.colors.bg.primary};
        color: ${({ theme }) => theme.colors.text.primary};
        line-height: 1.5;
        overflow-x: hidden;
        transition: background 200ms ease, color 200ms ease;
    }

    a {
        color: inherit;
        text-decoration: none;
    }

    button {
        cursor: pointer;
        border: none;
        background: none;
        font-family: inherit;
        font-size: inherit;
    }

    input, textarea, select {
        font-family: inherit;
        font-size: inherit;
    }

    ::selection {
        background: ${({ theme }) => theme.colors.accent.primary};
        color: white;
    }

    ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }

    ::-webkit-scrollbar-track {
        background: transparent;
    }

    ::-webkit-scrollbar-thumb {
        background: ${({ theme }) => theme.colors.border.light};
        border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: ${({ theme }) => theme.colors.text.tertiary};
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .workbench-hover-container {
        display: none !important;
    }

    /* CodeMirror reference decorations: the ID stays in the buffer, the
       human-readable label is rendered next to it as injected text. */
    .cm-editor .pf-ref-id {
        opacity: 0.45;
    }

    /* Must not alter layout metrics (no margin/padding/font-size): CodeMirror maps
       columns to pixels assuming the editor font, so any width change here
       shifts the caret on the whole line. Horizontal padding is emulated with
       non-breaking spaces injected in the label content itself. */
    .cm-editor .pf-ref-label {
        border-radius: 4px;
        background: ${({ theme }) => theme.colors.accent.infoBg};
        color: ${({ theme }) => theme.colors.accent.info};
    }

    body > div > .cm-tooltip,
    body > div > .cm-tooltip.cm-tooltip-autocomplete,
    body > div > .cm-tooltip.cm-completionInfo,
    body > div > .cm-tooltip .cm-tooltip {
        z-index: 10000;
        color: ${({ theme }) => theme.colors.text.primary};
        background: ${({ theme }) => theme.colors.bg.primary};
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: ${({ theme }) => theme.radius.sm};
        box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
        pointer-events: auto !important;
    }

    body > div > .cm-tooltip-autocomplete {
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

    body > div > .cm-tooltip-autocomplete:not(:has(> .cm-completionInfo)) {
        margin-left: 0 !important;
    }

    body > div > .cm-tooltip-autocomplete > ul {
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
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 12px;
        line-height: 1.35;
        pointer-events: auto !important;
    }

    body > div > .cm-tooltip-autocomplete > ul > li {
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

    body > div > .cm-tooltip-autocomplete > ul > li[aria-selected] {
        color: ${({ theme }) => theme.colors.text.primary} !important;
        background: ${({ theme }) => theme.colors.bg.tertiary} !important;
    }

    body > div > .cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionLabel {
        color: ${({ theme }) => theme.colors.text.primary} !important;
    }

    body > div > .cm-tooltip .cm-pf-completion-kind {
        display: inline-block;
        width: 14px;
        height: 14px;
        flex: 0 0 16px;
        color: ${({ theme }) => theme.colors.text.tertiary};
        background: currentColor;
        mask: var(--pf-completion-kind-icon) center / contain no-repeat;
    }

    body > div > .cm-tooltip .cm-pf-completion-kind-function,
    body > div > .cm-tooltip .cm-pf-completion-kind-method {
        color: ${({ theme }) => theme.colors.accent.primary};
    }

    body > div > .cm-tooltip .cm-pf-completion-kind-namespace {
        color: ${({ theme }) => theme.colors.accent.info};
    }

    body > div > .cm-tooltip .cm-pf-completion-kind-constant {
        color: ${({ theme }) => theme.colors.accent.warning};
    }

    body > div > .cm-tooltip .cm-completionLabel {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    body > div > .cm-tooltip .cm-completionDetail {
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

    body > div > .cm-tooltip .cm-section-header {
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

    body > div > .cm-tooltip.cm-completionInfo,
    body > div > .cm-tooltip-autocomplete > .cm-completionInfo {
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
        overflow-x: hidden !important;
        overflow-y: auto !important;
        border: 1px solid ${({ theme }) => theme.colors.border.default} !important;
        border-radius: 0;
        background: ${({ theme }) => theme.colors.bg.tertiary};
        box-shadow: none !important;
        white-space: normal;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-info {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        overflow-wrap: anywhere;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-info code,
    body > div > .cm-tooltip .cm-puppetflow-hover code {
        display: block;
        max-width: 100%;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        color: ${({ theme }) => theme.colors.accent.primary};
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 12px;
        font-weight: 600;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-info p,
    body > div > .cm-tooltip .cm-puppetflow-hover p {
        max-width: 100%;
        margin: 10px 0 0;
        overflow-wrap: anywhere;
        white-space: normal;
        color: ${({ theme }) => theme.colors.text.secondary};
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 12px;
        line-height: 1.5;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-details {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: 5px 10px;
        margin: 12px 0 0;
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 11px;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-details dt {
        color: ${({ theme }) => theme.colors.text.tertiary};
        font-weight: 600;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-details dd {
        min-width: 0;
        margin: 0;
        overflow-wrap: anywhere;
        color: ${({ theme }) => theme.colors.text.primary};
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-schema {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid ${({ theme }) => theme.colors.border.default};
        font-family: ${({ theme }) => theme.font.sans};
        font-size: 11px;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-schema > strong {
        display: block;
        margin-bottom: 6px;
        color: ${({ theme }) => theme.colors.text.primary};
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-schema > div {
        display: flex;
        min-width: 0;
        justify-content: space-between;
        gap: 12px;
        padding: 3px 0;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-schema code {
        display: inline;
        min-width: 0;
        overflow-wrap: anywhere;
        color: ${({ theme }) => theme.colors.text.primary};
        font-size: 11px;
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-schema span {
        flex: 0 0 auto;
        color: ${({ theme }) => theme.colors.text.tertiary};
    }

    body > div > .cm-tooltip .cm-puppetflow-completion-info pre {
        margin: 12px 0 0;
        padding: 9px 10px;
        overflow: hidden;
        border: 1px solid ${({ theme }) => theme.colors.border.default};
        border-radius: 6px;
        background: ${({ theme }) => theme.colors.bg.secondary};
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 11px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }

    body > div > .cm-tooltip .cm-puppetflow-doc-link {
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

    body > div > .cm-tooltip .cm-puppetflow-doc-link::after {
        content: '↗';
    }

    body > div > .cm-tooltip .cm-puppetflow-doc-link:hover {
        color: ${({ theme }) => theme.colors.accent.primaryHover};
    }
`;
