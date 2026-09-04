export interface ResourceArgumentRule {
    argumentIndex: number;
    idPrefix?: string;
}

export const DATA_TABLE_RESOURCE_HELPERS = new Set([
    'dataTableInsertRow',
    'dataTableUpdateRows',
    'dataTableUpsertRows',
    'dataTableRowExists',
    'dataTableRowDoesNotExist',
    'dataTableGetRows',
    'dataTableDeleteRows',
    'dataTableDelete',
    'dataTableUpdate',
]);

const RESOURCE_ARGUMENT_RULES: Record<string, ResourceArgumentRule> = {
    vars: { argumentIndex: 0, idPrefix: 'var' },
    notify: { argumentIndex: 0, idPrefix: 'chan' },
    waitHumanValidation: { argumentIndex: 0, idPrefix: 'chan' },
    aiMessage: { argumentIndex: 0, idPrefix: 'aim' },
    aiControl: { argumentIndex: 0, idPrefix: 'aim' },
    waitForEmail: { argumentIndex: 0, idPrefix: 'mbwa' },
    gotoUrl: { argumentIndex: 1 },
    gotoTab: { argumentIndex: 0 },
    stopwatchStart: { argumentIndex: 0 },
    stopwatchStop: { argumentIndex: 0 },
    stopwatchCheck: { argumentIndex: 0 },
    sniffNetwork: { argumentIndex: 0 },
    stopSniffing: { argumentIndex: 0 },
    saveCookies: { argumentIndex: 0 },
    loadCookies: { argumentIndex: 0 },
};

export function getResourceArgumentRule(helper: string): ResourceArgumentRule | undefined {
    if (DATA_TABLE_RESOURCE_HELPERS.has(helper)) {
        return { argumentIndex: 0, idPrefix: 'dtbl' };
    }
    return RESOURCE_ARGUMENT_RULES[helper];
}
