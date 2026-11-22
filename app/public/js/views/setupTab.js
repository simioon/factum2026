import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, formatDate, formatDateTime, showToast } from '../utils.js';

export function renderSetupTab(workspace, onRefresh) {
    const container = document.getElementById('profile-tab-setup');
    if (!container || !workspace) return;

    const { activeEvaluation, pastEvaluations } = workspace;
    if (!activeEvaluation) {
        container.innerHTML = '<div class="card"><p class="text-muted">Brak aktywnego cyklu oceny dla tego pracownika.</p></div>';
        return;
    }

    const lastCompleted = pastEvaluations.find((e) => e.status === 'ZAKONCZONA') || null;
    const isAfterNeg = lastCompleted && lastCompleted.wynik_ogolny === 'NEGATYWNA';
    const limitDays = isAfterNeg ? 7 : 30;
    const maxAdditional = (state.dictionaries && state.dictionaries.legalConfig.maxAdditionalCriteria) || 3;

    const sheetConfig =
        (state.dictionaries && state.dictionaries.sheetCriteria[activeEvaluation.typ_arkusza]) ||
        { mandatoryIds: [], additionalIds: [] };

    const activeCritIds = new Set(activeEvaluation.criteria.map((c) => c.kryterium_id));
    const mandatoryIds = sheetConfig.mandatoryIds;

    const mandatoryHtml = mandatoryIds
        .map((id) => {
            const c = state.dictionaries.criteria.find((x) => x.id === id);
            return `<li style="margin-bottom:4px;"><strong>${escapeHtml(c ? c.nazwa : `#${id}`)}</strong></li>`;
        })
        .join('');

    const additionalCheckboxesHtml = state.dictionaries.criteria
        .filter((c) => !mandatoryIds.includes(c.id))
        .map((c) => {
            const checked = activeCritIds.has(c.id) ? 'checked' : '';
            return `
                <label style="display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--border-color); border-radius:6px; cursor:pointer; background:#fff;">
                    <input type="checkbox" name="additional-crit" value="${c.id}" ${checked}>
                    <span>${escapeHtml(c.nazwa)}</span>
                </label>
            `;
        })
        .join('');

    const mgrSigned = activeEvaluation.podpis_kryteria_oceniajacy_at;
    const empSigned = activeEvaluation.podpis_kryteria_oceniany_at;
    let signStatusHtml = '';
    if (mgrSigned && empSigned) {
        signStatusHtml = `<div class="alert-box alert-positive">
            <strong>Dwustronny e-podpis Części I złożony:</strong> Oceniający (${escapeHtml(formatDateTime(mgrSigned))}) &bull; Oceniany (${escapeHtml(formatDateTime(empSigned))})
        </div>`;
    } else if (mgrSigned) {
        signStatusHtml = `<div class="alert-box alert-info">
            <strong>e-Podpis Oceniającego złożony (${escapeHtml(formatDateTime(mgrSigned))}).</strong> Oczekuje na potwierdzenie przez ocenianego pracownika.
        </div>`;
    } else {
        signStatusHtml = `<div class="alert-box alert-warning">
            Rozmowa wstępna i wybrane kryteria nie zostały jeszcze potwierdzone podpisem elektronicznym.
        </div>`;
    }

    const eventLabels = (state.dictionaries && state.dictionaries.eventTypeLabels) || {};
    const hrEventsHtml =
        activeEvaluation.hrEvents && activeEvaluation.hrEvents.length > 0
            ? activeEvaluation.hrEvents
                  .map(
                      (ev) => `
                <div class="hr-event-row">
                    <div>
                        <strong>${escapeHtml(eventLabels[ev.typ_zdarzenia] || ev.typ_zdarzenia)}</strong>
                        <span class="badge badge-warning" style="margin-left:6px;">+${ev.dni_przesuniecia_terminu} dni</span>
                        <div class="text-muted" style="font-size:12px; margin-top:2px;">
                            Okres: ${escapeHtml(formatDate(ev.data_od))}${ev.data_do ? ` – ${escapeHtml(formatDate(ev.data_do))}` : ''}
                            ${ev.opis ? ` &bull; ${escapeHtml(ev.opis)}` : ''}
                        </div>
                    </div>
                    <button type="button" class="btn btn-xs btn-negative" data-delete-hr-event="${ev.id}">Usuń i cofnij przesunięcie</button>
                </div>
            `
                  )
                  .join('')
            : '<p class="text-muted">Brak zarejestrowanych zdarzeń kadrowych w tym cyklu.</p>';

    const readOnlySetup = activeEvaluation.status === 'SPORZADZONA_DO_PODPISU';

    container.innerHTML = `
        <div class="card">
            <h3>Rozmowa wstępna i wyznaczenie kryteriów (Część I arkusza)</h3>
            <div class="alert-box ${isAfterNeg ? 'alert-negative' : 'alert-info'}">
                <strong>Limit ustawowy na wyznaczenie kryteriów:</strong> ${limitDays} dni od startu cyklu (${escapeHtml(formatDate(activeEvaluation.data_rozpoczecia_cyklu))})
                &rarr; termin upływa: <strong>${escapeHtml(formatDate(activeEvaluation.termin_wyznaczenia_kryteriow))}</strong>.
                ${isAfterNeg ? ' (Skrócony termin 7 dni z powodu poprzedniej oceny negatywnej!)' : ''}
                <br><strong>Planowana data oceny końcowej:</strong> ${escapeHtml(formatDate(activeEvaluation.planowana_data_oceny))}
            </div>
            ${signStatusHtml}

            <div class="grid-2">
                <div class="form-group">
                    <label for="setup-interview-date">Data rozmowy wstępnej</label>
                    <input type="date" id="setup-interview-date" value="${escapeHtml(activeEvaluation.data_rozmowy_wstepnej || '')}" ${readOnlySetup ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label for="setup-interview-notes">Notatki z rozmowy wstępnej (cele, oczekiwania)</label>
                    <textarea id="setup-interview-notes" placeholder="Zapisz ustalone cele i oczekiwania..." ${readOnlySetup ? 'disabled' : ''}>${escapeHtml(activeEvaluation.oczekiwania_i_cele || '')}</textarea>
                </div>
            </div>

            <div class="form-group">
                <label>Kryteria obowiązkowe (dobrane automatycznie dla Arkusza ${escapeHtml(activeEvaluation.typ_arkusza)}):</label>
                <ul style="margin-left:20px; margin-top:6px;">${mandatoryHtml}</ul>
            </div>

            <div class="form-group">
                <label>Wybierz kryteria dodatkowe (maksymalnie ${maxAdditional}):</label>
                <div class="grid-2" style="margin-top:8px;">${additionalCheckboxesHtml}</div>
            </div>

            ${
                readOnlySetup
                    ? '<p class="text-muted">Ocena została już sporządzona i oczekuje na podpis pracownika.</p>'
                    : `
                <div style="display:flex; flex-wrap:wrap; gap:10px;">
                    <button type="button" class="btn btn-primary" id="btn-setup-save-draft">Zapisz roboczo</button>
                    <button type="button" class="btn btn-positive" id="btn-setup-save-sign">Zapisz i dodaj e-podpis (Część I)</button>
                </div>
            `
            }
        </div>

        <div class="card">
            <div class="card-header">
                <h3>Zdarzenia kadrowe (przesunięcie terminu oceny)</h3>
                <span class="badge badge-primary">Planowana ocena: ${escapeHtml(formatDate(activeEvaluation.planowana_data_oceny))}</span>
            </div>
            <form id="hr-event-form" style="margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--border-color);">
                <div class="grid-3">
                    <div class="form-group">
                        <label for="hr-event-type">Typ zdarzenia</label>
                        <select id="hr-event-type">
                            <option value="NIEOBECNOSC_POWYZEJ_MIESIACA">Nieobecność powyżej miesiąca</option>
                            <option value="ZMIANA_STANOWISKA">Zmiana stanowiska</option>
                            <option value="INNE">Inne zdarzenie kadrowe</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="hr-event-from">Data od</label>
                        <input type="date" id="hr-event-from" required value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                    <div class="form-group">
                        <label for="hr-event-to">Data do (opcjonalnie)</label>
                        <input type="date" id="hr-event-to">
                    </div>
                    <div class="form-group">
                        <label for="hr-event-days">Dni przesunięcia terminu</label>
                        <input type="number" id="hr-event-days" min="0" placeholder="Auto przy nieobecności >30 dni">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label for="hr-event-desc">Opis zdarzenia</label>
                        <input type="text" id="hr-event-desc" placeholder="np. Długotrwałe zwolnienie lekarskie / urlop bezpłatny">
                    </div>
                </div>
                <button type="submit" class="btn btn-warning btn-sm">+ Dodaj zdarzenie i przesuń termin</button>
            </form>
            <div>${hrEventsHtml}</div>
        </div>
    `;

    // Enforce max additional criteria
    container.querySelectorAll('input[name="additional-crit"]').forEach((cb) => {
        cb.addEventListener('change', () => {
            const checked = container.querySelectorAll('input[name="additional-crit"]:checked');
            if (checked.length > maxAdditional) {
                cb.checked = false;
                showToast(`Możesz wybrać maksymalnie ${maxAdditional} kryteria dodatkowe.`, 'error');
            }
        });
    });

    async function submitSetup(signByEvaluator) {
        const interviewDate = container.querySelector('#setup-interview-date').value || null;
        const notes = container.querySelector('#setup-interview-notes').value.trim();
        const checked = Array.from(container.querySelectorAll('input[name="additional-crit"]:checked')).map((el) =>
            Number(el.value)
        );
        try {
            await api.saveSetup(activeEvaluation.id, {
                data_rozmowy_wstepnej: interviewDate,
                oczekiwania_i_cele: notes,
                additionalCriteriaIds: checked,
                signByEvaluator,
            });
            showToast(
                signByEvaluator
                    ? 'Zapisano i podpisano elektronicznie Część I arkusza!'
                    : 'Zapisano ustalenia rozmowy wstępnej.',
                'success'
            );
            await onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    const btnDraft = container.querySelector('#btn-setup-save-draft');
    if (btnDraft) btnDraft.addEventListener('click', () => submitSetup(false));
    const btnSign = container.querySelector('#btn-setup-save-sign');
    if (btnSign) btnSign.addEventListener('click', () => submitSetup(true));

    const hrForm = container.querySelector('#hr-event-form');
    if (hrForm) {
        hrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawDays = container.querySelector('#hr-event-days').value;
            try {
                const res = await api.createHrEvent(activeEvaluation.id, {
                    typ_zdarzenia: container.querySelector('#hr-event-type').value,
                    data_od: container.querySelector('#hr-event-from').value,
                    data_do: container.querySelector('#hr-event-to').value || null,
                    dni_przesuniecia_terminu: rawDays === '' ? undefined : Number(rawDays),
                    opis: container.querySelector('#hr-event-desc').value.trim(),
                });
                showToast(`Dodano zdarzenie kadrowe. Nowy termin oceny: ${formatDate(res.planowana_data_oceny)}`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    container.querySelectorAll('[data-delete-hr-event]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            try {
                const res = await api.deleteHrEvent(Number(btn.dataset.deleteHrEvent));
                showToast(`Usunięto zdarzenie. Termin oceny: ${formatDate(res.planowana_data_oceny)}`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}
