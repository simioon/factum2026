import { state } from './state.js';

// Zmień tutaj, aby przełączyć format dat w całej aplikacji:
// np. 'DD.MM.YYYY' | 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'YYYY-MM-DD' | 'LONG_PL'
export const DATE_FORMAT = 'DD.MM.YYYY';

export function formatDate(value, format = DATE_FORMAT) {
    if (!value) return '—';
    const str = String(value).trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!match) return str;
    const [, y, m, d] = match;

    if (format === 'LONG_PL') {
        const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
        return new Intl.DateTimeFormat('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(dt);
    }

    return format.replace('YYYY', y).replace('MM', m).replace('DD', d);
}

export function formatDatesInText(text, format = DATE_FORMAT) {
    if (!text) return '';
    return String(text).replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => formatDate(m, format));
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function toRomanRank(num) {
    const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    return romans[Number(num)] || String(num || '');
}

export function formatDateTime(ts, format = DATE_FORMAT) {
    if (!ts) return '—';
    const str = String(ts).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return formatDate(str, format);

    const localMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(str);
    if (localMatch && !str.endsWith('Z')) {
        return `${formatDate(localMatch[1], format)} ${localMatch[2]}`;
    }

    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return str;
    return `${formatDate(d.toISOString().slice(0, 10), format)} ${d.toTimeString().slice(0, 5)}`;
}

export function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 3600);
}

export function getUserById(id) {
    const numId = Number(id);
    return state.users.find((u) => u.id === numId) || null;
}

export function getCriterionById(id) {
    if (!state.dictionaries) return null;
    const numId = Number(id);
    return state.dictionaries.criteria.find((c) => c.id === numId) || null;
}

export function getTagById(id) {
    if (!state.dictionaries) return null;
    const numId = Number(id);
    return state.dictionaries.tags.find((t) => t.id === numId) || null;
}

export function calculateFinalResultClient(scoresObj) {
    const keys = Object.keys(scoresObj || {});
    if (keys.length === 0) {
        return { average: 0, level: 'Brak danych', result: 'NEGATYWNA', hasOnePoint: false };
    }

    let sum = 0;
    let hasOnePoint = false;
    for (const k of keys) {
        const val = Number(scoresObj[k]);
        sum += val;
        if (val === 1) hasOnePoint = true;
    }

    const avg = Number((sum / keys.length).toFixed(2));
    let level = '';
    if (avg <= 2) level = 'Znacznie poniżej oczekiwań';
    else if (avg <= 4) level = 'Poniżej oczekiwań';
    else if (avg <= 6) level = 'Na poziomie oczekiwań';
    else if (avg <= 8) level = 'Powyżej oczekiwań';
    else level = 'Znacznie powyżej oczekiwań';

    const result = avg > 4 && !hasOnePoint ? 'POZYTYWNA' : 'NEGATYWNA';
    return { average: avg, level, result, hasOnePoint };
}

export function getAllEvidenceBlocks(tasks = []) {
    const blocks = [];
    for (const task of tasks) {
        for (const tg of task.tags || []) {
            const sign = tg.polaryzacja === '+' ? '+' : '-';
            const commentText = tg.komentarz || 'obserwacja bez dodatkowego komentarza';
            const formattedDate = formatDate(task.data_zdarzenia);
            const formattedLine = `• ${formattedDate} – ${task.tytul} (${sign}${tg.tag_nazwa}): ${commentText}`;
            blocks.push({
                key: `${task.id}_${tg.id}`,
                taskId: task.id,
                date: formattedDate,
                taskTitle: task.tytul,
                tagName: tg.tag_nazwa,
                polarity: tg.polaryzacja,
                isWellbeing: tg.kategoria === 'DOBROSTAN',
                comment: tg.komentarz,
                formattedLine,
            });
        }
    }
    return blocks;
}

export function buildSmartIprzPills(criteriaList, scores, tagSummariesByCriterion) {
    const suggestionsMap = (state.dictionaries && state.dictionaries.iprzSuggestions) || {};
    const pills = [];

    for (const item of criteriaList) {
        const cid = item.kryterium_id;
        const sc = Number(scores[cid] || 5);
        const sum = (tagSummariesByCriterion && tagSummariesByCriterion[cid]) || { negCount: 0 };
        if (sc <= 5 || sum.negCount > 0) {
            const txt = suggestionsMap[cid] || suggestionsMap[String(cid)];
            if (txt && !pills.includes(txt)) pills.push(txt);
        }
    }

    if (pills.length === 0) {
        pills.push('Pełnienie roli mentora dla nowo zatrudnionych pracowników w wydziale.');
        pills.push('Udział w zespołach projektowych międzywydziałowych i wymianie dobrych praktyk.');
        pills.push('Szkolenie rozwijające kompetencje liderskie i zarządzanie projektami.');
    } else {
        pills.push('Regularny mentoring przełożonego oraz bieżący feedback co 2 tygodnie.');
    }

    return pills;
}

export function renderAlertsHtml(alerts = []) {
    if (!alerts || alerts.length === 0) return '';
    return alerts
        .map((al) => {
            const cls =
                al.type === 'wellbeing'
                    ? 'alert-wellbeing'
                    : al.type === 'positive'
                      ? 'alert-positive'
                      : al.type === 'warning'
                        ? 'alert-warning'
                        : 'alert-info';
            return `<div class="alert-box ${cls}" style="margin-top:8px; padding:8px 10px;">
                <strong>${escapeHtml(al.title)}:</strong> ${escapeHtml(formatDatesInText(al.message))}
            </div>`;
        })
        .join('');
}

