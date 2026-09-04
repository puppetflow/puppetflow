import type { CompletionSection } from '@codemirror/autocomplete';

export const createCompletionSection = (
    name: string,
    rank: number,
): CompletionSection => ({
    name,
    rank,
    header(current) {
        const element = document.createElement('li');
        element.className = 'cm-section-header';
        element.textContent = current.name;
        return element;
    },
});

export const LOCAL_COMPLETION_SECTION = createCompletionSection('Local', 0);
