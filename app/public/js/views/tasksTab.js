import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, showToast } from '../utils.js';

export function renderTasksTab(workspace, onRefresh) {
    const container = document.getElementById('profile-tab-tasks');
    if (!container || !workspace) return;

    const { activeEvaluation } = workspace;
    if (!activeEvaluation) {
        container.innerHTML = '<div class="card"><p class="text-muted">Brak aktywnego cyklu oceny.</p></div>';
        return;
    }

    const tasks = activeEvaluation.tasks || [];
    const tagOptionsHtml = ((state.dictionaries && state.dictionaries.tags) || [])
        .map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`)
        .join('');

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
                                    <span class="text-muted">${escapeHtml(t.data_zdarzenia)}</span>
                                    <button type="button" class="btn btn-xs btn-negative" data-delete-task="${t.id}">Usuń</button>
                                </div>
                            </div>
                            <p class="text-muted" style="margin-top:4px;">${escapeHtml(t.opis || '')}</p>

                            <div class="task-tags-list">${tagsHtml}</div>

                            <div class="inline-tag-form">
                                <select id="tag-select-${t.id}">${tagOptionsHtml}</select>
                                <select id="tag-polarity-${t.id}" style="flex: 0 1 155px;">
                                    <option value="+">(+) Strona dodatnia</option>
                                    <option value="-">(-) Strona ujemna</option>
                                </select>
                                <input type="text" id="tag-comment-${t.id}" placeholder="Komentarz do taga (np. z czego wynika)...">
                                <button type="button" class="btn btn-sm btn-primary" data-add-tag="${t.id}">+ Przypisz tag</button>
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
                <button type="submit" class="btn btn-primary">+ Dodaj zadanie do dziennika</button>
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

    const addTaskForm = container.querySelector('#add-task-form');
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tytul = container.querySelector('#new-task-title').value.trim();
            if (!tytul) return;
            try {
                await api.createTask(activeEvaluation.id, {
                    tytul,
                    opis: container.querySelector('#new-task-desc').value.trim(),
                    data_zdarzenia: container.querySelector('#new-task-date').value,
                    widocznosc: container.querySelector('#new-task-visibility').value,
                });
                showToast('Dodano nowe zadanie. Możesz teraz przypisać do niego tagi.', 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    container.querySelectorAll('[data-add-tag]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const taskId = Number(btn.dataset.addTag);
            const tagId = Number(container.querySelector(`#tag-select-${taskId}`).value);
            const polarity = container.querySelector(`#tag-polarity-${taskId}`).value;
            const comment = container.querySelector(`#tag-comment-${taskId}`).value.trim();
            try {
                await api.addTagToTask(taskId, {
                    tag_id: tagId,
                    polaryzacja: polarity,
                    komentarz: comment,
                });
                showToast('Przypisano tag do zadania.', 'success');
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
