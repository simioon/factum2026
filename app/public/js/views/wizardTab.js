import { api } from '../api.js';
import { state } from '../state.js';
import {
    buildSmartIprzPills,
    calculateFinalResultClient,
    escapeHtml,
    formatDateTime,
    getAllEvidenceBlocks,
    showToast,
    toRomanRank,
} from '../utils.js';
import { printEvaluationSheet } from './printSheet.js';

export function renderWizardTab(workspace, onFinalized) {
    const container = document.getElementById('profile-tab-wizard');
    if (!container || !workspace) return;

    const { user, evaluator, activeEvaluation, pastEvaluations, tagSummariesByCriterion } = workspace;
    if (!activeEvaluation) {
        container.innerHTML = '<div class="card"><p class="text-muted">Brak aktywnego cyklu oceny.</p></div>';
        return;
    }

    // If evaluation is already drafted and waiting for employee's e-signature
    if (activeEvaluation.status === 'SPORZADZONA_DO_PODPISU') {
        const rows = activeEvaluation.criteria
            .map((c) => `<tr><td>${escapeHtml(c.nazwa)}</td><td><strong>${c.punkty ?? '—'} pkt</strong></td></tr>`)
            .join('');
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2>Ocena sporządzona — oczekuje na e-podpis pracownika</h2>
                    <span class="badge ${activeEvaluation.wynik_ogolny === 'POZYTYWNA' ? 'badge-positive' : 'badge-negative'}">
                        ${escapeHtml(activeEvaluation.wynik_ogolny)} (${activeEvaluation.srednia_punktow} pkt)
                    </span>
                </div>
                <p class="alert-box alert-info">
                    Ocena została podpisana przez przełożonego (${escapeHtml(formatDateTime(activeEvaluation.podpis_ocena_oceniajacy_at))}) i przesłana do zapoznania się przez pracownika.
                    Po złożeniu e-podpisu przez <strong>${escapeHtml(user.imie_nazwisko)}</strong> zostanie zamknięta i otworzy się kolejny cykl.
                </p>
                <div class="table-wrap" style="margin:12px 0;">
                    <table>
                        <thead><tr><th>Kryterium</th><th>Przyznana ocena</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <p style="white-space:pre-line;"><strong>Uzasadnienie:</strong> ${escapeHtml(activeEvaluation.uzasadnienie_oceny || '—')}</p>
                <p style="margin-top:6px; white-space:pre-line;"><strong>Wnioski IPRZ:</strong> ${escapeHtml(activeEvaluation.wnioski_iprz || '—')}</p>
                <div style="margin-top:14px;">
                    <button type="button" class="btn" id="btn-wizard-print-waiting">Drukuj / PDF</button>
                </div>
            </div>
        `;
        container.querySelector('#btn-wizard-print-waiting').addEventListener('click', () => {
            printEvaluationSheet({ employee: user, evaluator, evaluation: activeEvaluation });
        });
        return;
    }

    // Wstępne załadowanie zapisanych wcześniej punktów i tekstów (np. przy poprawce po odwołaniu)
    if (state.wizard.loadedEvalId !== activeEvaluation.id) {
        state.wizard.loadedEvalId = activeEvaluation.id;
        state.wizard.stepIndex = 0;
        state.wizard.scores = {};
        for (const c of activeEvaluation.criteria || []) {
            if (c.punkty !== null && c.punkty !== undefined) {
                state.wizard.scores[c.kryterium_id] = Number(c.punkty);
            }
        }
        state.wizard.justification = activeEvaluation.uzasadnienie_oceny || '';
        state.wizard.iprz = activeEvaluation.wnioski_iprz || '';
        state.wizard.selectedEvidenceKeys = [];
        state.wizard.usedIprzPills = [];
    }

    const activeCriteria = activeEvaluation.criteria || [];
    const totalSteps = activeCriteria.length + 1;
    const currentStep = Math.min(state.wizard.stepIndex, activeCriteria.length);
    state.wizard.stepIndex = currentStep;

    const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);
    const approvedChangeAppeal = (activeEvaluation.appeals || []).find(
        (a) => a.decyzja_dyrektora === 'UWZGLEDNIONY_ZMIANA'
    );
    const appealCorrectionBanner = approvedChangeAppeal
        ? `
        <div class="alert-box alert-negative" style="margin-bottom:12px;">
            <strong>Ocena skierowana do poprawy przez Dyrektora Generalnego:</strong><br>
            <span>Decyzja dyrektora: ${escapeHtml(approvedChangeAppeal.uzasadnienie_decyzji || 'Uwzględniono odwołanie — wymagana korekta oceny.')}</span><br>
            <span class="text-muted" style="font-size:12px;">Argumentacja pracownika: ${escapeHtml(approvedChangeAppeal.uzasadnienie_pracownika || '—')}</span>
        </div>
    `
        : '';
    const headerInfo = `
        <div class="card" style="background: var(--bg-subtle);">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px;">
                <div><strong>Arkusz oceny ${escapeHtml(activeEvaluation.typ_arkusza)}</strong> (podejście ${activeEvaluation.numer_podejscia}) &bull; Oceniany: ${escapeHtml(user.imie_nazwisko)} &bull; Oceniający: ${evaluator ? escapeHtml(evaluator.imie_nazwisko) : '—'}</div>
                <div><strong>Krok ${currentStep + 1} z ${totalSteps}</strong></div>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width:${progressPct}%;"></div>
            </div>
        </div>
    `;

    // Steps 1..N: Individual criteria
    if (currentStep < activeCriteria.length) {
        const item = activeCriteria[currentStep];
        const critId = item.kryterium_id;
        const tagSummary = (tagSummariesByCriterion && tagSummariesByCriterion[critId]) || {
            posCount: 0,
            negCount: 0,
            entries: [],
            suggestedLabel: '5 pkt (Na poziomie oczekiwań)',
        };
        const selectedVal = state.wizard.scores[critId] || null;
        const isMandatory = item.typ_kryterium === 'OBOWIAZKOWE';

        const descHtml = `<ul class="criterion-desc-list">${(item.descriptions || [])
            .map((d) => `<li>${escapeHtml(d)}</li>`)
            .join('')}</ul>`;

        const commentsHtml =
            tagSummary.entries.length === 0
                ? '<p class="text-muted">Brak tagów z zadań powiązanych z tym kryterium w bieżącym okresie.</p>'
                : tagSummary.entries
                      .map((e) => {
                          const isPos = e.polarity === '+';
                          return `
                            <div class="tag-row ${isPos ? 'pos' : 'neg'}" style="margin-bottom:6px;">
                                <div class="tag-row-content">
                                    <strong style="color:${isPos ? 'var(--positive)' : 'var(--negative)'};">${isPos ? '(+)' : '(-)'} ${escapeHtml(e.tagId)}</strong>
                                    <span><strong>${escapeHtml(e.taskTitle)}</strong> (${escapeHtml(e.taskDate)}): ${escapeHtml(e.comment || '—')}</span>
                                </div>
                            </div>
                        `;
                      })
                      .join('');

        const scoreScale = (state.dictionaries && state.dictionaries.scoreScale) || [];
        const radiosHtml = scoreScale
            .map((opt) => {
                const isChecked = Number(selectedVal) === opt.value;
                return `
                    <label class="score-radio-label ${isChecked ? 'selected' : ''}" data-score-opt="${opt.value}">
                        <input type="radio" name="wizard-score" value="${opt.value}" ${isChecked ? 'checked' : ''}>
                        <span>${escapeHtml(opt.label)}</span>
                    </label>
                `;
            })
            .join('');

        container.innerHTML =
            appealCorrectionBanner +
            headerInfo +
            `
            <div class="card">
                <div class="card-header">
                    <div>
                        <span class="badge ${isMandatory ? 'badge-primary' : 'badge-warning'}" style="margin-bottom:6px;">
                            ${isMandatory ? 'Kryterium obowiązkowe' : 'Kryterium dodatkowe'}
                        </span>
                        <h2>${currentStep + 1}. ${escapeHtml(item.nazwa)}</h2>
                    </div>
                </div>

                <h3>Oficjalny opis kryterium (Załącznik nr 1 do Rozporządzenia):</h3>
                ${descHtml}

                <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-color);">
                    <h3>Podsumowanie tagów z okresu oceny dla tego kryterium:</h3>
                    <div style="display:flex; gap:10px; margin:8px 0 12px;">
                        <span class="badge badge-positive" style="font-size:13px; padding:5px 12px;">Tagi dodatnie (+): ${tagSummary.posCount}</span>
                        <span class="badge badge-negative" style="font-size:13px; padding:5px 12px;">Tagi ujemne (-): ${tagSummary.negCount}</span>
                    </div>
                    ${commentsHtml}
                </div>

                <div class="alert-box alert-info" style="margin-top:14px;">
                    <strong>Wskazówka informacyjna Asystenta:</strong>
                    Na podstawie <strong>${tagSummary.posCount}</strong> tagów (+) i <strong>${tagSummary.negCount}</strong> tagów (-) bilans sugeruje poziom:
                    <strong>${escapeHtml(tagSummary.suggestedLabel)}</strong>.
                    <br><span style="font-size:12px;">Informacja ma charakter wyłącznie pomocniczy — ostateczną ocenę cząstkową wybierasz samodzielnie.</span>
                </div>

                <h3 style="margin-top:16px;">Wybierz ocenę cząstkową:</h3>
                <div class="score-options">${radiosHtml}</div>

                <div style="display:flex; justify-content:space-between; margin-top:20px; padding-top:14px; border-top:1px solid var(--border-color);">
                    <button type="button" class="btn" id="btn-wiz-prev" ${currentStep === 0 ? 'disabled' : ''}>&larr; Poprzednie kryterium</button>
                    <button type="button" class="btn btn-primary" id="btn-wiz-next">
                        ${currentStep === activeCriteria.length - 1 ? 'Przejdź do podsumowania &rarr;' : 'Następne kryterium &rarr;'}
                    </button>
                </div>
            </div>
        `;

        container.querySelectorAll('[data-score-opt]').forEach((label) => {
            label.addEventListener('click', () => {
                state.wizard.scores[critId] = Number(label.dataset.scoreOpt);
                renderWizardTab(workspace, onFinalized);
            });
        });

        container.querySelector('#btn-wiz-prev').addEventListener('click', () => {
            if (state.wizard.stepIndex > 0) {
                state.wizard.stepIndex--;
                renderWizardTab(workspace, onFinalized);
            }
        });

        container.querySelector('#btn-wiz-next').addEventListener('click', () => {
            if (!state.wizard.scores[critId]) {
                showToast('Wybierz ocenę cząstkową (1, 3, 5, 7 lub 9 pkt) przed przejściem dalej.', 'error');
                return;
            }
            state.wizard.stepIndex++;
            renderWizardTab(workspace, onFinalized);
        });
        return;
    }

    // Final Step: Summary + Split-Screen + IPRZ Pills
    const calc = calculateFinalResultClient(state.wizard.scores);
    if (!state.wizard.evidenceFilter) {
        state.wizard.evidenceFilter = calc.result === 'NEGATYWNA' ? 'neg' : 'all';
    }

    const prevEval = pastEvaluations.find((e) => e.status === 'ZAKONCZONA') || null;
    const autoRankPromotion = Boolean(
        user.employmentType === 'MIANOWANIE' &&
            user.rank < 9 &&
            calc.result === 'POZYTYWNA' &&
            calc.average > 6 &&
            prevEval &&
            prevEval.wynik_ogolny === 'POZYTYWNA' &&
            Number(prevEval.srednia_punktow) > 6
    );

    const tableRows = activeCriteria
        .map((c) => {
            const sc = state.wizard.scores[c.kryterium_id];
            const badge =
                c.typ_kryterium === 'OBOWIAZKOWE'
                    ? '<span class="badge badge-primary">Obowiązkowe</span>'
                    : '<span class="badge badge-warning">Dodatkowe</span>';
            return `<tr><td>${escapeHtml(c.nazwa)} ${badge}</td><td><strong>${sc} pkt</strong></td></tr>`;
        })
        .join('');

    let rankBlockHtml = '';
    if (autoRankPromotion) {
        rankBlockHtml = `
            <div class="alert-box alert-positive">
                <strong>Automatyczna zmiana stopnia służbowego (z mocy prawa):</strong>
                Pracownik jest urzędnikiem mianowanym i uzyskał dwie kolejne oceny pozytywne powyżej 6 pkt
                (poprzednia: ${prevEval.srednia_punktow} pkt, obecna: ${calc.average} pkt).
                Po zapoznaniu się pracownika z oceną stopień służbowy wzrośnie automatycznie ze
                <strong>${toRomanRank(user.rank)}</strong> na <strong>${toRomanRank(user.rank + 1)}</strong>!
            </div>
        `;
    } else if (user.employmentType === 'MIANOWANIE' && calc.result === 'POZYTYWNA' && user.rank < 9) {
        rankBlockHtml = `
            <div class="alert-box alert-info">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
                    <input type="checkbox" id="wizard-rank-checkbox" ${state.wizard.requestRankPromotion ? 'checked' : ''}>
                    Dołącz fakultatywny wniosek o przyznanie kolejnego stopnia służbowego (stopień ${toRomanRank(user.rank + 1)}) do Dyrektora Generalnego (Część III)
                </label>
            </div>
        `;
    }

    const allEvidence = getAllEvidenceBlocks(activeEvaluation.tasks);
    const filteredEvidence = allEvidence.filter((b) => {
        if (state.wizard.evidenceFilter === 'all') return true;
        if (state.wizard.evidenceFilter === 'pos') return b.polarity === '+';
        if (state.wizard.evidenceFilter === 'neg') return b.polarity === '-';
        return true;
    });

    const evidenceHtml =
        filteredEvidence.length === 0
            ? '<p class="text-muted" style="padding:10px;">Brak obserwacji spełniających wybrany filtr.</p>'
            : filteredEvidence
                  .map((b) => {
                      const isChecked = state.wizard.selectedEvidenceKeys.includes(b.key);
                      const cardTypeClass = b.isWellbeing ? 'wellbeing' : b.polarity === '+' ? 'pos' : 'neg';
                      const tagBadgeClass = b.isWellbeing
                          ? 'badge-wellbeing'
                          : b.polarity === '+'
                            ? 'badge-positive'
                            : 'badge-negative';
                      return `
                        <label class="evidence-card ${cardTypeClass} ${isChecked ? 'checked' : ''}">
                            <input type="checkbox" data-evidence-key="${escapeHtml(b.key)}" ${isChecked ? 'checked' : ''}>
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                                    <strong style="font-size:12px;">${escapeHtml(b.date)} &bull; ${escapeHtml(b.taskTitle)}</strong>
                                    <span class="badge ${tagBadgeClass}">${escapeHtml(b.polarity)}${escapeHtml(b.tagName)}</span>
                                </div>
                                <div class="text-muted" style="font-size:12px; margin-top:4px;">„${escapeHtml(b.comment || 'Brak komentarza')}”</div>
                            </div>
                        </label>
                    `;
                  })
                  .join('');

    const iprzPills = buildSmartIprzPills(activeCriteria, state.wizard.scores, tagSummariesByCriterion);
    const pillsHtml = iprzPills
        .map((pText, i) => {
            const isUsed = state.wizard.usedIprzPills.includes(pText);
            return `<button type="button" class="iprz-pill ${isUsed ? 'used' : ''}" data-iprz-pill="${i}">${isUsed ? '&#10003; ' : '+ '}${escapeHtml(pText)}</button>`;
        })
        .join('');

    const legalBadgeHtml =
        calc.result === 'NEGATYWNA'
            ? '<span class="badge badge-negative">Uzasadnienie OBOWIĄZKOWE (wymagane do podpisu)</span>'
            : '<span class="badge badge-positive">Uzasadnienie fakultatywne</span>';

    container.innerHTML =
        appealCorrectionBanner +
        headerInfo +
        `
        <div class="card">
            <h2>Podsumowanie i zatwierdzenie oceny okresowej</h2>

            <div class="table-wrap" style="margin:14px 0;">
                <table>
                    <thead><tr><th>Kryterium oceny</th><th>Przyznana ocena cząstkowa</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>

            <div class="alert-box ${calc.result === 'POZYTYWNA' ? 'alert-positive' : 'alert-negative'}">
                <strong>Średnia arytmetyczna:</strong> ${calc.average} pkt &bull;
                <strong>Ogólny poziom:</strong> ${escapeHtml(calc.level)} &bull;
                <strong>OCENA KOŃCOWA: ${calc.result}</strong>
                ${calc.hasOnePoint ? '<br><em>Uwaga: Przyznano ocenę cząstkową 1 pkt (znacznie poniżej oczekiwań), co zgodnie z § 11 Rozporządzenia automatycznie skutkuje oceną NEGATYWNĄ.</em>' : ''}
            </div>

            ${rankBlockHtml}

            <div class="split-screen">
                <div class="split-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                        <h3 style="margin:0;">Uzasadnienie oceny okresowej</h3>
                        ${legalBadgeHtml}
                    </div>
                    <p class="text-muted" style="font-size:12px;">Wygeneruj szybki szkic z ocen i tagów, a następnie zaznacz wybrane fakty po prawej stronie:</p>

                    <div class="draft-btn-group">
                        <button type="button" class="btn btn-sm" data-draft-mode="general">Ogólne podsumowanie</button>
                        <button type="button" class="btn btn-sm" data-draft-mode="key">Kluczowe obszary (+/-)</button>
                        <button type="button" class="btn btn-sm" data-draft-mode="detailed">Szczegółowe (wszystkie kryteria)</button>
                    </div>

                    <textarea id="wizard-justification" style="min-height:240px;"
                        placeholder="Kliknij jeden z przycisków powyżej lub zaznacz klocki dowodowe po prawej stronie, albo wpisz własny tekst...">${escapeHtml(state.wizard.justification)}</textarea>
                </div>

                <div class="split-panel">
                    <h3 style="margin-bottom:4px;">Klocki dowodowe — Twoje notatki z okresu oceny</h3>
                    <p class="text-muted" style="font-size:12px;">
                        Zaznaczenie <strong>[x]</strong> dopisuje konkretny fakt z datą do uzasadnienia. Odznaczenie usuwa tylko tę linijkę.
                    </p>

                    <div class="evidence-filters">
                        <button type="button" class="filter-btn ${state.wizard.evidenceFilter === 'all' ? 'active' : ''}" data-ev-filter="all">Wszystkie (${allEvidence.length})</button>
                        <button type="button" class="filter-btn ${state.wizard.evidenceFilter === 'pos' ? 'active' : ''}" data-ev-filter="pos">Tylko +</button>
                        <button type="button" class="filter-btn ${state.wizard.evidenceFilter === 'neg' ? 'active' : ''}" data-ev-filter="neg">Tylko -</button>
                    </div>

                    <div class="evidence-scroll-list">${evidenceHtml}</div>
                </div>
            </div>

            <div class="form-group" style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-color);">
                <label for="wizard-iprz">Wnioski dotyczące Indywidualnego Programu Rozwoju Zawodowego (IPRZ)</label>
                <p class="text-muted" style="font-size:12px;">Kliknij wybrane smart-propozycje dopasowane do wyników pracownika, aby dopisać je do planu rozwoju:</p>
                <div class="iprz-pills-wrap">${pillsHtml}</div>
                <textarea id="wizard-iprz" style="min-height:90px;"
                    placeholder="Zaproponuj kierunki rozwoju, szkolenia, mentoring...">${escapeHtml(state.wizard.iprz)}</textarea>
            </div>

            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:10px; margin-top:18px; padding-top:14px; border-top:1px solid var(--border-color);">
                <button type="button" class="btn" id="btn-wiz-back">&larr; Wróć do kryteriów</button>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    <button type="button" class="btn" id="btn-wiz-print-draft">Drukuj / Zapisz jako PDF</button>
                    <button type="button" class="btn btn-positive" id="btn-wiz-finalize">Podpisz elektronicznie i wystaw ocenę</button>
                </div>
            </div>
        </div>
    `;

    const justifTa = container.querySelector('#wizard-justification');
    justifTa.addEventListener('input', () => {
        state.wizard.justification = justifTa.value;
    });

    const iprzTa = container.querySelector('#wizard-iprz');
    iprzTa.addEventListener('input', () => {
        state.wizard.iprz = iprzTa.value;
    });

    const rankCb = container.querySelector('#wizard-rank-checkbox');
    if (rankCb) {
        rankCb.addEventListener('change', () => {
            state.wizard.requestRankPromotion = rankCb.checked;
        });
    }

    container.querySelectorAll('[data-draft-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.draftMode;
            const existingBullets = allEvidence
                .filter((b) => state.wizard.selectedEvidenceKeys.includes(b.key))
                .map((b) => b.formattedLine);

            let draftText = '';
            if (mode === 'general') {
                draftText =
                    `W okresie podlegającym ocenie pracownik uzyskał średnią arytmetyczną ${calc.average} pkt, co odpowiada ogólnemu poziomowi: ${calc.level.toLowerCase()} (ocena okresowa: ${calc.result}). ` +
                    (calc.result === 'POZYTYWNA'
                        ? `Realizacja głównych obowiązków na stanowisku ${user.nazwa_stanowiska} przebiegała zgodnie z oczekiwaniami i standardami służby cywilnej.`
                        : `W ocenianym okresie wystąpiły istotne obszary wymagające pilnej poprawy w zakresie realizacji obowiązków na stanowisku ${user.nazwa_stanowiska}.`);
            } else if (mode === 'key') {
                let maxScore = -1;
                let minScore = 99;
                for (const c of activeCriteria) {
                    const sc = Number(state.wizard.scores[c.kryterium_id] || 5);
                    if (sc > maxScore) maxScore = sc;
                    if (sc < minScore) minScore = sc;
                }
                const strongest = [];
                const weakest = [];
                for (const c of activeCriteria) {
                    const sc = Number(state.wizard.scores[c.kryterium_id] || 5);
                    const sum = (tagSummariesByCriterion && tagSummariesByCriterion[c.kryterium_id]) || {
                        posCount: 0,
                        negCount: 0,
                    };
                    if (sc === maxScore) strongest.push(`${c.nazwa} (${sc} pkt, tagi: +${sum.posCount}/-${sum.negCount})`);
                    if (sc === minScore && sc < maxScore)
                        weakest.push(`${c.nazwa} (${sc} pkt, tagi: +${sum.posCount}/-${sum.negCount})`);
                }
                draftText = `Ocena okresowa (${calc.result}, średnia ${calc.average} pkt — ${calc.level.toLowerCase()}).\nMocne strony: ${strongest.join(', ')}.`;
                if (weakest.length > 0) {
                    draftText += `\nObszary wymagające wsparcia lub poprawy: ${weakest.join(', ')}.`;
                }
            } else if (mode === 'detailed') {
                const lines = [
                    `Szczegółowe uzasadnienie oceny okresowej (${calc.result}, średnia ${calc.average} pkt — ${calc.level.toLowerCase()}):`,
                ];
                for (const c of activeCriteria) {
                    const sc = state.wizard.scores[c.kryterium_id];
                    const sum = (tagSummariesByCriterion && tagSummariesByCriterion[c.kryterium_id]) || {
                        posCount: 0,
                        negCount: 0,
                    };
                    lines.push(
                        `- ${c.nazwa}: ${sc} pkt (zebrane obserwacje: ${sum.posCount} pozytywnych, ${sum.negCount} do poprawy).`
                    );
                }
                draftText = lines.join('\n');
            }

            if (existingBullets.length > 0) {
                draftText += `\n\nPrzykłady potwierdzające ocenę:\n${existingBullets.join('\n')}`;
            }

            state.wizard.justification = draftText;
            justifTa.value = draftText;
            showToast('Wygenerowano szkic uzasadnienia na podstawie ocen i tagów.', 'success');
        });
    });

    container.querySelectorAll('[data-ev-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.wizard.evidenceFilter = btn.dataset.evFilter;
            renderWizardTab(workspace, onFinalized);
        });
    });

    container.querySelectorAll('[data-evidence-key]').forEach((cb) => {
        cb.addEventListener('change', () => {
            const key = cb.dataset.evidenceKey;
            const targetBlock = allEvidence.find((b) => b.key === key);
            if (!targetBlock) return;

            let currentText = justifTa.value;
            const headerMarker = 'Przykłady potwierdzające ocenę:';

            if (cb.checked) {
                if (!state.wizard.selectedEvidenceKeys.includes(key)) {
                    state.wizard.selectedEvidenceKeys.push(key);
                }
                if (!currentText.includes(targetBlock.formattedLine)) {
                    if (!currentText.includes(headerMarker)) {
                        const sep = currentText.trim().length > 0 ? '\n\n' : '';
                        currentText = `${currentText.trimEnd()}${sep}${headerMarker}\n${targetBlock.formattedLine}`;
                    } else {
                        currentText = `${currentText.trimEnd()}\n${targetBlock.formattedLine}`;
                    }
                }
            } else {
                state.wizard.selectedEvidenceKeys = state.wizard.selectedEvidenceKeys.filter((k) => k !== key);
                const keptLines = currentText
                    .split('\n')
                    .filter((line) => line.trim() !== targetBlock.formattedLine.trim());
                currentText = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
                if (state.wizard.selectedEvidenceKeys.length === 0 && currentText.endsWith(headerMarker)) {
                    currentText = currentText.slice(0, currentText.length - headerMarker.length).trimEnd();
                }
            }

            state.wizard.justification = currentText;
            renderWizardTab(workspace, onFinalized);
        });
    });

    container.querySelectorAll('[data-iprz-pill]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const pillText = iprzPills[Number(btn.dataset.iprzPill)];
            if (!pillText) return;
            let currentText = iprzTa.value;
            if (!currentText.includes(pillText)) {
                const sep = currentText.trim().length > 0 ? '\n' : '';
                currentText = `${currentText.trimEnd()}${sep}• ${pillText}`;
            }
            if (!state.wizard.usedIprzPills.includes(pillText)) {
                state.wizard.usedIprzPills.push(pillText);
            }
            state.wizard.iprz = currentText;
            renderWizardTab(workspace, onFinalized);
        });
    });

    container.querySelector('#btn-wiz-back').addEventListener('click', () => {
        state.wizard.stepIndex = Math.max(0, state.wizard.stepIndex - 1);
        renderWizardTab(workspace, onFinalized);
    });

    container.querySelector('#btn-wiz-print-draft').addEventListener('click', () => {
        const draftEv = {
            typ_arkusza: activeEvaluation.typ_arkusza,
            numer_podejscia: activeEvaluation.numer_podejscia,
            data_rozmowy_oceniajacej: new Date().toISOString().slice(0, 10),
            srednia_punktow: calc.average,
            poziom_oceny_label: calc.level,
            wynik_ogolny: calc.result,
            uzasadnienie_oceny: justifTa.value,
            wnioski_iprz: iprzTa.value,
            criteria: activeCriteria.map((c) => ({
                ...c,
                punkty: state.wizard.scores[c.kryterium_id],
            })),
        };
        printEvaluationSheet({ employee: user, evaluator, evaluation: draftEv });
    });

    container.querySelector('#btn-wiz-finalize').addEventListener('click', async () => {
        const justif = justifTa.value.trim();
        const iprz = iprzTa.value.trim();
        if (calc.result === 'NEGATYWNA' && !justif) {
            showToast('Blokada podpisu: przy ocenie NEGATYWNEJ uzasadnienie jest obowiązkowe!', 'error');
            return;
        }
        try {
            const res = await api.finalizeEvaluation(activeEvaluation.id, {
                scores: state.wizard.scores,
                uzasadnienie_oceny: justif,
                wnioski_iprz: iprz,
                requestRankPromotion: Boolean(state.wizard.requestRankPromotion),
            });
            if (res.autoRankPromotionPending) {
                showToast('Wystawiono ocenę! Po e-podpisie pracownika stopień służbowy wzrośnie automatycznie.', 'success');
            } else if (state.wizard.requestRankPromotion) {
                showToast('Wystawiono ocenę i przekazano wniosek o stopień służbowy do Dyrektora!', 'success');
            } else {
                showToast('Podpisano elektronicznie i przekazano ocenę do zapoznania się przez pracownika.', 'success');
            }
            await onFinalized();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}
