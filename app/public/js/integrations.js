import { escapeHtml, showToast } from './utils.js';

const STORAGE_KEY = 'caoo_integrations_log_v1';

const DEFAULT_LOGS = [
    {
        id: 'seed-1',
        timestamp: '2026-11-15 14:20',
        channel: 'EZD',
        recipient: 'Akta osobowe (część B) — EZD RP',
        subject: 'Przekazanie podpisanego arkusza oceny (Arkusz C — Tomasz Mazurek)',
        refNumber: 'BDG.2120.11.2026',
        status: 'Zarejestrowano w EZD',
        details: 'Klasa JRWA: 2120 (Oceny okresowe). Obustronny e-podpis zweryfikowany.',
    },
    {
        id: 'seed-2',
        timestamp: '2026-11-16 08:05',
        channel: 'EMAIL',
        recipient: 'jan.kowalski@urzad.gov.pl',
        subject: 'Przypomnienie: termin rozmowy wstępnej (7 dni — po ocenie negatywnej)',
        refNumber: 'SMTP-2026-0112',
        status: 'Wysłano (symulacja SMTP)',
        details: 'Dotyczy nowego cyklu oceny dla: Tomasz Mazurek.',
    },
];

let currentFilter = 'ALL';

function formatNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeXml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escapeIcsText(str) {
    return String(str ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

function triggerFileDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getIntegrationLogs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LOGS));
            return [...DEFAULT_LOGS];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [...DEFAULT_LOGS];
    } catch {
        return [...DEFAULT_LOGS];
    }
}

function saveIntegrationLogs(logs) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
        // ignore storage quota errors
    }
    updateIntegrationBadge();
}

export function resetIntegrationLogs() {
    saveIntegrationLogs([...DEFAULT_LOGS]);
    renderIntegrationsModalList();
}

export function generateEzdCaseNumber(evalId) {
    const num = String(evalId || Math.floor(Math.random() * 90 + 10)).padStart(2, '0');
    return `BDG.2120.${num}.${new Date().getFullYear()}`;
}

export function addIntegrationLog({
    channel = 'EMAIL',
    recipient = '—',
    subject = '—',
    refNumber = '',
    status = '',
    details = '',
}) {
    const logs = getIntegrationLogs();
    const entry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: formatNow(),
        channel,
        recipient,
        subject,
        refNumber:
            refNumber ||
            (channel === 'EZD'
                ? generateEzdCaseNumber(logs.length + 12)
                : `SMTP-${new Date().getFullYear()}-${String(logs.length + 115).padStart(4, '0')}`),
        status: status || (channel === 'EZD' ? 'Przekazano do EZD' : 'Wysłano (symulacja SMTP)'),
        details,
    };
    logs.unshift(entry);
    saveIntegrationLogs(logs);
    renderIntegrationsModalList();
    return entry;
}

export function updateIntegrationBadge() {
    const badge = document.getElementById('integrations-count');
    if (badge) {
        badge.textContent = String(getIntegrationLogs().length);
    }
}

