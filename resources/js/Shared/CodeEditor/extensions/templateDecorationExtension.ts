import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

const TEMPLATE_PATTERN = /\{\{[\s\S]*?(?:\}\}|$)/g;

const buildDecorations = (state: EditorState, valid: boolean) => {
    const ranges = [...state.doc.toString().matchAll(TEMPLATE_PATTERN)].map(match => (
        Decoration.mark({
            class: valid
                ? 'nop-template-token'
                : 'nop-template-token nop-template-token-error',
        }).range(
            match.index ?? 0,
            (match.index ?? 0) + match[0].length,
        )
    ));
    return Decoration.set(ranges, true);
};

export const templateDecorationExtension = (valid: boolean): Extension => (
    StateField.define({
        create(state) {
            return buildDecorations(state, valid);
        },
        update(decorations, transaction) {
            if (!transaction.docChanged) return decorations.map(transaction.changes);
            return buildDecorations(transaction.state, valid);
        },
        provide: field => EditorView.decorations.from(field),
    })
);
