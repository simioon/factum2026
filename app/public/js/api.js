import { mockApi, resetMockDb } from './mockApi.js';
import { state } from './state.js';

let useMockMode = false;

export function isMockMode() {
    return useMockMode;
}

export function resetMockDemoData() {
    resetMockDb();
}

export async function detectApiMode() {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mock') === '1') {
            useMockMode = true;
            return true;
        }
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 2000) : null;

    try {
        const res = await fetch('./api/health', {
            signal: controller ? controller.signal : undefined,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.status === 'ok') {
                useMockMode = false;
                return false;
            }
        }
        useMockMode = true;
        return true;
    } catch {
        useMockMode = true;
        return true;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

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
    getDictionaries: () => (useMockMode ? mockApi.getDictionaries() : apiFetch('/api/dictionaries')),
    getAdminTags: () => (useMockMode ? mockApi.getAdminTags(state.currentUserId) : apiFetch('/api/tags')),
    createTag: (payload) =>
        useMockMode
            ? mockApi.createTag(payload, state.currentUserId)
            : apiFetch('/api/tags', { method: 'POST', body: JSON.stringify(payload) }),
    updateTag: (tagId, payload) =>
        useMockMode
            ? mockApi.updateTag(tagId, payload, state.currentUserId)
            : apiFetch(`/api/tags/${tagId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteTag: (tagId) =>
        useMockMode
            ? mockApi.deleteTag(tagId, state.currentUserId)
            : apiFetch(`/api/tags/${tagId}`, { method: 'DELETE' }),
    restoreTag: (tagId) =>
        useMockMode
            ? mockApi.restoreTag(tagId, state.currentUserId)
            : apiFetch(`/api/tags/${tagId}/restore`, { method: 'PATCH' }),
    getAdminCriteria: () =>
        useMockMode ? mockApi.getAdminCriteria(state.currentUserId) : apiFetch('/api/criteria'),
    createCriterion: (payload) =>
        useMockMode
            ? mockApi.createCriterion(payload, state.currentUserId)
            : apiFetch('/api/criteria', { method: 'POST', body: JSON.stringify(payload) }),
    updateCriterion: (critId, payload) =>
        useMockMode
            ? mockApi.updateCriterion(critId, payload, state.currentUserId)
            : apiFetch(`/api/criteria/${critId}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteCriterion: (critId) =>
        useMockMode
            ? mockApi.deleteCriterion(critId, state.currentUserId)
            : apiFetch(`/api/criteria/${critId}`, { method: 'DELETE' }),
    restoreCriterion: (critId) =>
        useMockMode
            ? mockApi.restoreCriterion(critId, state.currentUserId)
            : apiFetch(`/api/criteria/${critId}/restore`, { method: 'PATCH' }),
    getUsers: () => (useMockMode ? mockApi.getUsers() : apiFetch('/api/users')),
    getWorkspace: (userId) =>
        useMockMode ? mockApi.getWorkspace(userId, state.currentUserId) : apiFetch(`/api/users/${userId}/workspace`),
    createUser: (payload) =>
        useMockMode
            ? mockApi.createUser(payload, state.currentUserId)
            : apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
    changeEvaluator: (userId, przelozony_id) =>
        useMockMode
            ? mockApi.changeEvaluator(userId, przelozony_id, state.currentUserId)
            : apiFetch(`/api/users/${userId}/evaluator`, {
                  method: 'PATCH',
                  body: JSON.stringify({ przelozony_id }),
              }),
    getEvaluations: (params = {}) => {
        if (useMockMode) return mockApi.getEvaluations(params, state.currentUserId);
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/api/evaluations${qs ? `?${qs}` : ''}`);
    },
    getEvaluation: (evalId) =>
        useMockMode ? mockApi.getEvaluation(evalId, state.currentUserId) : apiFetch(`/api/evaluations/${evalId}`),
    saveSetup: (evalId, payload) =>
        useMockMode
            ? mockApi.saveSetup(evalId, payload, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/setup`, { method: 'PUT', body: JSON.stringify(payload) }),
    signCriteria: (evalId) =>
        useMockMode
            ? mockApi.signCriteria(evalId, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/sign-criteria`, { method: 'POST' }),
    startReview: (evalId, payload = {}) =>
        useMockMode
            ? mockApi.startReview(evalId, payload, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/start-review`, { method: 'POST', body: JSON.stringify(payload) }),
    finalizeEvaluation: (evalId, payload) =>
        useMockMode
            ? mockApi.finalizeEvaluation(evalId, payload, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/finalize`, { method: 'POST', body: JSON.stringify(payload) }),
    acknowledgeEvaluation: (evalId) =>
        useMockMode
            ? mockApi.acknowledgeEvaluation(evalId, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/acknowledge`, { method: 'POST' }),
    createTask: (evalId, payload) =>
        useMockMode
            ? mockApi.createTask(evalId, payload, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/tasks`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteTask: (taskId) =>
        useMockMode ? mockApi.deleteTask(taskId, state.currentUserId) : apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    addTagToTask: (taskId, payload) =>
        useMockMode
            ? mockApi.addTagToTask(taskId, payload, state.currentUserId)
            : apiFetch(`/api/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify(payload) }),
    addTagsToTask: (taskId, payload) =>
        useMockMode
            ? mockApi.addTagToTask(taskId, payload, state.currentUserId)
            : apiFetch(`/api/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteTaskTag: (taskId, taskTagId) =>
        useMockMode
            ? mockApi.deleteTaskTag(taskId, taskTagId, state.currentUserId)
            : apiFetch(`/api/tasks/${taskId}/tags/${taskTagId}`, { method: 'DELETE' }),
    createHrEvent: (evalId, payload) =>
        useMockMode
            ? mockApi.createHrEvent(evalId, payload, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/hr-events`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteHrEvent: (eventId) =>
        useMockMode
            ? mockApi.deleteHrEvent(eventId, state.currentUserId)
            : apiFetch(`/api/hr-events/${eventId}`, { method: 'DELETE' }),
    getAppeals: () => (useMockMode ? mockApi.getAppeals(state.currentUserId) : apiFetch('/api/appeals')),
    createAppeal: (evalId, payload) =>
        useMockMode
            ? mockApi.createAppeal(evalId, payload, state.currentUserId)
            : apiFetch(`/api/evaluations/${evalId}/appeals`, { method: 'POST', body: JSON.stringify(payload) }),
    decideAppeal: (appealId, payload) =>
        useMockMode
            ? mockApi.decideAppeal(appealId, payload, state.currentUserId)
            : apiFetch(`/api/appeals/${appealId}/decide`, { method: 'PATCH', body: JSON.stringify(payload) }),
    getRankRequests: () => (useMockMode ? mockApi.getRankRequests(state.currentUserId) : apiFetch('/api/rank-requests')),
    decideRankRequest: (reqId, payload) =>
        useMockMode
            ? mockApi.decideRankRequest(reqId, payload, state.currentUserId)
            : apiFetch(`/api/rank-requests/${reqId}/decide`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
