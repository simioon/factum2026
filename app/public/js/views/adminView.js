import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, showToast, toRomanRank } from '../utils.js';

function ensureEmptySheetOption(sheetSelect) {
    let hasEmpty = false;
    for (let i = 0; i < sheetSelect.options.length; i++) {
        if (sheetSelect.options[i].value === '') {
            hasEmpty = true;
            break;
        }
    }
    if (!hasEmpty) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Stanowisko zarządzające (brak arkusza)';
        sheetSelect.appendChild(opt);
    }
}

function updateEvaluatorFieldState(roleSelect, evalSelect) {
    const role = roleSelect.value;
    if (role === 'DYREKTOR' || role === 'ADMIN') {
        evalSelect.value = '';
        evalSelect.disabled = true;
    } else {
        evalSelect.disabled = false;
    }
}

function isValidRoleAndSheet(role, sheet) {
    if (role === 'OCENIANY') {
        return sheet === 'C';
    }
    if (role === 'OCENIAJACY') {
        return sheet === 'A' || sheet === 'B';
    }
    if (role === 'DYREKTOR' || role === 'ADMIN') {
        return sheet === null || sheet === '';
    }
    return false;
}

export function bindAdminEvents(onRefresh) {
    const empSelect = document.getElementById('new-employment');
    const rankGroup = document.getElementById('new-rank-group');
    const sheetSelect = document.getElementById('new-sheet-type');
    const roleSelect = document.getElementById('new-role');
    const evalSelect = document.getElementById('new-evaluator');
    const form = document.getElementById('admin-add-user-form');

    ensureEmptySheetOption(sheetSelect);

    function syncRankVisibility() {
        const isAdmin = roleSelect.value === 'ADMIN';
        empSelect.disabled = isAdmin;

        if (!isAdmin && empSelect.value === 'MIANOWANIE') {
            rankGroup.classList.remove('hidden');
        } else {
            rankGroup.classList.add('hidden');
        }
    }

    function syncFromSheet() {
        const sheet = sheetSelect.value;

        if (sheet === 'C') {
            roleSelect.value = 'OCENIANY';
        } else if (sheet === 'B' || sheet === 'A') {
            roleSelect.value = 'OCENIAJACY';
        } else {
            if (roleSelect.value !== 'DYREKTOR' && roleSelect.value !== 'ADMIN') {
                roleSelect.value = 'DYREKTOR';
            }
        }

        updateEvaluatorFieldState(roleSelect, evalSelect);
        syncRankVisibility();
    }

    function syncFromRole() {
        const role = roleSelect.value;

        if (role === 'OCENIANY') {
            sheetSelect.value = 'C';
        } else if (role === 'OCENIAJACY') {
            if (sheetSelect.value !== 'A' && sheetSelect.value !== 'B') {
                sheetSelect.value = 'B';
            }
        } else if (role === 'DYREKTOR' || role === 'ADMIN') {
            sheetSelect.value = '';
        }

        updateEvaluatorFieldState(roleSelect, evalSelect);
        syncRankVisibility();
    }

    sheetSelect.addEventListener('change', syncFromSheet);
    roleSelect.addEventListener('change', syncFromRole);
    empSelect.addEventListener('change', syncRankVisibility);

    syncFromRole();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rola = roleSelect.value;
        const arkusz = sheetSelect.value ? sheetSelect.value : null;

        if (!isValidRoleAndSheet(rola, arkusz)) {
            showToast('Wybrana rola nie pasuje do typu stanowiska (arkusza).', 'error');
            return;
        }

        const empType = empSelect.value;
        const stopien =
            rola !== 'ADMIN' && empType === 'MIANOWANIE'
                ? Number(document.getElementById('new-rank').value)
                : 0;
        const evalVal = evalSelect.value;

        const hasAvailableEvaluators = state.users.some(
            (u) => u.rola === 'OCENIAJACY' || u.rola === 'DYREKTOR'
        );
        if (rola === 'OCENIANY' && !evalVal && hasAvailableEvaluators) {
            showToast('Dla pracownika (Ocenianego) musisz wybrać przełożonego.', 'error');
            return;
        }

        const przelozonyId =
            rola === 'DYREKTOR' || rola === 'ADMIN'
                ? null
                : evalVal
                  ? Number(evalVal)
                  : null;

        try {
            const res = await api.createUser({
                imie_nazwisko: document.getElementById('new-name').value.trim(),
                email: document.getElementById('new-email').value.trim() || undefined,
                nazwa_stanowiska: document.getElementById('new-position').value.trim(),
                komorka_organizacyjna:
                    document.getElementById('new-department').value.trim() || 'Wydział Analiz i Sprawozdawczości',
                arkusz,
                rola,
                aktualny_stopien_sluzbowy: stopien,
                przelozony_id: przelozonyId,
            });
            form.reset();
            syncFromRole();
            const sheetLabel = res.user.arkusz ? `Arkusz ${res.user.arkusz}` : 'brak arkusza';
            showToast(`Dodano użytkownika: ${res.user.imie_nazwisko} (${sheetLabel})`, 'success');
            await onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

export function renderAdminPanel(onRefresh) {
    const evalSelect = document.getElementById('new-evaluator');
    const roleSelect = document.getElementById('new-role');
    const evaluators = state.users.filter((u) => u.rola === 'OCENIAJACY' || u.rola === 'DYREKTOR');

    evalSelect.innerHTML =
        '<option value="">Brak </option>' +
        evaluators
            .map((u) => `<option value="${u.id}">${escapeHtml(u.imie_nazwisko)} (${u.rola})</option>`)
            .join('');

    updateEvaluatorFieldState(roleSelect, evalSelect);

    const rows = state.users
        .map((u) => {
            const isNoEvaluatorRole = u.rola === 'DYREKTOR' || u.rola === 'ADMIN';

            let sheetCellHtml = '';
            if (isNoEvaluatorRole) {
                sheetCellHtml = '<span class="text-muted">Nie dotyczy</span>';
            } else if (u.arkusz) {
                const sheetValid = isValidRoleAndSheet(u.rola, u.arkusz);
                sheetCellHtml = sheetValid
                    ? `Arkusz ${escapeHtml(u.arkusz)}`
                    : `Arkusz ${escapeHtml(u.arkusz)} <span class="text-muted" style="color:#b91c1c;font-size:11px;">(niezgodny z rolą)</span>`;
            } else {
                sheetCellHtml = '<span class="text-muted">—</span>';
            }

            let employmentCellHtml = '';
            if (u.rola === 'ADMIN') {
                employmentCellHtml = '<span class="text-muted">Konto techniczne</span>';
            } else if (u.employmentType === 'MIANOWANIE') {
                employmentCellHtml = `Mianowany (st. ${toRomanRank(u.rank)})`;
            } else {
                employmentCellHtml = 'Umowa nieokreślona';
            }

            let evaluatorCellHtml = '';
            if (isNoEvaluatorRole) {
                evaluatorCellHtml = `
                    <select disabled style="min-width:170px;">
                        <option value="" selected>Nie dotyczy</option>
                    </select>
                `;
            } else {
                const allowEmptyOption = u.rola !== 'OCENIANY' || !u.przelozony_id;
                const emptyOptionHtml = allowEmptyOption
                    ? `<option value="" ${!u.przelozony_id ? 'selected' : ''}>${u.rola === 'OCENIANY' ? '— Wybierz oceniającego —' : 'Brak'}</option>`
                    : '';

                const evalOptions =
                    emptyOptionHtml +
                    evaluators
                        .filter((cand) => cand.id !== u.id)
                        .map((cand) => {
                            const sel = u.przelozony_id === cand.id ? 'selected' : '';
                            return `<option value="${cand.id}" ${sel}>${escapeHtml(cand.imie_nazwisko)}</option>`;
                        })
                        .join('');

                evaluatorCellHtml = `
                    <select data-admin-eval-user="${u.id}" style="min-width:170px;">
                        ${evalOptions}
                    </select>
                `;
            }

            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(u.imie_nazwisko)}</strong>
                        <br><span class="text-muted">${escapeHtml(u.nazwa_stanowiska)} &bull; ${escapeHtml(u.komorka_organizacyjna)}</span>
                        <br><span class="text-muted" style="font-size:11px;">${escapeHtml(u.email)}</span>
                    </td>
                    <td><span class="badge badge-primary">${escapeHtml(u.rola)}</span></td>
                    <td>${sheetCellHtml}</td>
                    <td>${employmentCellHtml}</td>
                    <td>${evaluatorCellHtml}</td>
                </tr>
            `;
        })
        .join('');

    const tableWrap = document.getElementById('admin-users-table');
    tableWrap.innerHTML = `
        <table>
            <thead>
                <tr><th>Użytkownik i stanowisko</th><th>Rola</th><th>Arkusz</th><th>Zatrudnienie</th><th>Przypisany oceniający</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    tableWrap.querySelectorAll('[data-admin-eval-user]').forEach((select) => {
        select.addEventListener('change', async () => {
            const userId = Number(select.dataset.adminEvalUser);
            const targetUser = state.users.find((item) => item.id === userId);
            const newEvalId = select.value ? Number(select.value) : null;

            if (targetUser && targetUser.rola === 'OCENIANY' && newEvalId === null) {
                showToast('Pracownik (Oceniany) musi mieć przypisanego oceniającego.', 'error');
                await onRefresh();
                return;
            }

            try {
                const res = await api.changeEvaluator(userId, newEvalId);
                showToast(`Zmieniono oceniającego dla: ${res.user.imie_nazwisko}`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
                await onRefresh();
            }
        });
    });
}