export function buildPreviousEvaluationSummary(pastEvaluations = [], { maxCriteriaItems = 3 } = {}) {
    const lastCompleted = (pastEvaluations || []).find((e) => e && e.status === 'ZAKONCZONA') || null;
    if (!lastCompleted) {
        return {
            hasHistory: false,
            emptyMessage: 'Pierwsza ocena w systemie — brak wcześniejszej historii.',
        };
    }

    const scoredCriteria = (lastCompleted.criteria || []).filter(
        (c) => c && c.punkty !== null && c.punkty !== undefined && !Number.isNaN(Number(c.punkty))
    );
    const lowCriteria = scoredCriteria
        .filter((c) => Number(c.punkty) <= 3)
        .sort((a, b) => Number(a.punkty) - Number(b.punkty));

    let focusMode = 'none';
    let focusLabel = '';
    let focusItems = [];
    let overflowCount = 0;

    if (lowCriteria.length > 0) {
        focusMode = 'below_expectations';
        focusLabel = 'Obszary poniżej oczekiwań';
        focusItems = lowCriteria.map((c) => ({ nazwa: c.nazwa, punkty: Number(c.punkty) }));
    } else {
        const additionalCriteria = scoredCriteria.filter((c) => c.typ_kryterium === 'DODATKOWE');
        if (additionalCriteria.length > 0) {
            focusMode = 'previous_additional';
            focusLabel = 'Poprzednie kryteria dodatkowe';
            focusItems = additionalCriteria.map((c) => ({ nazwa: c.nazwa, punkty: Number(c.punkty) }));
        } else if (scoredCriteria.length > 0) {
            focusMode = 'lowest_criteria';
            const minScore = Math.min(...scoredCriteria.map((c) => Number(c.punkty)));
            const lowest = scoredCriteria.filter((c) => Number(c.punkty) === minScore);
            focusLabel = lowest.length === 1 ? 'Najniżej ocenione kryterium' : 'Najniżej ocenione kryteria';
            focusItems = lowest.slice(0, maxCriteriaItems).map((c) => ({ nazwa: c.nazwa, punkty: Number(c.punkty) }));
            overflowCount = Math.max(0, lowest.length - focusItems.length);
        }
    }

    const rawDate = lastCompleted.data_zapoznania_z_ocena || lastCompleted.data_rozmowy_oceniajacej || null;
    const avgVal =
        lastCompleted.srednia_punktow !== null && lastCompleted.srednia_punktow !== undefined
            ? Number(lastCompleted.srednia_punktow)
            : null;
    const averageText = avgVal !== null && !Number.isNaN(avgVal) ? Number(avgVal.toFixed(2)).toString() : '—';

    return {
        hasHistory: true,
        evaluationId: lastCompleted.id,
        result: lastCompleted.wynik_ogolny || '—',
        averageText,
        dateText: formatDate(rawDate),
        focusMode,
        focusLabel,
        focusItems,
        overflowCount,
        iprz: String(lastCompleted.wnioski_iprz || '').trim() || null,
    };
}

export function renderPreviousEvaluationCheatSheetHtml(pastEvaluations = []) {
    const summary = buildPreviousEvaluationSummary(pastEvaluations);
    if (!summary.hasHistory) {
        return `
            <div class="prev-eval-cheatsheet is-empty">
                <span class="text-muted">${escapeHtml(summary.emptyMessage)}</span>
            </div>
        `;
    }

    const isNeg = summary.result === 'NEGATYWNA';
    const itemsText = summary.focusItems
        .map((item) => `${escapeHtml(item.nazwa)} (${item.punkty} pkt)`)
        .join(', ');
    const overflowHtml =
        summary.overflowCount > 0 ? ` <span class="text-muted">(+${summary.overflowCount})</span>` : '';
    const focusLineHtml =
        summary.focusLabel && summary.focusItems.length > 0
            ? `<div><strong>${escapeHtml(summary.focusLabel)}:</strong> ${itemsText}${overflowHtml}</div>`
            : '';

    const iprzHtml = summary.iprz
        ? `<span style="white-space:pre-line;">${escapeHtml(summary.iprz)}</span>`
        : '<span class="text-muted">Brak zapisanych wniosków.</span>';

    return `
        <div class="prev-eval-cheatsheet ${isNeg ? 'is-negative' : 'is-positive'}">
            <div class="prev-eval-title">Podsumowanie poprzedniej oceny (ściągawka przed rozmową)</div>
            <div class="prev-eval-lines">
                <div>
                    <strong>Ostatni wynik:</strong>
                    <span class="badge ${isNeg ? 'badge-negative' : 'badge-positive'}">${escapeHtml(summary.result)} (${escapeHtml(summary.averageText)} pkt)</span>
                    <span class="text-muted">&mdash; ${escapeHtml(summary.dateText)}</span>
                </div>
                ${focusLineHtml}
                <div><strong>Poprzednie wnioski do IPRZ:</strong> ${iprzHtml}</div>
            </div>
        </div>
    `;
}
