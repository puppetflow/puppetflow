import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { CodeEditorTheme } from './types';

const githubLight = HighlightStyle.define([
    { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },
    { tag: [tags.keyword, tags.modifier], color: '#cf222e' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#8250df' },
    { tag: [tags.definition(tags.variableName), tags.variableName], color: '#24292f' },
    { tag: [tags.propertyName, tags.attributeName], color: '#116329' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#953800' },
    { tag: [tags.string, tags.special(tags.string)], color: '#0a3069' },
    { tag: [tags.number, tags.bool, tags.null], color: '#0550ae' },
    { tag: [tags.regexp, tags.escape], color: '#116329' },
    { tag: [tags.tagName, tags.heading], color: '#116329' },
    { tag: [tags.operator, tags.punctuation], color: '#57606a' },
    { tag: tags.invalid, color: '#ffffff', backgroundColor: '#cf222e' },
]);

const githubDark = HighlightStyle.define([
    { tag: tags.comment, color: '#7d8590', fontStyle: 'italic' },
    { tag: [tags.keyword, tags.modifier], color: '#f17f87' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#cba9f2' },
    { tag: [tags.definition(tags.variableName), tags.variableName], color: '#e2e8f0' },
    { tag: [tags.propertyName, tags.attributeName], color: '#86d58e' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#efa466' },
    { tag: [tags.string, tags.special(tags.string)], color: '#a6cef0' },
    { tag: [tags.number, tags.bool, tags.null], color: '#83bcf0' },
    { tag: [tags.regexp, tags.escape], color: '#86d58e' },
    { tag: [tags.tagName, tags.heading], color: '#86d58e' },
    { tag: [tags.operator, tags.punctuation], color: '#b4bfce' },
    { tag: tags.invalid, color: '#f0f6fc', backgroundColor: '#f85149' },
]);

export const codeEditorTheme = (theme: CodeEditorTheme): Extension => {
    const dark = theme === 'vs-dark' || theme === 'dark';
    return [
        EditorView.theme({}, { dark }),
        syntaxHighlighting(dark ? githubDark : githubLight),
    ];
};
