import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, showToast, toRomanRank } from '../utils.js';

export function bindAdminEvents(onRefresh) {
    const empSelect = document.getElementById('new-employment');
    const rankGroup = document.getElementById('new-rank-group');
    const form = document.getElementById('admin-add-user-form');

    function syncRankVisibility() {
        if (empSelect.value === 'MIANOWANIE') rankGroup.classList.remove('hidden');
        else rankGroup.classList.add('hidden');
    }

    empSelect.addEventListener('change', syncRankVisibility);
    syncRankVisibility();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const empType = empSelect.value;
        const stopien = empType === 'MIANOWANIE' ? Number(document.getElementById('new-rank').value) : 0;
        const evalVal = document.getElementById('new-evaluator').value;

        try {
            const res = await api.createUser({
                imie_nazwisko: document.getElementById('new-name').value.trim(),
                email: document.getElementById('new-email').value.trim() || undefined,
                nazwa_stanowiska: document.getElementById('new-position').value.trim(),
                komorka_organizacyjna:
                    document.getElementById('new-department').value.trim() || 'Wydział Analiz i Sprawozdawczości',
                arkusz: document.getElementById('new-sheet-type').value,
                rola: document.getElementById('new-role').value,
                aktualny_stopien_sluzbowy: stopien,
                przelozony_id: evalVal ? Number(evalVal) : null,
            });
            form.reset();
            syncRankVisibility();
            showToast(`Dodano użytkownika: ${res.user.imie_nazwisko} (Arkusz ${res.user.arkusz || '—'})`, 'success');
            await onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

export function renderAdminPanel(onRefresh) {
    const evalSelect = document.getElementById('new-evaluator');
    const evaluators = state.users.filter((u) => u.rola === 'OCENIAJACY' || u.rola === 'DYREKTOR');

    evalSelect.innerHTML =
        '<option value="">Brak (np. Dyrektor Generalny)</option>' +
        evaluators
            .map((u) => `<option value="${u.id}">${escapeHtml(u.imie_nazwisko)} (${u.rola})</option>`)
            .join('');

    const rows = state.users
        .map((u) => {
            const evalOptions =
                '<option value="">Brak</option>' +
                evaluators
                    .filter((cand) => cand.id !== u.id)
                    .map((cand) => {
                        const sel = u.przelozony_id === cand.id ? 'selected' : '';
                        return `<option value="${cand.id}" ${sel}>${escapeHtml(cand.imie_nazwisko)}</option>`;
                    })
                    .join('');

            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(u.imie_nazwisko)}</strong>
                        <br><span class="text-muted">${escapeHtml(u.nazwa_stanowiska)} &bull; ${escapeHtml(u.komorka_organizacyjna)}</span>
                        <br><span class="text-muted" style="font-size:11px;">${escapeHtml(u.email)}</span>
                    </td>
                    <td><span class="badge badge-primary">${escapeHtml(u.rola)}</span></td>
                    <td>Arkusz ${escapeHtml(u.arkusz || '—')}</td>
                    <td>${u.employmentType === 'MIANOWANIE' ? `Mianowany (st. ${toRomanRank(u.rank)})` : 'Umowa nieokreślona'}</td>
                    <td>
                        <select data-admin-eval-user="${u.id}" style="min-width:170px;">
                            ${evalOptions}
                        </select>
                    </td>
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
            const newEvalId = select.value ? Number(select.value) : null;
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
