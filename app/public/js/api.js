import { state } from './state.js';

export async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.currentUserId) {
        headers.set('X-User-Id', String(state.currentUserId));
    }
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(path, {
        ...options,
        headers,
    });

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
        const message = (data && data.error) || `Błąd HTTP ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }

    return data;
}

export const api = {
    getHealth: () => apiFetch('/api/health'),
    resetDemoData: () => apiFetch('/api/demo/reset', { method: 'POST' }),

    getDictionaries: () => apiFetch('/api/dictionaries'),
    getLegalConfig: () => apiFetch('/api/legal-config'),
    updateLegalConfig: (payload) =>
        apiFetch('/api/legal-config', { method: 'PUT', body: JSON.stringify(payload) }),
    resetLegalConfig: () => apiFetch('/api/legal-config/reset', { method: 'POST' }),

    getAdminTags: () => apiFetch('/api/tags'),
    createTag: (payload) => apiFetch('/api/tags', { method: 'POST', body: JSON.stringify(payload) }),
    updateTag: (tagId, payload) =>
        apiFetch(`/api/tags/${tagId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteTag: (tagId) => apiFetch(`/api/tags/${tagId}`, { method: 'DELETE' }),
    restoreTag: (tagId) => apiFetch(`/api/tags/${tagId}/restore`, { method: 'PATCH' }),

    getAdminCriteria: () => apiFetch('/api/criteria'),
    createCriterion: (payload) =>
        apiFetch('/api/criteria', { method: 'POST', body: JSON.stringify(payload) }),
    updateCriterion: (critId, payload) =>
        apiFetch(`/api/criteria/${critId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteCriterion: (critId) => apiFetch(`/api/criteria/${critId}`, { method: 'DELETE' }),
    restoreCriterion: (critId) => apiFetch(`/api/criteria/${critId}/restore`, { method: 'PATCH' }),

    getUsers: () => apiFetch('/api/users'),
    getWorkspace: (userId) => apiFetch(`/api/users/${userId}/workspace`),
    createUser: (payload) => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
    changeEvaluator: (userId, przelozony_id) =>
        apiFetch(`/api/users/${userId}/evaluator`, {
            method: 'PATCH',
            body: JSON.stringify({ przelozony_id }),
        }),

    getEvaluations: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/api/evaluations${qs ? `?${qs}` : ''}`);
    },
    getEvaluation: (evalId) => apiFetch(`/api/evaluations/${evalId}`),
    saveSetup: (evalId, payload) =>
        apiFetch(`/api/evaluations/${evalId}/setup`, { method: 'PUT', body: JSON.stringify(payload) }),
    signCriteria: (evalId) => apiFetch(`/api/evaluations/${evalId}/sign-criteria`, { method: 'POST' }),
    startReview: (evalId, payload = {}) =>
        apiFetch(`/api/evaluations/${evalId}/start-review`, { method: 'POST', body: JSON.stringify(payload) }),
    finalizeEvaluation: (evalId, payload) =>
        apiFetch(`/api/evaluations/${evalId}/finalize`, { method: 'POST', body: JSON.stringify(payload) }),
    acknowledgeEvaluation: (evalId) => apiFetch(`/api/evaluations/${evalId}/acknowledge`, { method: 'POST' }),

    createTask: (evalId, payload) =>
        apiFetch(`/api/evaluations/${evalId}/tasks`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteTask: (taskId) => apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    addTagToTask: (taskId, payload) =>
        apiFetch(`/api/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify(payload) }),
    addTagsToTask: (taskId, payload) =>
        apiFetch(`/api/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteTaskTag: (taskId, taskTagId) =>
        apiFetch(`/api/tasks/${taskId}/tags/${taskTagId}`, { method: 'DELETE' }),

    createHrEvent: (evalId, payload) =>
        apiFetch(`/api/evaluations/${evalId}/hr-events`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteHrEvent: (eventId) => apiFetch(`/api/hr-events/${eventId}`, { method: 'DELETE' }),

    getAppeals: () => apiFetch('/api/appeals'),
    createAppeal: (evalId, payload) =>
        apiFetch(`/api/evaluations/${evalId}/appeals`, { method: 'POST', body: JSON.stringify(payload) }),
    decideAppeal: (appealId, payload) =>
        apiFetch(`/api/appeals/${appealId}/decide`, { method: 'PATCH', body: JSON.stringify(payload) }),

    getRankRequests: () => apiFetch('/api/rank-requests'),
    decideRankRequest: (reqId, payload) =>
        apiFetch(`/api/rank-requests/${reqId}/decide`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
