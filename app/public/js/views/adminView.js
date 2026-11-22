import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, showToast, toRomanRank } from '../utils.js';

let refreshHandler = null;

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

function renderSheetBadgesHtml(sheets) {
    const s = sheets || {};
    return ['A', 'B', 'C']
        .map((code) => {
            const role = s[code];
            if (role === 'OBOWIAZKOWE') {
                return `<span class="badge badge-primary">${code}: Obow.</span>`;
            }
            if (role === 'DODATKOWE') {
                return `<span class="badge badge-warning">${code}: Dod.</span>`;
            }
            return `<span class="badge badge-archived">${code}: —</span>`;
        })
        .join(' ');
}

function syncTagCategoryUI() {
    const catSelect = document.getElementById('tag-category');
    const critSection = document.getElementById('tag-criteria-section');
    const wellInfo = document.getElementById('tag-wellbeing-info');
    if (!catSelect || !critSection || !wellInfo) return;

    const isWellbeing = catSelect.value === 'DOBROSTAN';
    critSection.classList.toggle('hidden', isWellbeing);
    wellInfo.classList.toggle('hidden', !isWellbeing);
    updateTagCriteriaCounter();
}

function updateTagCriteriaCounter() {
    const counterEl = document.getElementById('tag-criteria-counter');
    const checklist = document.getElementById('tag-criteria-checklist');
    if (!counterEl || !checklist) return;
    const count = checklist.querySelectorAll('input[name="admin-tag-crit"]:checked').length;
    counterEl.textContent = `Wybrano: ${count}`;
}

function renderTagCriteriaChecklist(selectedIds = []) {
    const checklist = document.getElementById('tag-criteria-checklist');
    const archivedNote = document.getElementById('tag-criteria-archived-note');
    if (!checklist) return;

    const selectedSet = new Set((selectedIds || []).map(Number));
    const allCriteria = state.adminCriteria || [];
    const activeCriteria = allCriteria.filter((c) => c.czy_aktywne);
    const archivedLinked = allCriteria.filter((c) => !c.czy_aktywne && selectedSet.has(c.id));

    if (archivedNote) {
        if (archivedLinked.length > 0) {
            const names = archivedLinked.map((c) => `„${c.nazwa}”`).join(', ');
            archivedNote.textContent = `Uwaga: ten tag był wcześniej powiązany z wycofanymi kryteriami (${names}). Po zapisaniu edycji aktywne zostaną wyłącznie zaznaczone poniżej kryteria.`;
            archivedNote.classList.remove('hidden');
        } else {
            archivedNote.classList.add('hidden');
            archivedNote.textContent = '';
        }
    }

    if (activeCriteria.length === 0) {
        checklist.innerHTML = '<p class="text-muted">Brak aktywnych kryteriów oceny.</p>';
        updateTagCriteriaCounter();
        return;
    }

    checklist.innerHTML = activeCriteria
        .map((c) => {
            const isChecked = selectedSet.has(c.id);
            return `
                <label class="criteria-check-card ${isChecked ? 'checked' : ''}">
                    <input type="checkbox" name="admin-tag-crit" value="${c.id}" ${isChecked ? 'checked' : ''}>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:13px;">${escapeHtml(c.nazwa)}</div>
                        <div class="criteria-check-meta">${renderSheetBadgesHtml(c.sheets)}</div>
                    </div>
                </label>
            `;
        })
        .join('');

    checklist.querySelectorAll('input[name="admin-tag-crit"]').forEach((cb) => {
        cb.addEventListener('change', () => {
            const card = cb.closest('.criteria-check-card');
            if (card) card.classList.toggle('checked', cb.checked);
            updateTagCriteriaCounter();
        });
    });

    updateTagCriteriaCounter();
}

function resetTagForm() {
    state.editingTagId = null;
    const form = document.getElementById('admin-tag-form');
    const card = document.getElementById('admin-tag-editor-card');
    const title = document.getElementById('admin-tag-form-title');
    const badge = document.getElementById('admin-tag-form-badge');
    const warning = document.getElementById('admin-tag-edit-warning');
    const submitBtn = document.getElementById('btn-admin-tag-submit');
    const cancelBtn = document.getElementById('btn-admin-tag-cancel');

    if (form) form.reset();
    if (card) card.classList.remove('admin-edit-highlight');
    if (title) title.textContent = 'Dodaj nowy tag do słownika';
    if (badge) {
        badge.textContent = 'Nowy tag';
        badge.className = 'badge badge-primary';
    }
    if (warning) {
        warning.classList.add('hidden');
        warning.textContent = '';
    }
    if (submitBtn) submitBtn.textContent = '+ Dodaj tag';
    if (cancelBtn) cancelBtn.classList.add('hidden');

    renderTagCriteriaChecklist([]);
    syncTagCategoryUI();
}

