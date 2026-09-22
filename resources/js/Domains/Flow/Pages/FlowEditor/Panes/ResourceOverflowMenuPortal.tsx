import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
    type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ResourceOverflowMenu } from './shared.styled';

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 2;

interface ResourceOverflowMenuPortalProps {
    anchorRef: RefObject<HTMLElement | null>;
    children: ReactNode;
}

// The trigger and action lists sit in scrollable halves (overflow-y: auto) that
// clip an absolutely positioned menu at their edge. Rendered into <body> with a
// fixed position next to its anchor, the menu floats over every pane, and flips
// above the anchor when it would run past the bottom of the viewport.
export default function ResourceOverflowMenuPortal({ anchorRef, children }: ResourceOverflowMenuPortalProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });

    // Runs after the parent's ref has been attached (the anchor ref is only
    // bound to the open item), so the anchor can be measured on first render.
    useEffect(() => {
        const anchor = anchorRef.current;
        const menu = menuRef.current;
        if (!anchor || !menu) return;

        const anchorRect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const fitsBelow = anchorRect.bottom + ANCHOR_GAP + menuRect.height <= window.innerHeight - VIEWPORT_MARGIN;
        setStyle({
            position: 'fixed',
            top: fitsBelow
                ? anchorRect.bottom + ANCHOR_GAP
                : Math.max(VIEWPORT_MARGIN, anchorRect.top - ANCHOR_GAP - menuRect.height),
            left: Math.max(VIEWPORT_MARGIN, anchorRect.right - menuRect.width),
            right: 'auto',
            marginTop: 0,
        });
    }, [anchorRef]);

    return createPortal(
        <ResourceOverflowMenu
            ref={menuRef}
            style={style}
            // Outside-click dismissal listens on the document; a press inside
            // the menu must not count as outside just because it is portaled.
            onMouseDown={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
        >
            {children}
        </ResourceOverflowMenu>,
        document.body,
    );
}
