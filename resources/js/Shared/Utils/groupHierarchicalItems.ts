export interface GroupHeader {
    label: string;
    depth: number;
    key: string;
    count: number;
}

export interface GroupedSection<T> {
    group: string | null;
    items: T[];
    headers: GroupHeader[];
}

export const DEFAULT_GROUP = 'Default';

// Ungrouped items and groups rooted at "Default", whatever its case, share a single "Default" tree.
export function resolveGroupPath(group: string | null | undefined): string {
    if (!group) return DEFAULT_GROUP;
    const [root, ...rest] = group.split('/');
    return root.toLowerCase() === DEFAULT_GROUP.toLowerCase()
        ? [DEFAULT_GROUP, ...rest].join('/')
        : group;
}

export function isDefaultGroupPath(group: string): boolean {
    return group === DEFAULT_GROUP || group.startsWith(`${DEFAULT_GROUP}/`);
}

// Orders group paths so the "Default" tree comes last, its own items before its subgroups.
export function compareGroupPaths(left: string, right: string): number {
    const leftDefault = isDefaultGroupPath(left);
    const rightDefault = isDefaultGroupPath(right);
    if (leftDefault !== rightDefault) return leftDefault ? 1 : -1;
    if (left === DEFAULT_GROUP) return -1;
    if (right === DEFAULT_GROUP) return 1;
    return 0;
}

export function groupHierarchicalItems<T>(
    items: T[],
    getGroup: (item: T) => string | null | undefined,
): GroupedSection<T>[] {
    if (items.every(item => !getGroup(item))) {
        return items.length > 0 ? [{ group: null, items, headers: [] }] : [];
    }

    const itemsByGroup = new Map<string, T[]>();
    for (const item of items) {
        const group = resolveGroupPath(getGroup(item));
        const groupItems = itemsByGroup.get(group);
        if (groupItems) groupItems.push(item);
        else itemsByGroup.set(group, [item]);
    }

    const groupCounts: Record<string, number> = {};
    for (const [group, groupItems] of itemsByGroup) {
        const segments = group.split('/');
        for (let index = 0; index < segments.length; index++) {
            const path = segments.slice(0, index + 1).join('/');
            groupCounts[path] = (groupCounts[path] ?? 0) + groupItems.length;
        }
    }

    const rendered = new Set<string>();
    return [...itemsByGroup.keys()]
        .sort(compareGroupPaths)
        .map(group => {
            const headers: GroupHeader[] = [];
            const segments = group.split('/');
            for (let index = 0; index < segments.length; index++) {
                const path = segments.slice(0, index + 1).join('/');
                if (!rendered.has(path)) {
                    rendered.add(path);
                    headers.push({
                        label: segments[index],
                        depth: index,
                        key: path,
                        count: groupCounts[path] ?? 0,
                    });
                }
            }
            return { group, items: itemsByGroup.get(group)!, headers };
        });
}
