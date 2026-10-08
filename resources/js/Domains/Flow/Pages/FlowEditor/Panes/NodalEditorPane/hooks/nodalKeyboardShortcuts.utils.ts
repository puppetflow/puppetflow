export function hasOpenModal(): boolean {
    return document.querySelector('[data-modal-overlay]') !== null;
}

// The topmost modal blocks shortcuts unless it hosts the pane itself. Background modal
// portals are siblings in the DOM and must not block a canvas rendered in a nested modal.
export function hasBlockingModal(canvas: Element | null): boolean {
    const overlays = document.querySelectorAll('[data-modal-overlay]');
    const topOverlay = overlays[overlays.length - 1];

    return Boolean(topOverlay && (!canvas || !topOverlay.contains(canvas)));
}

export function hasTextSelection(): boolean {
    const selection = window.getSelection();
    return Boolean(selection && selection.rangeCount > 0 && !selection.isCollapsed);
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
