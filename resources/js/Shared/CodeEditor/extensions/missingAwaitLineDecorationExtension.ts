import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { getMissingAwaitCalls } from '@/Domains/Flow/Pages/FlowEditor/utils/missingAwaits';

const buildDecorations = (state: EditorState): DecorationSet => {
    const lineNumbers = new Set(
        getMissingAwaitCalls(state.doc.toString()).map(call => call.lineNumber),
    );

    return Decoration.set(
        Array.from(lineNumbers)
            .filter(lineNumber => lineNumber <= state.doc.lines)
            .sort((left, right) => left - right)
            .map(lineNumber => Decoration.line({
                class: 'cm-missing-await-line',
            }).range(state.doc.line(lineNumber).from)),
    );
};

export const missingAwaitLineDecorationExtension: Extension = StateField.define<DecorationSet>({
    create: buildDecorations,
    update(decorations, transaction) {
        return transaction.docChanged ? buildDecorations(transaction.state) : decorations;
    },
    provide: field => EditorView.decorations.from(field),
});
