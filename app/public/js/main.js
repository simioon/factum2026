import { api } from './api.js';
import { resetWizardState, setCurrentUserId, state } from './state.js';
import { getUserById, showToast } from './utils.js';
import { initIntegrationsModal, resetIntegrationLogs } from './integrations.js';
import { renderLoginScreen, renderTopbarSwitcher } from './views/loginView.js';
import { renderEmployeePanel } from './views/employeeView.js';
import { renderManagerPanel } from './views/managerView.js';
import { renderDirectorPanel } from './views/directorView.js';
import { bindAdminEvents, renderAdminPanel } from './views/adminView.js';

async function loadUsersAndDictionaries() {
    const [dictRes, usersRes] = await Promise.all([api.getDictionaries(), api.getUsers()]);
    state.dictionaries = dictRes;
    state.users = usersRes.users;
}

async function refreshUsersListOnly() {
    const usersRes = await api.getUsers();
    state.users = usersRes.users;
}

async function openEmployeeProfile(empId, tab = 'setup') {
    state.selectedEmployeeId = empId;
    state.profileActiveTab = tab;
    resetWizardState();
    await loadAndRender();
}

async function closeEmployeeProfile() {
    state.selectedEmployeeId = null;
    state.workspace = null;
    await loadAndRender();
}

async function switchUserById(userId) {
    if (!userId) {
        await logout();
        return;
    }
    setCurrentUserId(userId);
    state.selectedEmployeeId = null;
    state.managerActiveTab = 'team';
    state.directorActiveTab = 'requests';
    state.adminActiveTab = 'users';
    state.editingTagId = null;
    state.editingCriterionId = null;
    state.workspace = null;
    state.selfWorkspace = null;
    resetWizardState();

    state.dictionaries = await api.getDictionaries();
    await loadAndRender();
    const u = getUserById(userId);
    if (u) showToast(`Przełączono na konto: ${u.imie_nazwisko} (${u.rola})`, 'success');
}

async function logout() {
    setCurrentUserId(null);
    state.selectedEmployeeId = null;
    state.workspace = null;
    state.selfWorkspace = null;
    await loadAndRender();
}

async function loadAndRender() {
    await refreshUsersListOnly();
    renderTopbarSwitcher();

    document.getElementById('section-login').classList.add('hidden');
    document.getElementById('section-employee').classList.add('hidden');
    document.getElementById('section-manager').classList.add('hidden');
    document.getElementById('section-director').classList.add('hidden');
    document.getElementById('section-admin').classList.add('hidden');

    if (!state.currentUserId) {
        document.getElementById('section-login').classList.remove('hidden');
        renderLoginScreen(switchUserById);
        return;
    }

    const user = getUserById(state.currentUserId);
    if (!user) {
        setCurrentUserId(null);
        document.getElementById('section-login').classList.remove('hidden');
        renderLoginScreen(switchUserById);
        return;
    }

    try {
        if (user.rola === 'OCENIANY') {
            state.workspace = await api.getWorkspace(user.id);
            document.getElementById('section-employee').classList.remove('hidden');
            renderEmployeePanel(state.workspace, 'employee-view-content', loadAndRender);
            return;
        }

        if (user.rola === 'OCENIAJACY' || (user.rola === 'DYREKTOR' && state.selectedEmployeeId)) {
            if (state.selectedEmployeeId) {
                state.workspace = await api.getWorkspace(state.selectedEmployeeId);
            } else if (state.managerActiveTab === 'history') {
                const res = await api.getEvaluations({ oceniajacyId: user.id, completedOnly: 'true' });
                state.managerHistory = res.evaluations;
            } else if (state.managerActiveTab === 'self') {
                state.selfWorkspace = await api.getWorkspace(user.id);
            } else {
                const appRes = await api.getAppeals();
                state.appeals = appRes.appeals;
            }

            document.getElementById('section-manager').classList.remove('hidden');
            renderManagerPanel(user, {
                onOpenProfile: openEmployeeProfile,
                onRefreshProfile: loadAndRender,
                onRefreshSelf: loadAndRender,
                onWizardFinalized: async () => {
                    state.selectedEmployeeId = null;
                    state.workspace = null;
                    state.managerActiveTab = 'history';
                    await loadAndRender();
                },
            });
            return;
        }

        if (user.rola === 'DYREKTOR') {
            const [appRes, rrRes] = await Promise.all([api.getAppeals(), api.getRankRequests()]);
            state.appeals = appRes.appeals;
            state.rankRequests = rrRes.rankRequests;
            document.getElementById('section-director').classList.remove('hidden');
            renderDirectorPanel(user, {
                onOpenProfile: openEmployeeProfile,
                onRefresh: loadAndRender,
            });
            return;
        }

        if (user.rola === 'ADMIN') {
            const [dictRes, tagsRes, critRes, legalRes] = await Promise.all([
                api.getDictionaries(),
                api.getAdminTags(),
                api.getAdminCriteria(),
                api.getLegalConfig(),
            ]);
            state.dictionaries = dictRes;
            state.adminTags = tagsRes.tags;
            state.adminCriteria = critRes.criteria;
            state.adminLegalDefaults = legalRes.defaults;
            document.getElementById('section-admin').classList.remove('hidden');
            renderAdminPanel(loadAndRender);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function bindStaticNavigation() {
    document.getElementById('quick-role-select').addEventListener('change', (e) => {
        switchUserById(e.target.value ? Number(e.target.value) : null);
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        logout();
    });

    document.getElementById('btn-close-profile').addEventListener('click', () => {
        closeEmployeeProfile();
    });

    document.querySelectorAll('[data-manager-tab]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            state.managerActiveTab = btn.dataset.managerTab;
            state.selectedEmployeeId = null;
            await loadAndRender();
        });
    });

    document.querySelectorAll('[data-profile-tab]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            state.profileActiveTab = btn.dataset.profileTab;
            await loadAndRender();
        });
    });

    document.querySelectorAll('[data-director-tab]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            state.directorActiveTab = btn.dataset.directorTab;
            await loadAndRender();
        });
    });

    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            state.adminActiveTab = btn.dataset.adminTab;
            await loadAndRender();
        });
    });

    bindAdminEvents(loadAndRender);
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const health = await api.getHealth();
        if (health && health.demoMode) {
            const btnReset = document.getElementById('btn-reset-demo');
            if (btnReset) {
                btnReset.classList.remove('hidden');
                btnReset.addEventListener('click', async () => {
                    btnReset.disabled = true;
                    try {
                        await api.resetDemoData();
                        resetIntegrationLogs();
                        setCurrentUserId(null);
                        state.selectedEmployeeId = null;
                        state.editingTagId = null;
                        state.editingCriterionId = null;
                        state.workspace = null;
                        state.selfWorkspace = null;
                        resetWizardState();
                        await loadUsersAndDictionaries();
                        await loadAndRender();
                        showToast('Przywrócono początkowe dane demonstracyjne w bazie PostgreSQL.', 'success');
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        btnReset.disabled = false;
                    }
                });
            }
        }
        bindStaticNavigation();
        initIntegrationsModal();
        await loadUsersAndDictionaries();
        await loadAndRender();
    } catch (err) {
        showToast(`Błąd inicjalizacji aplikacji: ${err.message}`, 'error');
    }
});
