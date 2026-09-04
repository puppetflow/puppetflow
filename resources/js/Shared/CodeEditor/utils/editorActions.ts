import { EditorSelection, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export const EXTERNAL_EDITOR_UPDATE = Transaction.addToHistory.of(false);

export function replaceEditorRange(
    view: EditorView,
    from: number,
    to: number,
    insert: string,
    selectionOffset = insert.length,
) {
    const cursor = from + selectionOffset;
    view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.cursor(cursor),
        scrollIntoView: true,
        userEvent: 'input.complete',
    });
    view.focus();
}

export function replaceEditorSelection(
    view: EditorView,
    insert: string,
    selectionOffset = insert.length,
) {
    const selection = view.state.selection.main;
    replaceEditorRange(view, selection.from, selection.to, insert, selectionOffset);
}

export function setEditorValue(view: EditorView, value: string) {
    if (view.state.doc.toString() === value) return;

    const anchor = Math.min(view.state.selection.main.anchor, value.length);
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        selection: EditorSelection.cursor(anchor),
        annotations: EXTERNAL_EDITOR_UPDATE,
    });
}

export function revealEditorPosition(view: EditorView, position: number) {
    const anchor = Math.max(0, Math.min(position, view.state.doc.length));
    view.dispatch({
        selection: EditorSelection.cursor(anchor),
        effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
    });
    view.focus();
}

export function focusEditorPosition(view: EditorView, position: number) {
    const anchor = Math.max(0, Math.min(position, view.state.doc.length));
    view.dispatch({ selection: EditorSelection.cursor(anchor) });
    view.focus();
}
