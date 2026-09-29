export function hasOpenModal(): boolean {
    return document.querySelector('[data-modal-overlay]') !== null;
}

// Modals stacked above the pane block its shortcuts. A modal hosting the pane itself (run
// detail snapshot) does not: its read-only canvas must keep selection and copy shortcuts.
export function hasBlockingModal(canvas: Element | null): boolean {
    return Array.from(document.querySelectorAll('[data-modal-overlay]'))
        .some(overlay => !canvas || !overlay.contains(canvas));
}

const EDITABLE_TARGET_SELECTOR = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]',
    '.monaco-editor',
    '.cm-editor',
].join(', ');

export function isEditableShortcutTarget(event: KeyboardEvent): boolean {
    const path = event.composedPath();

    if (path.some(item => item instanceof Element && item.matches(EDITABLE_TARGET_SELECTOR))) {
        return true;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(EDITABLE_TARGET_SELECTOR)) {
        return true;
    }

    const activeElement = document.activeElement;
    return activeElement instanceof Element && Boolean(activeElement.closest(EDITABLE_TARGET_SELECTOR));
}
