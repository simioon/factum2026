import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, formatDate, showToast, toRomanRank } from '../utils.js';
import { renderSubordinatesList } from './managerView.js';

export function renderDirectorPanel(directorUser, callbacks) {
    const tabs = document.getElementById('director-main-tabs').querySelectorAll('.tab-btn');
    tabs[0].classList.toggle('active', state.directorActiveTab === 'requests');
    tabs[1].classList.toggle('active', state.directorActiveTab === 'team');

    const subReq = document.getElementById('director-subview-requests');
    const subTeam = document.getElementById('director-subview-team');
    subReq.classList.add('hidden');
    subTeam.classList.add('hidden');

    if (state.directorActiveTab === 'team') {
        subTeam.classList.remove('hidden');
        renderSubordinatesList(directorUser.id, 'director-team-mount', callbacks);
        return;
    }

    subReq.classList.remove('hidden');

    const appeals = state.appeals || [];
    const appealsHtml =
        appeals.length === 0
            ? '<p class="text-muted">Brak złożonych odwołań od ocen okresowych. (Możesz złożyć testowe odwołanie z konta Anny Nowak lub Tomasza Mazura).</p>'
            : appeals
                  .map((ap) => {
                      const isPending = ap.decyzja_dyrektora === 'OCZEKUJE';
                      const actionHtml = isPending
                          ? `
                            <div class="form-group" style="margin-top:10px;">
                                <label for="dir-appeal-note-${ap.id}">Uzasadnienie decyzji Dyrektora:</label>
                                <input type="text" id="dir-appeal-note-${ap.id}" placeholder="Wpisz motywację decyzji...">
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                                <button type="button" class="btn btn-positive btn-sm" data-decide-appeal="${ap.id}" data-decision="UWZGLEDNIONY_ZMIANA">Uwzględnij (zmiana oceny)</button>
                                <button type="button" class="btn btn-warning btn-sm" data-decide-appeal="${ap.id}" data-decision="UWZGLEDNIONY_PONOWNA_OCENA">Uwzględnij (ponowna ocena)</button>
                                <button type="button" class="btn btn-negative btn-sm" data-decide-appeal="${ap.id}" data-decision="ODRZUCONY">Odrzuć odwołanie</button>
                            </div>
                        `
                          : `<p style="margin-top:8px;"><strong>Decyzja Dyrektora:</strong> ${escapeHtml(ap.decyzja_label || ap.decyzja_dyrektora)}${ap.uzasadnienie_decyzji ? ` — ${escapeHtml(ap.uzasadnienie_decyzji)}` : ''}</p>`;

                      return `
                        <div class="task-item">
                            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                                <strong>Sprzeciw pracownika: ${escapeHtml(ap.pracownik_nazwa)}</strong>
                                <span class="badge ${isPending ? 'badge-warning' : 'badge-primary'}">${escapeHtml(ap.decyzja_label || ap.decyzja_dyrektora)}</span>
                            </div>
                            <p class="text-muted">
                                Oceniający: ${escapeHtml(ap.oceniajacy_nazwa)} &bull;
                                Data złożenia: ${escapeHtml(formatDate(ap.data_zlozenia))} &bull;
                                Termin rozpatrzenia: ${escapeHtml(formatDate(ap.termin_rozpatrzenia))}
                                ${ap.po_terminie_ustawowym ? ' <span class="badge badge-negative">Złożono po 7 dniach (Demo)</span>' : ''}
                            </p>
                            <p style="margin-top:6px;"><strong>Treść sprzeciwu:</strong> ${escapeHtml(ap.uzasadnienie_pracownika)}</p>
                            ${actionHtml}
                        </div>
                    `;
                  })
                  .join('');

    const rankRequests = state.rankRequests || [];
    const rankHtml =
        rankRequests.length === 0
            ? '<p class="text-muted">Brak wniosków o przyznanie kolejnego stopnia służbowego.</p>'
            : rankRequests
                  .map((rr) => {
                      const isPending = rr.status_decyzji === 'OCZEKUJE';
                      const modeBadge =
                          rr.tryb_przyznania === 'OBLIGATORYJNY'
                              ? '<span class="badge badge-positive">OBLIGATORYJNY (z mocy prawa)</span>'
                              : '<span class="badge badge-primary">FAKULTATYWNY</span>';

                      const actionHtml = isPending
                          ? `
                            <div class="form-group" style="margin-top:10px;">
                                <label for="dir-rank-note-${rr.id}">Motywacja Dyrektora (opcjonalnie):</label>
                                <input type="text" id="dir-rank-note-${rr.id}" placeholder="Uzasadnienie decyzji o stopniu...">
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button type="button" class="btn btn-positive btn-sm" data-decide-rank="${rr.id}" data-rank-decision="ZATWIERDZONY">Zatwierdź stopień ${toRomanRank(rr.wnioskowany_stopien)}</button>
                                <button type="button" class="btn btn-negative btn-sm" data-decide-rank="${rr.id}" data-rank-decision="ODRZUCONY">Odrzuć wniosek</button>
                            </div>
                        `
                          : `<p style="margin-top:6px;"><strong>Status decyzji:</strong> ${escapeHtml(rr.status_label || rr.status_decyzji)}${rr.motywacja_dyrektora ? ` — ${escapeHtml(rr.motywacja_dyrektora)}` : ''}</p>`;

                      return `
                        <div class="task-item">
                            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                                <div>
                                    <strong>Wniosek o stopień ${toRomanRank(rr.wnioskowany_stopien)} dla: ${escapeHtml(rr.pracownik_nazwa)}</strong>
                                    ${modeBadge}
                                </div>
                                <span class="badge ${isPending ? 'badge-warning' : rr.status_decyzji === 'ZATWIERDZONY' ? 'badge-positive' : 'badge-negative'}">${escapeHtml(rr.status_label || rr.status_decyzji)}</span>
                            </div>
                            <p style="margin-top:6px;"><strong>Umotywowanie przełożonego:</strong> ${escapeHtml(rr.umotywowanie_przelozonego || '—')}</p>
                            ${actionHtml}
                        </div>
                    `;
                  })
                  .join('');

    subReq.innerHTML = `
        <div class="card">
            <div class="card-header"><h2>Odwołania (sprzeciwy) od ocen okresowych</h2></div>
            ${appealsHtml}
        </div>
        <div class="card">
            <div class="card-header"><h2>Wnioski o przyznanie kolejnego stopnia służbowego</h2></div>
            ${rankHtml}
        </div>
    `;

    subReq.querySelectorAll('[data-decide-appeal]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const appealId = Number(btn.dataset.decideAppeal);
            const decision = btn.dataset.decision;
            const noteEl = subReq.querySelector(`#dir-appeal-note-${appealId}`);
            try {
                await api.decideAppeal(appealId, {
                    decyzja_dyrektora: decision,
                    uzasadnienie_decyzji: noteEl ? noteEl.value.trim() : '',
                });
                showToast(`Zapisano decyzję Dyrektora w sprawie odwołania: ${decision}`, 'success');
                await callbacks.onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    subReq.querySelectorAll('[data-decide-rank]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const reqId = Number(btn.dataset.decideRank);
            const decision = btn.dataset.rankDecision;
            const noteEl = subReq.querySelector(`#dir-rank-note-${reqId}`);
            try {
                await api.decideRankRequest(reqId, {
                    status_decyzji: decision,
                    motywacja_dyrektora: noteEl ? noteEl.value.trim() : '',
                });
                showToast(`Decyzja w sprawie stopnia służbowego: ${decision}`, 'success');
                await callbacks.onRefresh();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}
