import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, formatDate, showToast } from '../utils.js';

function renderBatchTagPicker(pickerId, tagsCatalog, { title, notePlaceholder }) {
    const competenceTags = tagsCatalog.filter((t) => !t.isWellbeing);
    const wellbeingTags = tagsCatalog.filter((t) => t.isWellbeing);

    const compChipsHtml = competenceTags
        .map(
            (t) => `
        <div class="tag-chip" data-chip-tag-id="${t.id}" title="${escapeHtml(t.opis || t.nazwa)}">
            <button type="button" class="tag-chip-label" data-chip-cycle="${t.id}">
                ${escapeHtml(t.nazwa)}
            </button>
            <div class="tag-chip-actions">
                <button type="button" class="tag-chip-pol-btn pol-pos" data-chip-set="${t.id}" data-pol="+" aria-label="Dodaj pozytywny ${escapeHtml(t.nazwa)}">+</button>
                <button type="button" class="tag-chip-pol-btn pol-neg" data-chip-set="${t.id}" data-pol="-" aria-label="Dodaj negatywny ${escapeHtml(t.nazwa)}">−</button>
            </div>
        </div>
    `
        )
        .join('');

    const wellChipsHtml = wellbeingTags
        .map(
            (t) => `
        <div class="tag-chip tag-chip-wellbeing" data-chip-tag-id="${t.id}" data-wellbeing="1" title="${escapeHtml(t.opis || t.nazwa)}">
            <button type="button" class="tag-chip-label" data-chip-well="${t.id}">
                [HR] ${escapeHtml(t.nazwa)}
            </button>
        </div>
    `
        )
        .join('');

    return `
        <div class="batch-tag-picker" data-picker-id="${escapeHtml(pickerId)}">
            <div class="batch-picker-header">
                <span class="batch-picker-title">${escapeHtml(title)}</span>
                <span class="text-muted" style="font-size:12px;">Kliknij <strong>+</strong> lub <strong>−</strong> przy wybranych tagach (możesz łączyć różne strony w jednym zestawie)</span>
            </div>

            <div class="tag-chip-group-label">Tagi kompetencyjne:</div>
            <div class="tag-chip-grid">${compChipsHtml}</div>

            <div class="tag-chip-group-label" style="margin-top:8px;">Sygnały dobrostanu (Wirtualny HR Partner — nie obniżają oceny):</div>
            <div class="tag-chip-grid">${wellChipsHtml}</div>

            <div class="batch-selection-summary hidden" data-picker-summary="${escapeHtml(pickerId)}">
                <div class="batch-selection-pills" data-picker-pills="${escapeHtml(pickerId)}"></div>
                <button type="button" class="btn btn-xs" data-picker-clear="${escapeHtml(pickerId)}">Wyczyść wybór</button>
            </div>

            <div class="form-group" style="margin-top:10px; margin-bottom:0;">
                <label for="picker-note-${escapeHtml(pickerId)}">Wspólna notatka wyjaśniająca dla zaznaczonych tagów</label>
                <input type="text" id="picker-note-${escapeHtml(pickerId)}" placeholder="${escapeHtml(notePlaceholder)}">
            </div>
        </div>
    `;
}

