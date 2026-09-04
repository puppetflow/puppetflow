import type { HelpEntryDef } from '@/Domains/Flow/Pages/FlowEditor/types';

const DOCUMENTATION_PAGE_GROUPS = [
    {
        path: '/reference/flow-api/navigation',
        names: new Set([
            '$gotoUrl', '$gotoTab', '$setViewport', '$screenshot',
            '$saveCookies', '$loadCookies', '$loginRemember',
        ]),
    },
    {
        path: '/reference/flow-api/interaction',
        names: new Set([
            '$keyboardSpeed', '$fillInput', '$clickElement', '$clickElementAtIndex',
            '$clickAtCoordinates', '$scrollByPixels', '$scrollToElement', '$selectElement',
            '$selectManyElements', '$selectAtIndex', '$extractAttribute', '$extractAttributes',
            '$waitForSelectorCondition', '$selectShadow', '$shadowInputFill',
        ]),
    },
    {
        path: '/reference/flow-api/page-evaluation',
        names: new Set([
            '$injectScriptLibrary', '$bridgeEvaluate', '$httpRequest',
            '$sniffNetwork', '$stopSniffing',
        ]),
    },
    {
        path: '/reference/flow-api/files',
        names: new Set([
            '$writeFile', '$download', '$downloadFromBrowser', '$waitForFile', '$upload',
            '$unzipFile', '$scanDirectory', '$scanDownloadsDirectory', '$moveDownloadedFile',
            '$getDownloadsPathFile', '$pdfSearch', '$pdfGetText',
        ]),
    },
    {
        path: '/reference/flow-api/utilities',
        names: new Set([
            '$sleep', '$stopwatchStart', '$stopwatchCheck', '$stopwatchStop',
            '$if', '$ifEmpty', '$max', '$min', '$log', '$legend', '$meta', '$vars',
            '$matchSequence', '$parseDates', '$sortDates', '$currentDate',
            '$currentDateMinusOneMonth', '$currentDatePlusOneMonth',
        ]),
    },
    {
        path: '/reference/flow-api/response',
        names: new Set([
            '$setOutput', '$generateResponse', '$generateResponseSuccess',
            '$generateResponseError', '$stopSuccess', '$stopFail',
        ]),
    },
    {
        path: '/reference/flow-api/notifications',
        names: new Set(['$notify', '$waitHumanValidation']),
    },
    {
        path: '/reference/flow-api/email',
        names: new Set(['$waitForEmail']),
    },
    {
        path: '/reference/flow-api/debugging',
        names: new Set(['$breakpoint']),
    },
    {
        path: '/reference/magic-methods',
        names: new Set([
            '$dataTableInsertRow', '$dataTableUpdateRows', '$dataTableUpsertRows',
            '$dataTableRowExists', '$dataTableRowDoesNotExist', '$dataTableGetRows',
            '$dataTableDeleteRows', '$dataTableCreate', '$dataTableDelete',
            '$dataTableList', '$dataTableUpdate', '$aiMessage', '$aiControl',
        ]),
    },
];

const CORE_VISUAL_NODE_NAMES = new Set([
    'RUN', 'TERMINATE', 'FUNCTION', 'Code', 'Set', 'If / Else', 'Loop',
    'Filter', 'Limit', 'Merge', 'No-op', 'Function', '__sticky_note',
]);

const documentationAnchor = (name: string) => name
    .replace(/^\$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

export const getHelpEntryDocumentationPath = (entry: HelpEntryDef): string | null => {
    if (CORE_VISUAL_NODE_NAMES.has(entry.name)) {
        return '/guide/nodal-flows#core-visual-nodes';
    }

    const group = DOCUMENTATION_PAGE_GROUPS.find(candidate => candidate.names.has(entry.name));
    return group ? `${group.path}#${documentationAnchor(entry.name)}` : null;
};

// Width reserved on the right of a catalogue entry for its documentation (20px) and snippet edit (32px) links.
export const getHelpEntryActionsWidth = (entry: HelpEntryDef, documentationPath: string | null) => (
    (documentationPath ? 20 : 0) + (entry.editUrl ? 32 : 0)
);
