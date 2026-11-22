import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, formatDate, formatDateTime, showToast, toRomanRank } from '../utils.js';
import { printEvaluationSheet } from './printSheet.js';

export function renderEmployeePanel(workspace, targetElementId, onRefresh) {
    const container = document.getElementById(targetElementId);
    if (!container || !workspace) return;

    const { user, evaluator, activeEvaluation, pastEvaluations } = workspace;
    const lastCompleted = pastEvaluations.find((e) => e.status === 'ZAKONCZONA') || null;
    const isAfterNegative = lastCompleted && lastCompleted.wynik_ogolny === 'NEGATYWNA';
    const legalCfg = (state.dictionaries && state.dictionaries.legalConfig) || {};
    const normalDays = legalCfg.initialInterviewDaysNormal ?? 30;
    const afterNegDays = legalCfg.initialInterviewDaysAfterNegative ?? 7;
    const criteriaLimitDays = isAfterNegative ? afterNegDays : normalDays;
    const standardCycleMonths = legalCfg.cycleMonths ?? 24;
    const afterNegCycleMonths = legalCfg.cycleMonthsAfterNegative ?? 6;
    const appealDaysLimit = legalCfg.appealDaysLimit ?? 7;
    const appealReviewDaysLimit = legalCfg.appealReviewDaysLimit ?? 14;

    const isInitialTalkDone = Boolean(activeEvaluation && activeEvaluation.data_rozmowy_wstepnej);
    const previousEvalWithCriteria =
        lastCompleted ||
        (pastEvaluations && pastEvaluations.find((e) => Array.isArray(e.criteria) && e.criteria.length > 0)) ||
        null;

    let criteriaHeading = `Kryteria brane pod uwagę w bieżącej ocenie (Arkusz ${escapeHtml(user.arkusz || '—')})`;
    let criteriaNoteHtml = '';
    let criteriaSource = activeEvaluation ? activeEvaluation.criteria : [];

    if (activeEvaluation && !isInitialTalkDone) {
        if (previousEvalWithCriteria) {
            const prevSheet = previousEvalWithCriteria.typ_arkusza || user.arkusz || '—';
            criteriaHeading = `Kryteria użyte w poprzedniej ocenie (Arkusz ${escapeHtml(prevSheet)})`;
            criteriaNoteHtml =
                '<p class="text-muted" style="margin-top:4px; font-size:13px;">Rozmowa wstępna nie została jeszcze przeprowadzona — kryteria dla bieżącego okresu zostaną dopiero ustalone.</p>';
            if (Array.isArray(previousEvalWithCriteria.criteria) && previousEvalWithCriteria.criteria.length > 0) {
                criteriaSource = previousEvalWithCriteria.criteria;
            }
        } else {
            criteriaHeading = `Kryteria oceny — oczekują na ustalenie (Arkusz ${escapeHtml(user.arkusz || '—')})`;
            criteriaNoteHtml =
                '<p class="text-muted" style="margin-top:4px; font-size:13px;">Kryteria obowiązkowe i dodatkowe zostaną zatwierdzone podczas rozmowy wstępnej.</p>';
        }
    }

    const criteriaHtml =
        activeEvaluation && criteriaSource && criteriaSource.length > 0
            ? criteriaSource
                .map((c) => {
                    const typeBadge =
                        c.typ_kryterium === 'OBOWIAZKOWE'
                            ? '<span class="badge badge-primary">Obowiązkowe</span>'
                            : '<span class="badge badge-warning">Dodatkowe</span>';
                    const archivedBadge =
                        c.kryterium_czy_aktywne === false
                            ? ' <span class="badge badge-archived">archiwalne</span>'
                            : '';
                    return `<li style="margin-bottom:6px;"><strong>${escapeHtml(c.nazwa)}</strong> ${typeBadge}${archivedBadge}</li>`;
                })
                .join('')
            : '<li class="text-muted">Brak aktywnego cyklu oceny.</li>';

    // Two-sided e-signature action banners
    let actionBannersHtml = '';
    if (activeEvaluation && activeEvaluation.status === 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW') {
        actionBannersHtml += `
            <div class="alert-box alert-warning">
                <strong>Część I — Oczekuje na Twój e-podpis kryteriów:</strong>
                Przełożony wyznaczył kryteria oceny i zapisał ustalenia z rozmowy wstępnej (${escapeHtml(formatDate(activeEvaluation.data_rozmowy_wstepnej))}).
                ${activeEvaluation.oczekiwania_i_cele ? `<p style="margin-top:6px;"><em>Ustalenia:</em> ${escapeHtml(activeEvaluation.oczekiwania_i_cele)}</p>` : ''}
                <div style="margin-top:10px;">
                    <button type="button" class="btn btn-positive btn-sm" id="btn-emp-sign-criteria" data-eval-id="${activeEvaluation.id}">
                        Potwierdzam zapoznanie się z kryteriami (e-Podpis)
                    </button>
                </div>
            </div>
        `;
    }

    if (activeEvaluation && activeEvaluation.status === 'SPORZADZONA_DO_PODPISU') {
        const scoresRows = activeEvaluation.criteria
            .map(
                (c) => `<tr><td>${escapeHtml(c.nazwa)}</td><td><strong>${c.punkty ?? '—'} pkt</strong></td></tr>`
            )
            .join('');
        actionBannersHtml += `
            <div class="card" style="border: 2px solid var(--warning);">
                <div class="card-header">
                    <h2>Sporządzona ocena końcowa — oczekuje na Twój e-podpis</h2>
                    <span class="badge ${activeEvaluation.wynik_ogolny === 'POZYTYWNA' ? 'badge-positive' : 'badge-negative'}">
                        ${escapeHtml(activeEvaluation.wynik_ogolny)} (${activeEvaluation.srednia_punktow} pkt)
                    </span>
                </div>
                <p><strong>Ogólny poziom:</strong> ${escapeHtml(activeEvaluation.poziom_oceny_label || activeEvaluation.poziom_oceny)}</p>
                <div class="table-wrap" style="margin:12px 0;">
                    <table>
                        <thead><tr><th>Kryterium</th><th>Ocena cząstkowa</th></tr></thead>
                        <tbody>${scoresRows}</tbody>
                    </table>
                </div>
                <p style="white-space:pre-line;"><strong>Uzasadnienie:</strong> ${escapeHtml(activeEvaluation.uzasadnienie_oceny || 'Brak')}</p>
                <p style="margin-top:6px; white-space:pre-line;"><strong>Wnioski do IPRZ:</strong> ${escapeHtml(activeEvaluation.wnioski_iprz || '—')}</p>
                <p class="text-muted" style="margin-top:6px; font-size:12px;">Podpis oceniającego: ${escapeHtml(formatDateTime(activeEvaluation.podpis_ocena_oceniajacy_at))}</p>
                <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-positive" id="btn-emp-ack-eval" data-eval-id="${activeEvaluation.id}">
                        Potwierdź zapoznanie się z oceną (e-Podpis)
                    </button>
                    <button type="button" class="btn" id="btn-emp-print-pending" data-eval-id="${activeEvaluation.id}">
                        Drukuj / PDF
                    </button>
                </div>
            </div>
        `;
    }

    // Shared observations (OBIE_STRONY only, enforced server-side)
    let tasksHtml = '';
    if (activeEvaluation && activeEvaluation.tasks.length > 0) {
        tasksHtml = activeEvaluation.tasks
            .map((t) => {
                const tags = (t.tags || [])
                    .map((tg) => {
                        const isWell = tg.kategoria === 'DOBROSTAN';
                        const cls = isWell ? 'badge-wellbeing' : tg.polaryzacja === '+' ? 'badge-positive' : 'badge-negative';
                        const sign = isWell ? '[HR] ' : `(${tg.polaryzacja}) `;
                        const arch = tg.tag_czy_aktywny === false ? ' [archiwalny]' : '';
                        return `<span class="badge ${cls}">${sign}${escapeHtml(tg.tag_nazwa)}${arch}</span>`;
                    })
                    .join(' ');
                return `
                    <div class="task-item">
                        <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                            <strong>${escapeHtml(t.tytul)}</strong>
                            <span class="text-muted">${escapeHtml(formatDate(t.data_zdarzenia))}</span>
                        </div>
                        ${t.opis ? `<p class="text-muted" style="margin-top:4px;">${escapeHtml(t.opis)}</p>` : ''}
                        <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">${tags}</div>
                    </div>
                `;
            })
            .join('');
    } else {
        tasksHtml = '<p class="text-muted">Brak udostępnionych obserwacji w bieżącym okresie.</p>';
    }

    // Past evaluations & appeals
    let evalsHtml = '';
    if (!pastEvaluations || pastEvaluations.length === 0) {
        evalsHtml = '<p class="text-muted">Brak wystawionych ocen okresowych w systemie.</p>';
    } else {
        evalsHtml = pastEvaluations
            .map((ev) => {
                const evBy = state.users.find((u) => u.id === ev.oceniajacy_id);
                const resBadge =
                    ev.wynik_ogolny === 'POZYTYWNA'
                        ? '<span class="badge badge-positive">POZYTYWNA</span>'
                        : '<span class="badge badge-negative">NEGATYWNA</span>';
                const statusBadge =
                    ev.status === 'UNIEWAZNIONA'
                        ? '<span class="badge badge-negative">UNIEWAŻNIONA</span>'
                        : ev.status === 'ODWOLANIE_W_TOKU'
                            ? '<span class="badge badge-warning">ODWOŁANIE W TOKU</span>'
                            : '';

                const latestAppeal = ev.appeals && ev.appeals.length > 0 ? ev.appeals[0] : null;
                let appealBlock = '';
                if (latestAppeal) {
                    const labelMap = (state.dictionaries && state.dictionaries.appealDecisionLabels) || {};
                    const statusLabel = labelMap[latestAppeal.decyzja_dyrektora] || latestAppeal.decyzja_dyrektora;
                    appealBlock = `
                        <div class="alert-box alert-warning" style="margin-top:10px;">
                            <strong>Status odwołania (sprzeciwu):</strong> ${escapeHtml(statusLabel)}
                            ${latestAppeal.uzasadnienie_decyzji ? `<br><em>Decyzja Dyrektora:</em> ${escapeHtml(latestAppeal.uzasadnienie_decyzji)}` : ''}
                            <br><span class="text-muted" style="font-size:12px;">Złożono: ${escapeHtml(formatDate(latestAppeal.data_zlozenia))} &bull; Termin rozpatrzenia (${appealReviewDaysLimit} dni): ${escapeHtml(formatDate(latestAppeal.termin_rozpatrzenia))}</span>
                        </div>
                    `;
                } else if (ev.status === 'ZAKONCZONA') {
                    appealBlock = `
                        <div style="margin-top:10px;">
                            <button type="button" class="btn btn-sm" data-toggle-appeal="${ev.id}">Złóż odwołanie (sprzeciw — ${appealDaysLimit} dni)</button>
                            <div id="appeal-form-${ev.id}" class="hidden" style="margin-top:10px; padding:12px; background:var(--bg-subtle); border-radius:6px;">
                                <div class="form-group">
                                    <label for="appeal-text-${ev.id}">Uzasadnienie sprzeciwu do Dyrektora Generalnego:</label>
                                    <textarea id="appeal-text-${ev.id}" placeholder="Opisz, z którymi ocenami cząstkowymi się nie zgadzasz i dlaczego..."></textarea>
                                </div>
                                <button type="button" class="btn btn-negative btn-sm" data-submit-appeal="${ev.id}">Wyślij sprzeciw do Dyrektora</button>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="task-item">
                        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; margin-bottom:8px;">
                            <div>
                                <strong>Ocena z dnia ${escapeHtml(formatDate(ev.data_rozmowy_oceniajacej || ev.data_zapoznania_z_ocena))}</strong>
                                (Arkusz ${escapeHtml(ev.typ_arkusza)}, podejście ${ev.numer_podejscia})
                                <span class="text-muted"> — Oceniający: ${evBy ? escapeHtml(evBy.imie_nazwisko) : '—'}</span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                                ${resBadge}
                                ${statusBadge}
                                <span class="badge badge-primary">Średnia: ${ev.srednia_punktow} (${escapeHtml(ev.poziom_oceny_label || '')})</span>
                                <button type="button" class="btn btn-xs" data-print-past-eval="${ev.id}">Drukuj / PDF</button>
                            </div>
                        </div>
                        <p style="white-space:pre-line;"><strong>Uzasadnienie:</strong> ${escapeHtml(ev.uzasadnienie_oceny || 'Brak')}</p>
                        <p style="margin-top:6px; white-space:pre-line;"><strong>Wnioski do IPRZ:</strong> ${escapeHtml(ev.wnioski_iprz || '—')}</p>
                        <p class="text-muted" style="margin-top:6px; font-size:12px;">
                            Podpis oceniającego: ${escapeHtml(formatDateTime(ev.podpis_ocena_oceniajacy_at))} |
                            Podpis ocenianego: ${escapeHtml(formatDateTime(ev.podpis_ocena_oceniany_at))}
                        </p>
                        ${appealBlock}
                    </div>
                `;
            })
            .join('');
    }

    const rankText =
        user.employmentType === 'MIANOWANIE'
            ? `Urzędnik służby cywilnej — Stopień służbowy: <strong>${toRomanRank(user.rank)} (${user.rank})</strong>`
            : 'Pracownik służby cywilnej (umowa na czas nieokreślony)';

    const hrEventsCount = activeEvaluation ? activeEvaluation.hrEvents.length : 0;
    const hrNote =
        hrEventsCount > 0
            ? ` (uwzględnia ${hrEventsCount} zdarzeń kadrowych)`
            : isAfterNegative
              ? ` (skrócony cykl: ${afterNegCycleMonths} mies.)`
              : ` (standardowo ${standardCycleMonths} mies.)`;

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2>Profil ocenianego: ${escapeHtml(user.imie_nazwisko)}</h2>
                    <span class="text-muted">${escapeHtml(user.nazwa_stanowiska)} &bull; ${escapeHtml(user.komorka_organizacyjna)}</span>
                </div>
                <div><span class="badge badge-primary">Arkusz ${escapeHtml(user.arkusz || '—')}</span></div>
            </div>
            <div class="grid-2">
                <div>
                    <p><strong>Przypisany oceniający:</strong> ${evaluator ? `${escapeHtml(evaluator.imie_nazwisko)} (${escapeHtml(evaluator.nazwa_stanowiska)})` : 'Brak'}</p>
                    <p style="margin-top:6px;"><strong>Status zatrudnienia:</strong> ${rankText}</p>
                </div>
                <div>
                    <p><strong>Termin rozmowy wstępnej:</strong> ${isAfterNegative ? `<span class="badge badge-negative">${afterNegDays} dni (po ocenie negatywnej)</span>` : `<span class="badge badge-positive">${normalDays} dni (tryb standardowy)</span>`}</p>
                    ${activeEvaluation ? `<p style="margin-top:6px;"><strong>Status bieżącego cyklu:</strong> <span class="badge badge-primary">${escapeHtml(activeEvaluation.status_label)}</span></p>` : ''}
                </div>
            </div>
        </div>

        ${actionBannersHtml}

        ${activeEvaluation
            ? `
            <div class="card">
                <h3>Oś czasu bieżącego okresu oceny</h3>
                <div class="timeline">
                    <div class="timeline-step done">
                        <div class="timeline-date">${escapeHtml(formatDate(activeEvaluation.data_rozpoczecia_cyklu))}</div>
                        <div><strong>Początek cyklu</strong></div>
                        <div class="text-muted">Rozpoczęcie okresu oceny</div>
                    </div>
                    <div class="timeline-step ${activeEvaluation.data_rozmowy_wstepnej ? 'done' : 'urgent'}">
                        <div class="timeline-date">Limit: ${escapeHtml(formatDate(activeEvaluation.termin_wyznaczenia_kryteriow))}</div>
                        <div><strong>Rozmowa wstępna (${criteriaLimitDays} dni)</strong></div>
                        <div class="text-muted">${activeEvaluation.data_rozmowy_wstepnej ? `Odbyta: ${escapeHtml(formatDate(activeEvaluation.data_rozmowy_wstepnej))}` : 'Oczekuje na ustalenie'}</div>
                    </div>
                    <div class="timeline-step">
                        <div class="timeline-date">${escapeHtml(activeEvaluation.status_label)}</div>
                        <div><strong>Bieżąca realizacja zadań</strong></div>
                        <div class="text-muted">Obserwacja i zbieranie tagów</div>
                    </div>
                    <div class="timeline-step">
                        <div class="timeline-date">${escapeHtml(formatDate(activeEvaluation.planowana_data_oceny))}</div>
                        <div><strong>Planowany termin oceny</strong></div>
                        <div class="text-muted">Cykl oceny${hrNote}</div>
                    </div>
                </div>
            </div>
        `
            : ''
        }

        <div class="card">
            <h3>${criteriaHeading}</h3>
            ${criteriaNoteHtml}
            <ul style="margin-left:18px; margin-top:8px;">${criteriaHtml}</ul>
        </div>

        <div class="card">
            <h3>Udostępnione obserwacje z okresu oceny (${activeEvaluation ? activeEvaluation.tasks.length : 0})</h3>
            ${tasksHtml}
        </div>

        <div class="card">
            <h3>Historia ocen okresowych i odwołania</h3>
            ${evalsHtml}
        </div>
    `;

    // Bind events
    const btnSignCrit = container.querySelector('#btn-emp-sign-criteria');
    if (btnSignCrit) {
        btnSignCrit.addEventListener('click', async () => {
            try {
                await api.signCriteria(Number(btnSignCrit.dataset.evalId));
                showToast('Złożono e-podpis potwierdzający zapoznanie się z kryteriami (Część I).', 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    const btnAckEval = container.querySelector('#btn-emp-ack-eval');
    if (btnAckEval) {
        btnAckEval.addEventListener('click', async () => {
            try {
                const res = await api.acknowledgeEvaluation(Number(btnAckEval.dataset.evalId));
                if (res.autoRankPromoted) {
                    showToast(`Potwierdzono ocenę! Stopień służbowy automatycznie wzrósł na ${toRomanRank(res.newRank)}.`, 'success');
                } else {
                    showToast('Złożono e-podpis zapoznania się z oceną. Rozpoczęto kolejny cykl.', 'success');
                }
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    const btnPrintPending = container.querySelector('#btn-emp-print-pending');
    if (btnPrintPending && activeEvaluation) {
        btnPrintPending.addEventListener('click', () => {
            printEvaluationSheet({ employee: user, evaluator, evaluation: activeEvaluation });
        });
    }

    container.querySelectorAll('[data-print-past-eval]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const evalId = Number(btn.dataset.printPastEval);
            const ev = pastEvaluations.find((e) => e.id === evalId);
            if (!ev) return;
            const evUser = state.users.find((u) => u.id === ev.oceniajacy_id);
            printEvaluationSheet({ employee: user, evaluator: evUser, evaluation: ev });
        });
    });

    container.querySelectorAll('[data-toggle-appeal]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const form = container.querySelector(`#appeal-form-${btn.dataset.toggleAppeal}`);
            if (form) form.classList.toggle('hidden');
        });
    });

    container.querySelectorAll('[data-submit-appeal]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const evalId = Number(btn.dataset.submitAppeal);
            const ta = container.querySelector(`#appeal-text-${evalId}`);
            const reason = ta ? ta.value.trim() : '';
            if (!reason) {
                showToast('Wpisz uzasadnienie sprzeciwu przed wysłaniem.', 'error');
                return;
            }
            try {
                const res = await api.createAppeal(evalId, { uzasadnienie_pracownika: reason });
                const warn = res.appeal.po_terminie_ustawowym
                    ? ` (Uwaga: złożono po upływie ${appealDaysLimit} dni od zapoznania — tryb demo)`
                    : '';
                showToast(`Sprzeciw wysłany do Dyrektora Generalnego.${warn}`, 'success');
                await onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}