function wireBatchTagPicker(container, pickerId, tagsCatalog, { onChange } = {}) {
    const pickerEl = container.querySelector(`[data-picker-id="${pickerId}"]`);
    if (!pickerEl) return null;

    const tagById = new Map(tagsCatalog.map((t) => [t.id, t]));
    // Map<tagId, '+' | '-'>
    const selected = new Map();

    const summaryEl = pickerEl.querySelector(`[data-picker-summary="${pickerId}"]`);
    const pillsEl = pickerEl.querySelector(`[data-picker-pills="${pickerId}"]`);
    const clearBtn = pickerEl.querySelector(`[data-picker-clear="${pickerId}"]`);
    const noteInput = pickerEl.querySelector(`#picker-note-${pickerId}`);

    function syncVisuals() {
        pickerEl.querySelectorAll('[data-chip-tag-id]').forEach((chip) => {
            const tid = Number(chip.dataset.chipTagId);
            const pol = selected.get(tid);
            const isWell = chip.dataset.wellbeing === '1';

            chip.classList.toggle('selected-pos', !isWell && pol === '+');
            chip.classList.toggle('selected-neg', !isWell && pol === '-');
            chip.classList.toggle('selected-wellbeing', isWell && Boolean(pol));

            const posBtn = chip.querySelector('.pol-pos');
            const negBtn = chip.querySelector('.pol-neg');
            if (posBtn) posBtn.classList.toggle('active', pol === '+');
            if (negBtn) negBtn.classList.toggle('active', pol === '-');
        });

        if (selected.size === 0) {
            summaryEl.classList.add('hidden');
            pillsEl.innerHTML = '';
        } else {
            summaryEl.classList.remove('hidden');
            const badges = Array.from(selected.entries())
                .map(([tid, pol]) => {
                    const def = tagById.get(tid);
                    if (!def) return '';
                    const cls = def.isWellbeing
                        ? 'badge-wellbeing'
                        : pol === '+'
                          ? 'badge-positive'
                          : 'badge-negative';
                    const prefix = def.isWellbeing ? '[HR] ' : `(${pol}) `;
                    return `<span class="badge ${cls}">${prefix}${escapeHtml(def.nazwa)}</span>`;
                })
                .join(' ');
            pillsEl.innerHTML = `<strong style="font-size:12px;">Wybrane (${selected.size}):</strong> ${badges}`;
        }

        if (typeof onChange === 'function') {
            onChange(selected.size);
        }
    }

    pickerEl.querySelectorAll('[data-chip-set]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tid = Number(btn.dataset.chipSet);
            const pol = btn.dataset.pol;
            if (selected.get(tid) === pol) selected.delete(tid);
            else selected.set(tid, pol);
            syncVisuals();
        });
    });

    pickerEl.querySelectorAll('[data-chip-cycle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tid = Number(btn.dataset.chipCycle);
            const cur = selected.get(tid);
            if (!cur) selected.set(tid, '+');
            else if (cur === '+') selected.set(tid, '-');
            else selected.delete(tid);
            syncVisuals();
        });
    });

    pickerEl.querySelectorAll('[data-chip-well]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tid = Number(btn.dataset.chipWell);
            if (selected.has(tid)) selected.delete(tid);
            else selected.set(tid, '-');
            syncVisuals();
        });
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            selected.clear();
            syncVisuals();
        });
    }

    syncVisuals();

    return {
        getSelection: () =>
            Array.from(selected.entries()).map(([tag_id, polaryzacja]) => ({
                tag_id,
                polaryzacja,
            })),
        getNote: () => (noteInput ? noteInput.value.trim() : ''),
        clear: () => {
            selected.clear();
            if (noteInput) noteInput.value = '';
            syncVisuals();
        },
    };
}

