import type { Extension } from '@codemirror/state';
import { RangeSet } from '@codemirror/state';
import { Decoration, EditorView, gutter, GutterMarker } from '@codemirror/view';

export interface RunLineDecorations {
    passed?: number[];
    active?: number[];
    error?: number[];
}

class RunStateMarker extends GutterMarker {
    constructor(readonly state: 'passed' | 'active' | 'error') {
        super();
    }

    toDOM() {
        const marker = document.createElement('span');
        marker.className = `nop-run-line-${this.state}-gutter`;
        marker.title = this.state === 'error'
            ? 'Execution failed here'
            : this.state === 'active'
                ? 'Currently executing'
                : 'Executed';
        return marker;
    }
}

export function runLineDecorationExtension(
    code: string,
    lines: RunLineDecorations,
): Extension {
    const documentLines = code.split('\n').length;
    const states = ([
        ['passed', lines.passed ?? []],
        ['active', lines.active ?? []],
        ['error', lines.error ?? []],
    ] as const);
    const ranges = states.flatMap(([state, values]) => values
        .filter(line => line > 0 && line <= documentLines)
        .map(line => {
            const from = code.split('\n', line - 1).join('\n').length + (line > 1 ? 1 : 0);
            return Decoration.line({
                class: `nop-run-line-${state}`,
                attributes: { 'data-run-state': state },
            }).range(from);
        }));

    const markerByLine = new Map(states.flatMap(([state, values]) => (
        values.map(line => [line, state] as const)
    )));

    return [
        EditorView.decorations.of(Decoration.set(ranges, true)),
        gutter({
            class: 'cm-pf-run-state-gutter',
            markers(view) {
                return RangeSet.of(
                    [...markerByLine]
                        .filter(([line]) => line > 0 && line <= view.state.doc.lines)
                        .map(([line, state]) => (
                            new RunStateMarker(state).range(view.state.doc.line(line).from)
                        )),
                    true,
                );
            },
        }),
    ];
}
