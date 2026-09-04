import { RangeSet, type Extension } from '@codemirror/state';
import {
    gutter,
    GutterMarker,
    type EditorView,
    ViewPlugin,
} from '@codemirror/view';
import { getCodeGizmos, type CodeGizmo } from '@/Domains/Flow/Pages/FlowEditor/utils/codeGizmos';
import { getLocalIconUrl } from '@/Shared/UI/Icon/Icon';

interface IndexedGizmo {
    gizmo: CodeGizmo;
    index: number;
}

const createGizmoElement = (
    { gizmo, index }: IndexedGizmo,
    clickable: boolean,
    favicon = false,
) => {
    const container = document.createElement('span');
    container.className = [
        'cm-pf-code-gizmo',
        gizmo.kind === 'selector' ? 'cm-pf-code-gizmo-selector' : '',
        favicon ? 'cm-pf-code-gizmo-favicon' : '',
        clickable ? 'cm-pf-code-gizmo-clickable' : '',
    ].filter(Boolean).join(' ');
    container.title = favicon ? gizmo.siteHostname ?? gizmo.name : gizmo.description;
    container.dataset.gizmoIndex = String(index);
    container.dataset.gizmoRole = favicon ? 'favicon' : 'gizmo';

    if (favicon && gizmo.faviconUrl) {
        const image = document.createElement('img');
        image.src = gizmo.faviconUrl;
        image.alt = '';
        container.appendChild(image);
    } else {
        const icon = document.createElement('span');
        icon.className = 'cm-pf-code-gizmo-icon';
        icon.style.setProperty('--pf-gizmo-color', gizmo.color);
        icon.style.setProperty('--pf-gizmo-icon', `url("${getLocalIconUrl(gizmo.icon)}")`);
        container.appendChild(icon);
    }
    return container;
};

class CodeGizmoLineMarker extends GutterMarker {
    constructor(
        readonly gizmos: IndexedGizmo[],
        readonly clickable: boolean,
    ) {
        super();
    }

    toDOM() {
        const container = document.createElement('span');
        container.className = 'cm-pf-code-gizmo-line';
        this.gizmos.forEach(indexedGizmo => {
            container.appendChild(createGizmoElement(indexedGizmo, this.clickable));
            if (indexedGizmo.gizmo.faviconUrl) {
                container.appendChild(createGizmoElement(indexedGizmo, this.clickable, true));
            }
        });
        return container;
    }
}

export function codeGizmoExtension(
    code: string,
    {
        selectorGizmos = true,
        onClick,
    }: {
        selectorGizmos?: boolean;
        onClick?: (gizmo: CodeGizmo, forceOnboarding?: boolean) => void;
    } = {},
): Extension {
    const gizmos = getCodeGizmos(code)
        .filter(gizmo => selectorGizmos || gizmo.kind !== 'selector');
    const indexedGizmos = gizmos.map((gizmo, index) => ({ gizmo, index }));
    const byLine = new Map<number, IndexedGizmo[]>();
    indexedGizmos.forEach(indexedGizmo => {
        const lineGizmos = byLine.get(indexedGizmo.gizmo.lineNumber) ?? [];
        lineGizmos.push(indexedGizmo);
        byLine.set(indexedGizmo.gizmo.lineNumber, lineGizmos);
    });
    let pressed: { gizmo: CodeGizmo; timer: ReturnType<typeof setTimeout> | null } | null = null;

    const markerAt = (view: EditorView) => RangeSet.of(
        Array.from(byLine)
            .filter(([lineNumber]) => lineNumber <= view.state.doc.lines)
            .sort(([leftLine], [rightLine]) => leftLine - rightLine)
            .map(([lineNumber, lineGizmos]) => new CodeGizmoLineMarker(
                lineGizmos,
                Boolean(onClick),
            ).range(
                view.state.doc.line(lineNumber).from,
            )),
        true,
    );

    const eventGizmo = (event: Event) => {
        const element = (event.target as HTMLElement).closest<HTMLElement>('[data-gizmo-index]');
        if (!element) return null;
        const indexedGizmo = indexedGizmos[Number(element.dataset.gizmoIndex)];
        return indexedGizmo
            ? { gizmo: indexedGizmo.gizmo, role: element.dataset.gizmoRole }
            : null;
    };

    return [
        gutter({
            class: 'cm-pf-code-gizmo-gutter',
            markers: markerAt,
            domEventHandlers: {
            mousedown(_view, _line, event) {
                const target = eventGizmo(event);
                if (!target) return false;
                const { gizmo } = target;
                if (target.role === 'favicon' && gizmo.targetUrl) {
                    window.open(gizmo.targetUrl, '_blank', 'noopener,noreferrer');
                    return true;
                }
                if (!onClick) return false;
                if (gizmo.kind === 'helper') {
                    onClick(gizmo);
                    return true;
                }
                const timer = setTimeout(() => {
                    onClick(gizmo, true);
                    pressed = null;
                }, 550);
                pressed = { gizmo, timer };
                return true;
            },
            mouseup(_view, _line, event) {
                if (!pressed) return false;
                if (pressed.timer) clearTimeout(pressed.timer);
                const { gizmo } = pressed;
                pressed = null;
                if (eventGizmo(event)?.gizmo !== gizmo) return false;
                onClick?.(gizmo, (event as MouseEvent).shiftKey);
                return true;
            },
            mouseleave() {
                if (pressed?.timer) clearTimeout(pressed.timer);
                pressed = null;
                return false;
            },
            },
        }),
        ViewPlugin.define(() => ({
            destroy() {
                if (pressed?.timer) clearTimeout(pressed.timer);
                pressed = null;
            },
        })),
    ];
}