function loadTagIntoForm(tag) {
    if (!tag) return;
    state.editingTagId = tag.id;
    const card = document.getElementById('admin-tag-editor-card');
    const title = document.getElementById('admin-tag-form-title');
    const badge = document.getElementById('admin-tag-form-badge');
    const warning = document.getElementById('admin-tag-edit-warning');
    const submitBtn = document.getElementById('btn-admin-tag-submit');
    const cancelBtn = document.getElementById('btn-admin-tag-cancel');

    const nameInput = document.getElementById('tag-name');
    const catSelect = document.getElementById('tag-category');
    const descInput = document.getElementById('tag-desc');

    if (nameInput) nameInput.value = tag.nazwa || '';
    if (catSelect) catSelect.value = tag.kategoria || 'KOMPETENCYJNY';
    if (descInput) descInput.value = tag.opis || '';

    if (card) card.classList.add('admin-edit-highlight');
    if (title) title.textContent = `Edytuj tag: ${tag.nazwa}`;
    if (badge) {
        badge.textContent = tag.czy_aktywny ? `Edycja #${tag.id}` : `Edycja archiwalnego #${tag.id}`;
        badge.className = 'badge badge-warning';
    }
    if (warning) {
        if (tag.usageCount > 0) {
            warning.innerHTML = `<strong>Uwaga (użycia w dzienniku: ${tag.usageCount}):</strong> Zmiana nazwy, kategorii lub powiązanych kryteriów zaktualizuje wyświetlanie tego tagu oraz podpowiedzi w aktywnych ocenach. Zakończone oceny zachowają swoje zapisane wyniki.`;
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
            warning.textContent = '';
        }
    }
    if (submitBtn) submitBtn.textContent = 'Zapisz zmiany tagu';
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    renderTagCriteriaChecklist(tag.criteriaIds || []);
    syncTagCategoryUI();

    if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function resetCriterionForm() {
    state.editingCriterionId = null;
    const form = document.getElementById('admin-crit-form');
    const card = document.getElementById('admin-crit-editor-card');
    const title = document.getElementById('admin-crit-form-title');
    const badge = document.getElementById('admin-crit-form-badge');
    const warning = document.getElementById('admin-crit-edit-warning');
    const submitBtn = document.getElementById('btn-admin-crit-submit');
    const cancelBtn = document.getElementById('btn-admin-crit-cancel');

    if (form) form.reset();
    const sA = document.getElementById('crit-sheet-A');
    const sB = document.getElementById('crit-sheet-B');
    const sC = document.getElementById('crit-sheet-C');
    if (sA) sA.value = 'DODATKOWE';
    if (sB) sB.value = 'DODATKOWE';
    if (sC) sC.value = 'DODATKOWE';

    if (card) card.classList.remove('admin-edit-highlight');
    if (title) title.textContent = 'Dodaj nowe kryterium oceny';
    if (badge) {
        badge.textContent = 'Nowe kryterium';
        badge.className = 'badge badge-primary';
    }
    if (warning) {
        warning.classList.add('hidden');
        warning.textContent = '';
    }
    if (submitBtn) submitBtn.textContent = '+ Dodaj kryterium';
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

function loadCriterionIntoForm(crit) {
    if (!crit) return;
    state.editingCriterionId = crit.id;
    const card = document.getElementById('admin-crit-editor-card');
    const title = document.getElementById('admin-crit-form-title');
    const badge = document.getElementById('admin-crit-form-badge');
    const warning = document.getElementById('admin-crit-edit-warning');
    const submitBtn = document.getElementById('btn-admin-crit-submit');
    const cancelBtn = document.getElementById('btn-admin-crit-cancel');

    const nameInput = document.getElementById('crit-name');
    const descInput = document.getElementById('crit-desc');
    const sA = document.getElementById('crit-sheet-A');
    const sB = document.getElementById('crit-sheet-B');
    const sC = document.getElementById('crit-sheet-C');

    if (nameInput) nameInput.value = crit.nazwa || '';
    if (descInput) descInput.value = crit.opis || '';
    if (sA) sA.value = (crit.sheets && crit.sheets.A) || 'BRAK';
    if (sB) sB.value = (crit.sheets && crit.sheets.B) || 'BRAK';
    if (sC) sC.value = (crit.sheets && crit.sheets.C) || 'BRAK';

    if (card) card.classList.add('admin-edit-highlight');
    if (title) title.textContent = `Edytuj kryterium: ${crit.nazwa}`;
    if (badge) {
        badge.textContent = crit.czy_aktywne ? `Edycja #${crit.id}` : `Edycja archiwalnego #${crit.id}`;
        badge.className = 'badge badge-warning';
    }
    if (warning) {
        if (crit.usageCount > 0 || crit.tagCount > 0) {
            warning.innerHTML = `<strong>Uwaga:</strong> To kryterium występuje w <strong>${crit.usageCount}</strong> arkuszach ocen oraz ma przypisanych <strong>${crit.tagCount}</strong> aktywnych tagów. Zmiany w arkuszach (A/B/C) dotyczą nowych cykli i otwartych konfiguracji kryteriów; zakończone oceny zachowują swoje wyniki.`;
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
            warning.textContent = '';
        }
    }
    if (submitBtn) submitBtn.textContent = 'Zapisz zmiany kryterium';
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function bindAdminEvents(onRefresh) {
    refreshHandler = onRefresh;

    // 1. User creation form
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

    // 2. Tag Management form & controls
    const tagForm = document.getElementById('admin-tag-form');
    const tagCatSelect = document.getElementById('tag-category');
    const tagCancelBtn = document.getElementById('btn-admin-tag-cancel');
    const tagSearchInput = document.getElementById('admin-tag-search');

    if (tagCatSelect) {
        tagCatSelect.addEventListener('change', syncTagCategoryUI);
    }
    if (tagCancelBtn) {
        tagCancelBtn.addEventListener('click', () => {
            resetTagForm();
        });
    }
    if (tagForm) {
        tagForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nazwa = document.getElementById('tag-name').value.trim();
            const kategoria = document.getElementById('tag-category').value;
            const opis = document.getElementById('tag-desc').value.trim();
            const criteriaIds =
                kategoria === 'DOBROSTAN'
                    ? []
                    : Array.from(
                          document.querySelectorAll('#tag-criteria-checklist input[name="admin-tag-crit"]:checked')
                      ).map((cb) => Number(cb.value));

            if (!nazwa) {
                showToast('Wpisz nazwę tagu.', 'error');
                return;
            }
            if (kategoria === 'KOMPETENCYJNY' && criteriaIds.length === 0) {
                showToast('Tag kompetencyjny musi być przypisany do co najmniej jednego kryterium oceny.', 'error');
                return;
            }

            try {
                if (state.editingTagId) {
                    const res = await api.updateTag(state.editingTagId, {
                        nazwa,
                        kategoria,
                        opis,
                        criteriaIds,
                    });
                    showToast(`Zaktualizowano tag „${res.tag.nazwa}”.`, 'success');
                } else {
                    const res = await api.createTag({
                        nazwa,
                        kategoria,
                        opis,
                        criteriaIds,
                    });
                    showToast(`Dodano nowy tag „${res.tag.nazwa}” do słownika.`, 'success');
                }
                resetTagForm();
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    document.querySelectorAll('[data-admin-tag-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.adminTagFilter = btn.dataset.adminTagFilter;
            document.querySelectorAll('[data-admin-tag-filter]').forEach((b) => {
                b.classList.toggle('active', b.dataset.adminTagFilter === state.adminTagFilter);
            });
            renderAdminTagsTable(refreshHandler);
        });
    });

    if (tagSearchInput) {
        tagSearchInput.addEventListener('input', () => {
            state.adminTagSearch = tagSearchInput.value.trim().toLowerCase();
            renderAdminTagsTable(refreshHandler);
        });
    }

    // 3. Criteria Management form & controls
    const critForm = document.getElementById('admin-crit-form');
    const critCancelBtn = document.getElementById('btn-admin-crit-cancel');
    const critSearchInput = document.getElementById('admin-crit-search');

    if (critCancelBtn) {
        critCancelBtn.addEventListener('click', () => {
            resetCriterionForm();
        });
    }
    if (critForm) {
        critForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nazwa = document.getElementById('crit-name').value.trim();
            const opis = document.getElementById('crit-desc').value.trim();
            const sheets = {
                A: document.getElementById('crit-sheet-A').value === 'BRAK' ? null : document.getElementById('crit-sheet-A').value,
                B: document.getElementById('crit-sheet-B').value === 'BRAK' ? null : document.getElementById('crit-sheet-B').value,
                C: document.getElementById('crit-sheet-C').value === 'BRAK' ? null : document.getElementById('crit-sheet-C').value,
            };

            if (!nazwa || !opis) {
                showToast('Wpisz nazwę oraz opis kryterium oceny.', 'error');
                return;
            }
            if (!sheets.A && !sheets.B && !sheets.C) {
                showToast('Przypisz kryterium do co najmniej jednego arkusza (A, B lub C).', 'error');
                return;
            }

            try {
                if (state.editingCriterionId) {
                    const res = await api.updateCriterion(state.editingCriterionId, {
                        nazwa,
                        opis,
                        sheets,
                    });
                    showToast(`Zaktualizowano kryterium „${res.criterion.nazwa}”.`, 'success');
                } else {
                    const res = await api.createCriterion({
                        nazwa,
                        opis,
                        sheets,
                    });
                    showToast(`Dodano nowe kryterium „${res.criterion.nazwa}”.`, 'success');
                }
                resetCriterionForm();
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    document.querySelectorAll('[data-admin-crit-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.adminCriteriaFilter = btn.dataset.adminCritFilter;
            document.querySelectorAll('[data-admin-crit-filter]').forEach((b) => {
                b.classList.toggle('active', b.dataset.adminCritFilter === state.adminCriteriaFilter);
            });
            renderAdminCriteriaTable(refreshHandler);
        });
    });

    if (critSearchInput) {
        critSearchInput.addEventListener('input', () => {
            state.adminCriteriaSearch = critSearchInput.value.trim().toLowerCase();
            renderAdminCriteriaTable(refreshHandler);
        });
    }

    // 4. Legal Config form & reset
    const legalForm = document.getElementById('admin-legal-form');
    const legalResetBtn = document.getElementById('btn-admin-legal-reset');

    if (legalForm) {
        legalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                cycleMonths: Number(document.getElementById('legal-cycle-months').value),
                cycleMonthsAfterNegative: Number(document.getElementById('legal-cycle-months-neg').value),
                initialInterviewDaysNormal: Number(document.getElementById('legal-interview-normal').value),
                initialInterviewDaysAfterNegative: Number(document.getElementById('legal-interview-neg').value),
                maxAdditionalCriteria: Number(document.getElementById('legal-max-additional').value),
                absenceShiftThresholdDays: Number(document.getElementById('legal-absence-threshold').value),
                appealDaysLimit: Number(document.getElementById('legal-appeal-days').value),
                appealReviewDaysLimit: Number(document.getElementById('legal-appeal-review-days').value),
            };
            try {
                await api.updateLegalConfig(payload);
                showToast('Zapisano zaktualizowane parametry prawne.', 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    if (legalResetBtn) {
        legalResetBtn.addEventListener('click', async () => {
            try {
                await api.resetLegalConfig();
                showToast('Przywrócono domyślne parametry ustawowe (Ustawa o służbie cywilnej).', 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }
}

function renderAdminUsersView(onRefresh) {
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

function renderAdminTagsTable(onRefresh) {
    const tableWrap = document.getElementById('admin-tags-table');
    if (!tableWrap) return;

    const critById = new Map((state.adminCriteria || []).map((c) => [c.id, c]));
    const filter = state.adminTagFilter || 'all';
    const q = state.adminTagSearch || '';

    const filtered = (state.adminTags || []).filter((t) => {
        if (filter === 'active' && !t.czy_aktywny) return false;
        if (filter === 'archived' && t.czy_aktywny) return false;
        if (q) {
            const critNames = (t.criteriaIds || [])
                .map((cid) => (critById.get(cid) ? critById.get(cid).nazwa : ''))
                .join(' ')
                .toLowerCase();
            const hay = `${t.nazwa} ${t.opis || ''} ${t.kategoria} ${critNames}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tableWrap.innerHTML = '<p class="text-muted">Brak tagów spełniających wybrane kryteria filtrowania.</p>';
        return;
    }

    const rows = filtered
        .map((t) => {
            const catBadge =
                t.kategoria === 'DOBROSTAN'
                    ? '<span class="badge badge-wellbeing">Dobrostan (HR)</span>'
                    : '<span class="badge badge-primary">Kompetencyjny</span>';

            const criteriaHtml =
                t.kategoria === 'DOBROSTAN'
                    ? '<span class="text-muted">Alerty HR Partnera</span>'
                    : (t.criteriaIds || []).length === 0
                      ? '<span class="text-muted">Brak powiązań</span>'
                      : `<div style="display:flex; flex-wrap:wrap; gap:4px;">${t.criteriaIds
                            .map((cid) => {
                                const c = critById.get(cid);
                                if (!c) return `<span class="badge">#${cid}</span>`;
                                const arch = !c.czy_aktywne ? ' (archiwalne)' : '';
                                const cls = c.czy_aktywne ? 'badge' : 'badge badge-archived';
                                return `<span class="${cls}">${escapeHtml(c.nazwa)}${arch}</span>`;
                            })
                            .join('')}</div>`;

            const statusBadge = t.czy_aktywny
                ? '<span class="badge badge-positive">Aktywny</span>'
                : '<span class="badge badge-archived">Wycofany (archiwum)</span>';

            const toggleBtn = t.czy_aktywny
                ? `<button type="button" class="btn btn-xs btn-negative" data-archive-tag="${t.id}">Wycofaj (Usuń)</button>`
                : `<button type="button" class="btn btn-xs btn-positive" data-restore-tag="${t.id}">Przywróć</button>`;

            return `
                <tr style="${t.czy_aktywny ? '' : 'opacity:0.78;'}">
                    <td>
                        <strong>${escapeHtml(t.nazwa)}</strong>
                        ${t.opis ? `<br><span class="text-muted">${escapeHtml(t.opis)}</span>` : ''}
                    </td>
                    <td>${catBadge}</td>
                    <td>${criteriaHtml}</td>
                    <td><strong>${t.usageCount}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            <button type="button" class="btn btn-xs" data-edit-tag="${t.id}">Edytuj</button>
                            ${toggleBtn}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');

    tableWrap.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Tag i opis</th>
                    <th>Kategoria</th>
                    <th>Powiązane kryteria oceny</th>
                    <th>Użycia</th>
                    <th>Status</th>
                    <th>Akcje</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    tableWrap.querySelectorAll('[data-edit-tag]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.editTag);
            const tag = (state.adminTags || []).find((t) => t.id === id);
            if (tag) loadTagIntoForm(tag);
        });
    });

    tableWrap.querySelectorAll('[data-archive-tag]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.archiveTag);
            try {
                const res = await api.deleteTag(id);
                if (state.editingTagId === id) resetTagForm();
                const preservedMsg =
                    res.tag.usageCount > 0
                        ? ` Wszystkie ${res.tag.usageCount} wcześniejszych przypisań pozostało zachowanych.`
                        : '';
                showToast(`Wycofano tag „${res.tag.nazwa}” ze słownika.${preservedMsg}`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    tableWrap.querySelectorAll('[data-restore-tag]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.restoreTag);
            try {
                const res = await api.restoreTag(id);
                showToast(`Przywrócono tag „${res.tag.nazwa}” do aktywnego słownika.`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

function renderAdminCriteriaTable(onRefresh) {
    const tableWrap = document.getElementById('admin-criteria-table');
    if (!tableWrap) return;

    const filter = state.adminCriteriaFilter || 'all';
    const q = state.adminCriteriaSearch || '';

    const filtered = (state.adminCriteria || []).filter((c) => {
        if (filter === 'active' && !c.czy_aktywne) return false;
        if (filter === 'archived' && c.czy_aktywne) return false;
        if (q) {
            const hay = `${c.nazwa} ${c.opis || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tableWrap.innerHTML = '<p class="text-muted">Brak kryteriów spełniających wybrane kryteria filtrowania.</p>';
        return;
    }

    const rows = filtered
        .map((c) => {
            const previewDesc =
                c.descriptions && c.descriptions.length > 0
                    ? c.descriptions[0] + (c.descriptions.length > 1 ? ` (+${c.descriptions.length - 1} pkt)` : '')
                    : c.opis || '';

            const statusBadge = c.czy_aktywne
                ? '<span class="badge badge-positive">Aktywne</span>'
                : '<span class="badge badge-archived">Wycofane (archiwum)</span>';

            const toggleBtn = c.czy_aktywne
                ? `<button type="button" class="btn btn-xs btn-negative" data-archive-crit="${c.id}">Wycofaj (Usuń)</button>`
                : `<button type="button" class="btn btn-xs btn-positive" data-restore-crit="${c.id}">Przywróć</button>`;

            return `
                <tr style="${c.czy_aktywne ? '' : 'opacity:0.78;'}">
                    <td>
                        <strong>${escapeHtml(c.nazwa)}</strong>
                        <br><span class="text-muted" style="font-size:12px;">${escapeHtml(previewDesc)}</span>
                    </td>
                    <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${renderSheetBadgesHtml(c.sheets)}</div></td>
                    <td><strong>${c.tagCount}</strong></td>
                    <td><strong>${c.usageCount}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            <button type="button" class="btn btn-xs" data-edit-crit="${c.id}">Edytuj</button>
                            ${toggleBtn}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');

    tableWrap.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Kryterium i opis</th>
                    <th>Arkusze (A / B / C)</th>
                    <th>Tagi</th>
                    <th>Użycia</th>
                    <th>Status</th>
                    <th>Akcje</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    tableWrap.querySelectorAll('[data-edit-crit]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.editCrit);
            const crit = (state.adminCriteria || []).find((c) => c.id === id);
            if (crit) loadCriterionIntoForm(crit);
        });
    });

    tableWrap.querySelectorAll('[data-archive-crit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.archiveCrit);
            try {
                const res = await api.deleteCriterion(id);
                if (state.editingCriterionId === id) resetCriterionForm();
                const preservedMsg =
                    res.criterion.usageCount > 0
                        ? ` Wszystkie ${res.criterion.usageCount} wcześniejszych wpisów w ocenach zostało zachowanych.`
                        : '';
                showToast(`Wycofano kryterium „${res.criterion.nazwa}”.${preservedMsg}`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    tableWrap.querySelectorAll('[data-restore-crit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.dataset.restoreCrit);
            try {
                const res = await api.restoreCriterion(id);
                showToast(`Przywrócono kryterium „${res.criterion.nazwa}”.`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

function renderAdminLegalView() {
    const cfg = (state.dictionaries && state.dictionaries.legalConfig) || {};
    const fields = [
        ['legal-cycle-months', cfg.cycleMonths ?? 24],
        ['legal-cycle-months-neg', cfg.cycleMonthsAfterNegative ?? 6],
        ['legal-interview-normal', cfg.initialInterviewDaysNormal ?? 30],
        ['legal-interview-neg', cfg.initialInterviewDaysAfterNegative ?? 7],
        ['legal-max-additional', cfg.maxAdditionalCriteria ?? 3],
        ['legal-absence-threshold', cfg.absenceShiftThresholdDays ?? 30],
        ['legal-appeal-days', cfg.appealDaysLimit ?? 7],
        ['legal-appeal-review-days', cfg.appealReviewDaysLimit ?? 14],
    ];
    for (const [id, val] of fields) {
        const el = document.getElementById(id);
        if (el) el.value = String(val);
    }
}

export function renderAdminPanel(onRefresh) {
    refreshHandler = onRefresh;

    const tabBtns = document.querySelectorAll('#admin-main-tabs [data-admin-tab]');
    tabBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.adminTab === state.adminActiveTab);
    });

    const subUsers = document.getElementById('admin-subview-users');
    const subTags = document.getElementById('admin-subview-tags');
    const subCrit = document.getElementById('admin-subview-criteria');
    const subLegal = document.getElementById('admin-subview-legal');

    if (subUsers) subUsers.classList.toggle('hidden', state.adminActiveTab !== 'users');
    if (subTags) subTags.classList.toggle('hidden', state.adminActiveTab !== 'tags');
    if (subCrit) subCrit.classList.toggle('hidden', state.adminActiveTab !== 'criteria');
    if (subLegal) subLegal.classList.toggle('hidden', state.adminActiveTab !== 'legal');

    if (state.adminActiveTab === 'users') {
        renderAdminUsersView(onRefresh);
    } else if (state.adminActiveTab === 'tags') {
        if (state.editingTagId) {
            const existing = (state.adminTags || []).find((t) => t.id === state.editingTagId);
            if (existing) loadTagIntoForm(existing);
            else resetTagForm();
        } else {
            const currentlyChecked = Array.from(
                document.querySelectorAll('#tag-criteria-checklist input[name="admin-tag-crit"]:checked')
            ).map((cb) => Number(cb.value));
            renderTagCriteriaChecklist(currentlyChecked);
            syncTagCategoryUI();
        }
        renderAdminTagsTable(onRefresh);
    } else if (state.adminActiveTab === 'criteria') {
        if (state.editingCriterionId) {
            const existing = (state.adminCriteria || []).find((c) => c.id === state.editingCriterionId);
            if (existing) loadCriterionIntoForm(existing);
            else resetCriterionForm();
        }
        renderAdminCriteriaTable(onRefresh);
    } else if (state.adminActiveTab === 'legal') {
        renderAdminLegalView();
    }
}
