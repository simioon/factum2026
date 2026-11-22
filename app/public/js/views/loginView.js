import { state } from '../state.js';
import { escapeHtml, toRomanRank } from '../utils.js';

export function renderTopbarSwitcher() {
    const select = document.getElementById('quick-role-select');
    const options = ['<option value="">-- Wybierz konto (Ekran startowy) --</option>'];

    for (const u of state.users) {
        const selected = u.id === state.currentUserId ? 'selected' : '';
        const sheetText = u.arkusz ? `Arkusz ${u.arkusz}` : 'Bez arkusza';
        options.push(
            `<option value="${u.id}" ${selected}>${escapeHtml(u.imie_nazwisko)} (${u.rola} — ${sheetText})</option>`
        );
    }
    select.innerHTML = options.join('');

    const btnLogout = document.getElementById('btn-logout');
    if (state.currentUserId) btnLogout.classList.remove('hidden');
    else btnLogout.classList.add('hidden');
}

export function renderLoginScreen(onSwitchUser) {
    const grid = document.getElementById('login-cards-grid');
    grid.innerHTML = state.users
        .map((u) => {
            const rankInfo =
                u.employmentType === 'MIANOWANIE'
                    ? `Urzędnik mianowany (stopień ${toRomanRank(u.rank)})`
                    : 'Pracownik SC (czas nieokreślony)';
            const firstName = u.imie_nazwisko.split(' ')[0];
            return `
                <div class="card login-card" data-login-user-id="${u.id}">
                    <div>
                        <span class="badge badge-primary" style="margin-bottom:8px;">${escapeHtml(u.rola)}</span>
                        <span class="badge" style="margin-bottom:8px;">Arkusz ${escapeHtml(u.arkusz || '—')}</span>
                        <h3>${escapeHtml(u.imie_nazwisko)}</h3>
                        <p class="text-muted">${escapeHtml(u.nazwa_stanowiska)}</p>
                        <p class="text-muted" style="margin-top:6px; font-size:12px;">${rankInfo}</p>
                    </div>
                    <div style="margin-top:14px;">
                        <button type="button" class="btn btn-primary btn-sm" style="width:100%;">
                            Wejdź jako ${escapeHtml(firstName)}
                        </button>
                    </div>
                </div>
            `;
        })
        .join('');

    grid.querySelectorAll('[data-login-user-id]').forEach((card) => {
        card.addEventListener('click', () => {
            onSwitchUser(Number(card.dataset.loginUserId));
        });
    });
}