export function openMailto({ to, subject, body, details = '' }) {
    const safeTo = to || 'pracownik@urzad.gov.pl';
    const mailtoUrl = `mailto:${encodeURIComponent(safeTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    addIntegrationLog({
        channel: 'EMAIL',
        recipient: safeTo,
        subject,
        status: 'Otwarto w programie pocztowym (mailto)',
        details: details || 'Wygenerowano gotowy szkic wiadomości e-mail.',
    });

    window.location.href = mailtoUrl;
}

export function downloadCalendarInvite({
    title,
    date,
    description = '',
    attendeeEmail = '',
    attendeeName = '',
    organizerEmail = '',
    organizerName = '',
    filename = 'rozmowa-oceniajaca.ics',
}) {
    const dateStr = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const uid = `caoo-${Date.now()}@urzad.gov.pl`;
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Cyfrowy Asystent Ocen Okresowych//Sluzba Cywilna//PL',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${dateStr}T100000`,
        `DTEND:${dateStr}T110000`,
        `SUMMARY:${escapeIcsText(title)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
    ];

    if (organizerEmail) {
        lines.push(`ORGANIZER;CN=${escapeIcsText(organizerName || organizerEmail)}:mailto:${organizerEmail}`);
    }
    if (attendeeEmail) {
        lines.push(`ATTENDEE;CN=${escapeIcsText(attendeeName || attendeeEmail)};RSVP=TRUE:mailto:${attendeeEmail}`);
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');

    triggerFileDownload(lines.join('\r\n'), filename, 'text/calendar;charset=utf-8');

    addIntegrationLog({
        channel: 'EMAIL',
        recipient: attendeeEmail || attendeeName || 'Uczestnik spotkania',
        subject: `Zaproszenie (.ics): ${title}`,
        status: 'Wygenerowano zaproszenie do kalendarza',
        details: `Data spotkania: ${date || 'do ustalenia'}. Plik gotowy do importu w Outlook / Thunderbird / Gmail.`,
    });

    showToast('Pobrano zaproszenie do kalendarza (.ics) i zapisano wpis w dzienniku integracji.', 'success');
}

export function exportEzdPackage({ employee, evaluator, evaluation }) {
    const caseNumber = generateEzdCaseNumber(evaluation?.id);
    const criteriaXml = (evaluation?.criteria || [])
        .map(
            (c) => `      <Kryterium typ="${escapeXml(c.typ_kryterium)}">
        <Nazwa>${escapeXml(c.nazwa)}</Nazwa>
        <Punkty>${escapeXml(c.punkty ?? 'brak')}</Punkty>
      </Kryterium>`
        )
        .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PaczkaEZD wersja="1.0" standard="EZD-RP-Metadane">
  <MetadaneSprawy>
    <ZnakSprawy>${escapeXml(caseNumber)}</ZnakSprawy>
    <SymbolJRWA>2120</SymbolJRWA>
    <HasloKlasyfikacyjne>Oceny okresowe członków korpusu służby cywilnej</HasloKlasyfikacyjne>
    <DataEksportu>${new Date().toISOString()}</DataEksportu>
    <Przeznaczenie>Akta osobowe pracownika — część B</Przeznaczenie>
  </MetadaneSprawy>
  <Dokument>
    <TypArkusza>${escapeXml(evaluation?.typ_arkusza || employee?.arkusz || '—')}</TypArkusza>
    <NumerPodejscia>${escapeXml(evaluation?.numer_podejscia || 1)}</NumerPodejscia>
    <Status>${escapeXml(evaluation?.status || '—')}</Status>
    <Oceniany>
      <ImieNazwisko>${escapeXml(employee?.imie_nazwisko || '—')}</ImieNazwisko>
      <Email>${escapeXml(employee?.email || '—')}</Email>
      <Stanowisko>${escapeXml(employee?.nazwa_stanowiska || '—')}</Stanowisko>
      <Komorka>${escapeXml(employee?.komorka_organizacyjna || '—')}</Komorka>
    </Oceniany>
    <Oceniajacy>
      <ImieNazwisko>${escapeXml(evaluator?.imie_nazwisko || '—')}</ImieNazwisko>
      <Email>${escapeXml(evaluator?.email || '—')}</Email>
    </Oceniajacy>
    <Wynik>
      <OcenaOgolna>${escapeXml(evaluation?.wynik_ogolny || 'W TOKU')}</OcenaOgolna>
      <SredniaPunktow>${escapeXml(evaluation?.srednia_punktow ?? '—')}</SredniaPunktow>
      <Poziom>${escapeXml(evaluation?.poziom_oceny_label || evaluation?.poziom_oceny || '—')}</Poziom>
    </Wynik>
    <Kryteria>
${criteriaXml}
    </Kryteria>
    <Uzasadnienie>${escapeXml(evaluation?.uzasadnienie_oceny || '—')}</Uzasadnienie>
    <WnioskiIPRZ>${escapeXml(evaluation?.wnioski_iprz || '—')}</WnioskiIPRZ>
    <PodpisyElektroniczne>
      <PodpisOceniajacego>${escapeXml(evaluation?.podpis_ocena_oceniajacy_at || 'brak')}</PodpisOceniajacego>
      <PodpisOcenianego>${escapeXml(evaluation?.podpis_ocena_oceniany_at || 'brak')}</PodpisOcenianego>
    </PodpisyElektroniczne>
  </Dokument>
</PaczkaEZD>
`;

    const safeName = (employee?.imie_nazwisko || 'pracownik')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_|_$/g, '');
    const filename = `EZD_${caseNumber.replace(/\./g, '-')}_${safeName}.xml`;

    triggerFileDownload(xml, filename, 'application/xml;charset=utf-8');

    addIntegrationLog({
        channel: 'EZD',
        recipient: 'Akta osobowe (część B) — EZD RP',
        subject: `Eksport paczki EZD: Arkusz ${evaluation?.typ_arkusza || employee?.arkusz || ''} (${employee?.imie_nazwisko || '—'})`,
        refNumber: caseNumber,
        status: 'Wyeksportowano paczkę XML do EZD',
        details: `Plik: ${filename} | Wynik: ${evaluation?.wynik_ogolny || 'roboczy'} | JRWA: 2120.`,
    });

    showToast(`Wygenerowano paczkę metadanych do EZD (${caseNumber}).`, 'success');
    return caseNumber;
}

