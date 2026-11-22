import { state } from '../state.js';
import { escapeHtml, renderAlertsHtml, toRomanRank } from '../utils.js';
import { renderEmployeePanel } from './employeeView.js';
import { renderSetupTab } from './setupTab.js';
import { renderTasksTab } from './tasksTab.js';
import { renderWizardTab } from './wizardTab.js';
import { printEvaluationSheet } from './printSheet.js';

export function renderSubordinatesList(managerId, containerId, { onOpenProfile }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const subs = state.users.filter((u) => u.przelozony_id === managerId);

    const appealAlerts = (state.appeals || [])
        .filter((ap) => ap.oceniajacy_id === managerId && ap.decyzja_dyrektora === 'OCZEKUJE')
        .map(
            (ap) => `
            <div class="alert-box alert-negative">
                <strong>Odwołanie od oceny:</strong> Pracownik ${escapeHtml(ap.pracownik_nazwa)} złożył sprzeciw (Status: ${escapeHtml(ap.decyzja_label || ap.decyzja_dyrektora)}).
            </div>
        `
        )
        .join('');

    const cardsHtml =
        subs.length === 0
            ? '<p class="text-muted">Brak przypisanych pracowników.</p>'
            : subs
                .map((emp) => {
                    const alertsHtml = renderAlertsHtml(emp.alerts || []);
                    const statusBadge = emp.activeStatus
                        ? `<span class="badge">${escapeHtml((state.dictionaries && state.dictionaries.statusLabels[emp.activeStatus]) || emp.activeStatus)}</span>`
                        : '';

                    return `
                        <div class="card">
                            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px;">
                                <div>
                                    <h3 style="margin-bottom:2px;">${escapeHtml(emp.imie_nazwisko)}</h3>
                                    <span class="text-muted">${escapeHtml(emp.nazwa_stanowiska)}</span>
                                    <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px;">
                                        <span class="badge badge-primary">Arkusz ${escapeHtml(emp.arkusz || '—')}</span>
                                        <span class="badge badge-positive">Tagi (+): ${emp.posTagCount}</span>
                                        <span class="badge badge-negative">Tagi (-): ${emp.negTagCount}</span>
                                        ${emp.wellbeingTagCount > 0 ? `<span class="badge badge-wellbeing">Sygnały dobrostanu: ${emp.wellbeingTagCount}</span>` : ''}
                                        ${emp.employmentType === 'MIANOWANIE' ? `<span class="badge">Mianowany (st. ${toRomanRank(emp.rank)})</span>` : ''}
                                        ${statusBadge}
                                    </div>
                                </div>
                                <div>
                                    <button type="button" class="btn btn-primary" data-open-employee="${emp.id}">Otwórz profil i ocenę &rarr;</button>
                                </div>
                            </div>
                            ${alertsHtml}
                        </div>
                    `;
                })
                .join('');

    container.innerHTML = appealAlerts + cardsHtml;

    container.querySelectorAll('[data-open-employee]').forEach((btn) => {
        btn.addEventListener('click', () => {
            onOpenProfile(Number(btn.dataset.openEmployee));
        });
    });
}