export function renderTasksTab(workspace, onRefresh) {
    const container = document.getElementById('profile-tab-tasks');
    if (!container || !workspace) return;

    const { activeEvaluation } = workspace;
    if (!activeEvaluation) {
        container.innerHTML = '<div class="card"><p class="text-muted">Brak aktywnego cyklu oceny.</p></div>';
        return;
    }

    const tasks = activeEvaluation.tasks || [];
    const tagsCatalog = (state.dictionaries && state.dictionaries.tags) || [];

    const tasksListHtml =
        tasks.length === 0
            ? '<p class="text-muted">Brak dodanych zadań. Dodaj pierwsze zadanie powyżej, aby przypisywać tagi.</p>'
            : tasks
                  .map((t) => {
                      const tagsHtml =
                          !t.tags || t.tags.length === 0
                              ? '<p class="text-muted" style="font-size:12px;">Brak przypisanych tagów do tego zadania.</p>'
                              : t.tags
                                    .map((tg) => {
                                        const isWell = tg.kategoria === 'DOBROSTAN';
                                        const isPos = tg.polaryzacja === '+';
                                        const rowClass = isWell ? 'wellbeing' : isPos ? 'pos' : 'neg';
                                        const colorVar = isWell
                                            ? 'var(--wellbeing)'
                                            : isPos
                                              ? 'var(--positive)'
                                              : 'var(--negative)';
                                        const prefix = isWell ? '[HR] ' : isPos ? '(+) ' : '(-) ';

                                        return `
                                            <div class="tag-row ${rowClass}">
                                                <div class="tag-row-content">
                                                    <strong style="color:${colorVar};">${prefix}${escapeHtml(tg.tag_nazwa)}</strong>
                                                    <span>${escapeHtml(tg.komentarz || 'Brak dodatkowego komentarza')}</span>
                                                </div>
                                                <button type="button" class="btn btn-xs" data-delete-task-tag="${tg.id}" data-task-id="${t.id}">Usuń tag</button>
                                            </div>
                                        `;
                                    })
                                    .join('');

                      const visBadge =
                          t.widocznosc === 'TYLKO_MENEDZER'
                              ? '<span class="badge badge-private">Tylko menedżer (prywatna notatka)</span>'
                              : '<span class="badge badge-primary">Widoczne dla obu stron</span>';

                      return `
                        <div class="task-item">
                            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; align-items:center;">
                                <div>
                                    <strong>${escapeHtml(t.tytul)}</strong>
                                    ${visBadge}
                                </div>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <span class="text-muted">${escapeHtml(formatDate(t.data_zdarzenia))}</span>
                                    <button type="button" class="btn btn-xs btn-negative" data-delete-task="${t.id}">Usuń</button>
                                </div>
                            </div>
                            <p class="text-muted" style="margin-top:4px;">${escapeHtml(t.opis || '')}</p>

                            <div class="task-tags-list">${tagsHtml}</div>

                            <div class="task-batch-toggle-row">
                                <button type="button" class="btn btn-sm" data-toggle-batch-picker="${t.id}">
                                    + Przypisz tagi (wiele naraz)
                                </button>
                            </div>

                            <div id="batch-picker-panel-${t.id}" class="batch-picker-panel hidden">
                                ${renderBatchTagPicker(`task-${t.id}`, tagsCatalog, {
                                    title: 'Wybierz tagi do przypisania dla tego wpisu:',
                                    notePlaceholder: 'Wyjaśnij kontekst dla zaznaczonych tagów (np. co poszło wzorowo lub wymaga poprawy)...',
                                })}
                                <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                                    <button type="button" class="btn btn-sm btn-primary" data-submit-batch-tags="${t.id}" disabled>
                                        + Przypisz zaznaczone tagi (0)
                                    </button>
                                    <button type="button" class="btn btn-sm" data-cancel-batch-picker="${t.id}">Zamknij</button>
                                </div>
                            </div>
                        </div>
                    `;
                  })
                  .join('');

    container.innerHTML = `
        <div class="card">
            <h3>Dodaj nowe wykonane zadanie / obserwację</h3>
            <form id="add-task-form">
                <div class="grid-3">
                    <div class="form-group">
                        <label for="new-task-title">Tytuł zadania</label>
                        <input type="text" id="new-task-title" placeholder="np. Przygotowanie odpowiedzi na skargę" required>
                    </div>
                    <div class="form-group">
                        <label for="new-task-date">Data wykonania</label>
                        <input type="date" id="new-task-date" value="${new Date().toISOString().slice(0, 10)}" required>
                    </div>
                    <div class="form-group">
                        <label for="new-task-visibility">Widoczność obserwacji</label>
                        <select id="new-task-visibility">
                            <option value="OBIE_STRONY">Widoczne dla obu stron</option>
                            <option value="TYLKO_MENEDZER">Tylko dla menedżera (prywatne notatki)</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="new-task-desc">Krótki opis</label>
                    <input type="text" id="new-task-desc" placeholder="Krótki kontekst wykonanego zadania...">
                </div>

                <div style="margin-bottom:14px;">
                    ${renderBatchTagPicker('new-task', tagsCatalog, {
                        title: 'Przypisz tagi od razu (opcjonalnie):',
                        notePlaceholder: 'Wspólna notatka wyjaśniająca dla wybranych tagów...',
                    })}
                </div>

                <button type="submit" class="btn btn-primary" id="btn-create-task-submit">+ Dodaj zadanie do dziennika</button>
            </form>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>Dziennik zadań i przypisanych tagów (${tasks.length})</h3>
                <span class="text-muted">Tagi automatycznie zasilają kryteria oraz klocki dowodowe w kreatorze oceny</span>
            </div>
            ${tasksListHtml}
        </div>
    `;

    // Wire creation form batch picker
    const createSubmitBtn = container.querySelector('#btn-create-task-submit');
    const newTaskPicker = wireBatchTagPicker(container, 'new-task', tagsCatalog, {
        onChange: (count) => {
            if (createSubmitBtn) {
                createSubmitBtn.textContent =
                    count > 0
                        ? `+ Dodaj zadanie wraz z tagami (${count})`
                        : '+ Dodaj zadanie do dziennika';
            }
        },
    });

    const addTaskForm = container.querySelector('#add-task-form');
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tytul = container.querySelector('#new-task-title').value.trim();
            if (!tytul) return;
            const selectedTags = newTaskPicker ? newTaskPicker.getSelection() : [];
            const batchNote = newTaskPicker ? newTaskPicker.getNote() : '';

            try {
                await api.createTask(activeEvaluation.id, {
                    tytul,
                    opis: container.querySelector('#new-task-desc').value.trim(),
                    data_zdarzenia: container.querySelector('#new-task-date').value,
                    widocznosc: container.querySelector('#new-task-visibility').value,
                    tags: selectedTags,
                    komentarz: batchNote,
                });
                showToast(
                    selectedTags.length > 0
                        ? `Dodano zadanie wraz z ${selectedTags.length} tagami.`
                        : 'Dodano nowe zadanie. Możesz teraz przypisać do niego tagi.',
                    'success'
                );
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // Wire per-task collapsible batch pickers
    const taskPickers = new Map();
    for (const t of tasks) {
        const submitBtn = container.querySelector(`[data-submit-batch-tags="${t.id}"]`);
        const picker = wireBatchTagPicker(container, `task-${t.id}`, tagsCatalog, {
            onChange: (count) => {
                if (submitBtn) {
                    submitBtn.disabled = count === 0;
                    submitBtn.textContent = `+ Przypisz zaznaczone tagi (${count})`;
                }
            },
        });
        if (picker) taskPickers.set(t.id, picker);
    }

    container.querySelectorAll('[data-toggle-batch-picker]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const taskId = Number(btn.dataset.toggleBatchPicker);
            const panel = container.querySelector(`#batch-picker-panel-${taskId}`);
            if (panel) panel.classList.toggle('hidden');
        });
    });

    container.querySelectorAll('[data-cancel-batch-picker]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const taskId = Number(btn.dataset.cancelBatchPicker);
            const panel = container.querySelector(`#batch-picker-panel-${taskId}`);
            if (panel) panel.classList.add('hidden');
        });
    });

    container.querySelectorAll('[data-submit-batch-tags]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const taskId = Number(btn.dataset.submitBatchTags);
            const picker = taskPickers.get(taskId);
            if (!picker) return;
            const selectedTags = picker.getSelection();
            if (selectedTags.length === 0) {
                showToast('Zaznacz przynajmniej jeden tag przed zapisaniem.', 'error');
                return;
            }
            const komentarz = picker.getNote();
            try {
                await api.addTagsToTask(taskId, {
                    tags: selectedTags,
                    komentarz,
                });
                showToast(`Przypisano ${selectedTags.length} tagów do zadania.`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    container.querySelectorAll('[data-delete-task]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                await api.deleteTask(Number(btn.dataset.deleteTask));
                showToast('Usunięto zadanie z dziennika.', 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    container.querySelectorAll('[data-delete-task-tag]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                await api.deleteTaskTag(Number(btn.dataset.taskId), Number(btn.dataset.deleteTaskTag));
                showToast('Usunięto przypisany tag.', 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}
