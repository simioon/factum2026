const STORAGE_KEY = 'cyfrowy_asystent_demo_user_id';

export function createInitialWizardState() {
    return {
        stepIndex: 0,
        loadedEvalId: null,
        scores: {},
        justification: '',
        iprz: '',
        requestRankPromotion: false,
        evidenceFilter: null,
        selectedEvidenceKeys: [],
        usedIprzPills: [],
    };
}

export const state = {
    dictionaries: null,
    users: [],
    currentUserId: loadStoredUserId(),
    managerActiveTab: 'team',
    directorActiveTab: 'requests',
    selectedEmployeeId: null,
    profileActiveTab: 'setup',

    workspace: null,
    selfWorkspace: null,
    managerHistory: [],
    appeals: [],
    rankRequests: [],

    wizard: createInitialWizardState(),
};

function loadStoredUserId() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    } catch {
        return null;
    }
}

export function setCurrentUserId(id) {
    state.currentUserId = id ? Number(id) : null;
    try {
        if (state.currentUserId) {
            sessionStorage.setItem(STORAGE_KEY, String(state.currentUserId));
        } else {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Ignore storage errors
    }
}

export function resetWizardState() {
    state.wizard = createInitialWizardState();
}