export function renderManagerHistory() {
    const container = document.getElementById('manager-subview-history');
    if (!container) return;

    const list = state.managerHistory || [];
    let bodyHtml = '';
    if (list.length === 0) {
        bodyHtml = '<p class="text-muted">Nie wystawiłeś jeszcze żadnych ocen.</p>';
    } else {
        const rows = list
            .map((ev) => {
                const appealText =
                    ev.appeals && ev.appeals.length > 0
                        ? (state.dictionaries && state.dictionaries.appealDecisionLabels[ev.appeals[0].decyzja_dyrektora]) ||
                        ev.appeals[0].decyzja_dyrektora
                        : '<span class="text-muted">Brak</span>';
                return `
                    <tr>
                        <td><strong>${escapeHtml(ev.pracownik_nazwa)}</strong></td>
                        <td>${escapeHtml(ev.data_rozmowy_oceniajacej || ev.data_zapoznania_z_ocena || '—')}</td>
                        <td>Arkusz ${escapeHtml(ev.typ_arkusza)} (p.${ev.numer_podejscia})</td>
                        <td>${ev.srednia_punktow ?? '—'} (${escapeHtml(ev.poziom_oceny_label || '')})</td>
                        <td><span class="badge ${ev.wynik_ogolny === 'POZYTYWNA' ? 'badge-positive' : 'badge-negative'}">${escapeHtml(ev.wynik_ogolny)}</span></td>
                        <td><span class="badge">${escapeHtml(ev.status_label)}</span></td>
                        <td>${appealText}</td>
                        <td><button type="button" class="btn btn-sm" data-print-mgr-eval="${ev.id}">Drukuj / PDF</button></td>
                    </tr>
                `;
            })
            .join('');

        bodyHtml = `
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Pracownik</th><th>Data</th><th>Arkusz</th><th>Średnia</th><th>Wynik</th><th>Status</th><th>Odwołanie</th><th>Akcja</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = `<div class="card"><div class="card-header"><h2>Wystawione oceny okresowe</h2></div>${bodyHtml}</div>`;

    container.querySelectorAll('[data-print-mgr-eval]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const ev = list.find((item) => item.id === Number(btn.dataset.printMgrEval));
            if (ev) printEvaluationSheet({ evaluation: ev });
        });
    });
}

export function renderEmployeeProfileForManager(callbacks) {
    const workspace = state.workspace;
    if (!workspace) return;
    const emp = workspace.user;

    const rankBadge =
        emp.employmentType === 'MIANOWANIE'
            ? `<span class="badge badge-primary">Urzędnik mianowany — stopień ${toRomanRank(emp.rank)}</span>`
            : '<span class="badge">Pracownik SC</span>';

    document.getElementById('profile-header-card').innerHTML = `
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px;">
            <div>
                <h2>${escapeHtml(emp.imie_nazwisko)}</h2>
                <p class="text-muted">${escapeHtml(emp.nazwa_stanowiska)} &bull; ${escapeHtml(emp.komorka_organizacyjna)}</p>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                <span class="badge badge-primary">Arkusz ${escapeHtml(emp.arkusz || '—')}</span>
                ${rankBadge}
                ${workspace.activeEvaluation ? `<span class="badge">${escapeHtml(workspace.activeEvaluation.status_label)}</span>` : ''}
            </div>
        </div>
    `;

    const tabs = document.getElementById('profile-tabs').querySelectorAll('.tab-btn');
    tabs[0].classList.toggle('active', state.profileActiveTab === 'setup');
    tabs[1].classList.toggle('active', state.profileActiveTab === 'tasks');
    tabs[2].classList.toggle('active', state.profileActiveTab === 'wizard');

    document.getElementById('profile-tab-setup').classList.add('hidden');
    document.getElementById('profile-tab-tasks').classList.add('hidden');
    document.getElementById('profile-tab-wizard').classList.add('hidden');

    if (state.profileActiveTab === 'setup') {
        document.getElementById('profile-tab-setup').classList.remove('hidden');
        renderSetupTab(workspace, callbacks.onRefreshProfile);
    } else if (state.profileActiveTab === 'tasks') {
        document.getElementById('profile-tab-tasks').classList.remove('hidden');
        renderTasksTab(workspace, callbacks.onRefreshProfile);
    } else if (state.profileActiveTab === 'wizard') {
        document.getElementById('profile-tab-wizard').classList.remove('hidden');
        renderWizardTab(workspace, callbacks.onWizardFinalized);
    }
}

export function renderManagerPanel(managerUser, callbacks) {
    const subTeam = document.getElementById('manager-subview-team');
    const subHistory = document.getElementById('manager-subview-history');
    const subSelf = document.getElementById('manager-subview-self');
    const subProfile = document.getElementById('manager-subview-profile');
    const mainTabs = document.getElementById('manager-main-tabs');

    subTeam.classList.add('hidden');
    subHistory.classList.add('hidden');
    subSelf.classList.add('hidden');
    subProfile.classList.add('hidden');

    if (state.selectedEmployeeId) {
        mainTabs.classList.add('hidden');
        subProfile.classList.remove('hidden');
        renderEmployeeProfileForManager(callbacks);
        return;
    }

    mainTabs.classList.remove('hidden');
    const btns = mainTabs.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', state.managerActiveTab === 'team');
    btns[1].classList.toggle('active', state.managerActiveTab === 'history');
    btns[2].classList.toggle('active', state.managerActiveTab === 'self');

    if (state.managerActiveTab === 'team') {
        subTeam.classList.remove('hidden');
        renderSubordinatesList(managerUser.id, 'manager-subview-team', callbacks);
    } else if (state.managerActiveTab === 'history') {
        subHistory.classList.remove('hidden');
        renderManagerHistory();
    } else if (state.managerActiveTab === 'self') {
        subSelf.classList.remove('hidden');
        renderEmployeePanel(state.selfWorkspace, 'manager-subview-self', callbacks.onRefreshSelf);
    }
}