export function renderIntegrationsModalList() {
    const listContainer = document.getElementById('integrations-log-list');
    if (!listContainer) return;

    const allLogs = getIntegrationLogs();
    const filtered = allLogs.filter((item) => {
        if (currentFilter === 'ALL') return true;
        return item.channel === currentFilter;
    });

    document.querySelectorAll('[data-int-filter]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.intFilter === currentFilter);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-muted" style="padding:12px;">Brak zdarzeń w wybranej kategorii.</p>';
        return;
    }

    const rows = filtered
        .map((log) => {
            const channelBadge =
                log.channel === 'EZD'
                    ? '<span class="badge badge-primary">EZD</span>'
                    : '<span class="badge badge-positive">E-MAIL</span>';
            return `
                <tr>
                    <td style="white-space:nowrap; font-size:12px;">${escapeHtml(log.timestamp)}</td>
                    <td>${channelBadge}</td>
                    <td style="font-size:12px;"><strong>${escapeHtml(log.refNumber)}</strong></td>
                    <td style="font-size:13px;">
                        <div><strong>${escapeHtml(log.subject)}</strong></div>
                        <div class="text-muted" style="font-size:12px;">Odbiorca: ${escapeHtml(log.recipient)}</div>
                        ${log.details ? `<div class="text-muted" style="font-size:12px; margin-top:2px;">${escapeHtml(log.details)}</div>` : ''}
                    </td>
                    <td style="font-size:12px;">${escapeHtml(log.status)}</td>
                </tr>
            `;
        })
        .join('');

    listContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Kanał</th>
                    <th>Znak / ID</th>
                    <th>Zdarzenie i odbiorca</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

export function initIntegrationsModal() {
    updateIntegrationBadge();

    const openBtn = document.getElementById('btn-open-integrations');
    const modal = document.getElementById('integrations-modal');
    const closeBtn = document.getElementById('btn-close-integrations');
    const clearBtn = document.getElementById('btn-reset-integrations');

    if (!openBtn || !modal) return;

    const closeModal = () => {
        modal.style.display = 'none';
    };

    openBtn.addEventListener('click', () => {
        renderIntegrationsModalList();
        modal.style.display = 'flex';
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });

    document.querySelectorAll('[data-int-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.intFilter;
            renderIntegrationsModalList();
        });
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            resetIntegrationLogs();
            showToast('Przywrócono domyślny dziennik integracji E-mail / EZD.', 'success');
        });
    }
}