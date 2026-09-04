import { setDiagnosticsEffect, type Diagnostic } from '@codemirror/lint';
import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

const buildDecorations = (
    state: EditorState,
    diagnostics: readonly Diagnostic[],
): DecorationSet => {
    const lineNumbers = new Set<number>();

    for (const diagnostic of diagnostics) {
        if (diagnostic.severity !== 'error') continue;

        const from = Math.min(diagnostic.from, state.doc.length);
        const to = Math.min(Math.max(diagnostic.to - 1, from), state.doc.length);
        const firstLine = state.doc.lineAt(from).number;
        const lastLine = state.doc.lineAt(to).number;

        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
            lineNumbers.add(lineNumber);
        }
    }

    return Decoration.set(
        Array.from(lineNumbers)
            .sort((left, right) => left - right)
            .map(lineNumber => Decoration.line({
                class: 'cm-error-line',
            }).range(state.doc.line(lineNumber).from)),
    );
};

export const errorLineDecorationExtension: Extension = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decorations, transaction) {
        let nextDecorations = decorations.map(transaction.changes);

        for (const effect of transaction.effects) {
            if (effect.is(setDiagnosticsEffect)) {
                nextDecorations = buildDecorations(transaction.state, effect.value);
            }
        }

        return nextDecorations;
    },
    provide: field => EditorView.decorations.from(field),
});
