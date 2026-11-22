import { state } from '../state.js';
import { escapeHtml, formatDate, formatDateTime, getCriterionById, toRomanRank } from '../utils.js';

const SHEET_CONFIG = {
    A: {
        attachmentNo: '2',
        hasDepartment: false,
        evaluatorPositionLabel: 'Stanowisko',
        mandatoryCriteria: [
            'Zarządzanie ludźmi',
            'Podejmowanie decyzji i odpowiedzialność',
            'Organizacja pracy i orientacja na osiąganie celów',
            'Współpraca',
            'Komunikacja',
            'Zarządzanie strategiczne',
        ],
        footnote1:
            'Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku kierownika urzędu, które jest stanowiskiem pracy w służbie cywilnej.',
        pouczenieHtml:
            'Na podstawie art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do .............................................................................................................. .',
        pouczenieFootnote: '',
    },
    B: {
        attachmentNo: '3',
        hasDepartment: true,
        evaluatorPositionLabel: 'Stanowisko pracy',
        mandatoryCriteria: [
            'Zarządzanie ludźmi',
            'Podejmowanie decyzji i odpowiedzialność',
            'Organizacja pracy i orientacja na osiąganie celów',
            'Współpraca',
            'Komunikacja',
        ],
        footnote1:
            'Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku, na którym praca polega na bezpośrednim kierowaniu pracownikami.',
        pouczenieHtml:
            'Zgodnie z art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu<sup>*)</sup>.',
        pouczenieFootnote:
            '<sup>*)</sup> W urzędzie, w którym przepisy nie przewidują tworzenia stanowiska dyrektora generalnego urzędu, sprzeciw składa się do kierownika tego urzędu.',
    },
    C: {
        attachmentNo: '4',
        hasDepartment: true,
        evaluatorPositionLabel: 'Stanowisko pracy',
        mandatoryCriteria: [
            'Wykorzystywanie wiedzy i doskonalenie zawodowe',
            'Rzetelność',
            'Organizacja pracy i orientacja na osiąganie celów',
            'Współpraca',
            'Komunikacja',
        ],
        footnote1:
            'Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku, które nie jest: stanowiskiem kierownika urzędu, będącym stanowiskiem pracy w służbie cywilnej, ani stanowiskiem, na którym praca polega na bezpośrednim kierowaniu pracownikami.',
        pouczenieHtml:
            'Zgodnie z art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu<sup>*)</sup>.',
        pouczenieFootnote:
            '<sup>*)</sup> W urzędzie, w którym przepisy nie przewidują tworzenia stanowiska dyrektora generalnego urzędu, sprzeciw składa się do kierownika tego urzędu.',
    },
};

const LEVEL_ROWS = [
    {
        code: 'ZNACZNIE_PONIZEJ_OCZEKIWAN',
        rangeText: 'od 1 punktu do 2 punktów',
        label: 'znacznie poniżej oczekiwań',
    },
    {
        code: 'PONIZEJ_OCZEKIWAN',
        rangeText: 'powyżej 2 punktów do 4 punktów',
        label: 'poniżej oczekiwań',
    },
    {
        code: 'NA_POZIOMIE_OCZEKIWAN',
        rangeText: 'powyżej 4 punktów do 6 punktów',
        label: 'na poziomie oczekiwań',
    },
    {
        code: 'POWYZEJ_OCZEKIWAN',
        rangeText: 'powyżej 6 punktów do 8 punktów',
        label: 'powyżej oczekiwań',
    },
    {
        code: 'ZNACZNIE_POWYZEJ_OCZEKIWAN',
        rangeText: 'powyżej 8 punktów do 9 punktów',
        label: 'znacznie powyżej oczekiwań',
    },
];

const SCORE_COLUMNS = [1, 3, 5, 7, 9];

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function splitFullName(fullName) {
    const clean = String(fullName || '').trim();
    if (!clean) return { firstName: '', lastName: '' };
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

function formatDatePl(value) {
    if (!value) return '';
    const str = String(value).trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) return str;

    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return formatDate(str);
    }

    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return str;
    return formatDate(parsed.toISOString().slice(0, 10));
}

function formatAveragePl(value) {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toFixed(2).replace('.', ',');
}

function resolveLevelCode(evaluation) {
    if (evaluation.poziom_oceny) return evaluation.poziom_oceny;
    if (evaluation.srednia_punktow === null || evaluation.srednia_punktow === undefined) return null;
    const avg = Number(evaluation.srednia_punktow);
    if (Number.isNaN(avg)) return null;
    if (avg <= 2) return 'ZNACZNIE_PONIZEJ_OCZEKIWAN';
    if (avg <= 4) return 'PONIZEJ_OCZEKIWAN';
    if (avg <= 6) return 'NA_POZIOMIE_OCZEKIWAN';
    if (avg <= 8) return 'POWYZEJ_OCZEKIWAN';
    return 'ZNACZNIE_POWYZEJ_OCZEKIWAN';
}

function getLevelLabel(code, fallbackLabel) {
    const found = LEVEL_ROWS.find((item) => item.code === code);
    if (found) return found.label;
    return fallbackLabel ? String(fallbackLabel).toLowerCase() : '';
}

function formatRankRoman(rankNumber) {
    const num = Number(rankNumber);
    if (!Number.isInteger(num) || num <= 0) return '';
    return toRomanRank(num);
}

function resolvePreviousEvaluation(evaluation, explicitPrevious) {
    if (explicitPrevious) return explicitPrevious;
    if (evaluation.previousEvaluation) return evaluation.previousEvaluation;
    if (evaluation.poprzednia_ocena) return evaluation.poprzednia_ocena;

    const candidateLists = [
        state.workspace && state.workspace.pastEvaluations,
        state.currentWorkspace && state.currentWorkspace.pastEvaluations,
        state.pastEvaluations,
    ];

    for (let i = 0; i < candidateLists.length; i++) {
        const list = candidateLists[i];
        if (!Array.isArray(list) || list.length === 0) continue;

        if (evaluation.poprzednia_ocena_id) {
            const exact = list.find((item) => item.id === evaluation.poprzednia_ocena_id);
            if (exact) return exact;
        }

        const completedEarlier = list.filter(
            (item) =>
                item.id !== evaluation.id &&
                item.pracownik_id === evaluation.pracownik_id &&
                item.status === 'ZAKONCZONA' &&
                (!evaluation.id || item.id < evaluation.id)
        );
        if (completedEarlier.length > 0) {
            return completedEarlier[0];
        }
    }

    return null;
}

function resolveRankRequest(evaluation, explicitRequest) {
    if (explicitRequest) return explicitRequest;
    if (evaluation.rankRequest) return evaluation.rankRequest;
    if (evaluation.rank_request) return evaluation.rank_request;
    if (evaluation.wniosek_stopien) return evaluation.wniosek_stopien;
    if (Array.isArray(evaluation.rankRequests) && evaluation.rankRequests.length > 0) {
        return evaluation.rankRequests[0];
    }
    if (Array.isArray(evaluation.wnioski_stopien) && evaluation.wnioski_stopien.length > 0) {
        return evaluation.wnioski_stopien[0];
    }
    if (Array.isArray(state.rankRequests)) {
        const match = state.rankRequests.find((r) => r.ocena_id === evaluation.id);
        if (match) return match;
    }
    return null;
}

export function buildCriteriaPartitions(evaluation, config, sheetTypeOverride = null) {
    const sheetType = sheetTypeOverride || (evaluation && evaluation.typ_arkusza) || 'C';
    const sheetConfig = config || SHEET_CONFIG[sheetType] || SHEET_CONFIG.C;
    const legalCfg = (state.dictionaries && state.dictionaries.legalConfig) || {};
    const maxAdditional = Number.isInteger(legalCfg.maxAdditionalCriteria) ? legalCfg.maxAdditionalCriteria : 3;
    const sheetDict =
        state.dictionaries && state.dictionaries.sheetCriteria && state.dictionaries.sheetCriteria[sheetType];
    const dictMandatoryIds = sheetDict && Array.isArray(sheetDict.mandatoryIds) ? sheetDict.mandatoryIds : [];

    const rawCriteria = ((evaluation && evaluation.criteria) || []).map((c) => {
        const dictItem = getCriterionById(c.kryterium_id);
        const name = c.nazwa || (dictItem ? dictItem.nazwa : `Kryterium #${c.kryterium_id}`);
        return {
            kryterium_id: c.kryterium_id,
            nazwa: name,
            punkty: c.punkty !== null && c.punkty !== undefined ? Number(c.punkty) : null,
            typ_kryterium: c.typ_kryterium || null,
            used: false,
        };
    });

    const hasExplicitTypes = rawCriteria.some((item) => item.typ_kryterium === 'OBOWIAZKOWE');
    let mandatoryRows = [];

    if (hasExplicitTypes) {
        // Dynamic path: reflects Admin-edited / newly added mandatory criteria immediately
        mandatoryRows = rawCriteria
            .filter((item) => item.typ_kryterium === 'OBOWIAZKOWE')
            .map((item) => {
                item.used = true;
                return { nazwa: item.nazwa, punkty: item.punkty };
            });
    } else if (rawCriteria.length > 0 && dictMandatoryIds.length > 0) {
        const mandSet = new Set(dictMandatoryIds);
        mandatoryRows = rawCriteria
            .filter((item) => mandSet.has(item.kryterium_id))
            .map((item) => {
                item.used = true;
                return { nazwa: item.nazwa, punkty: item.punkty };
            });
    } else if (rawCriteria.length === 0 && dictMandatoryIds.length > 0) {
        mandatoryRows = dictMandatoryIds.map((id) => {
            const dictItem = getCriterionById(id);
            return { nazwa: dictItem ? dictItem.nazwa : `Kryterium #${id}`, punkty: null };
        });
    } else {
        // Fallback for standalone objects without typ_kryterium or dictionaries
        mandatoryRows = sheetConfig.mandatoryCriteria.map((officialName) => {
            const targetNorm = normalizeText(officialName);
            const match = rawCriteria.find((item) => !item.used && normalizeText(item.nazwa) === targetNorm);
            if (match) {
                match.used = true;
                return { nazwa: match.nazwa, punkty: match.punkty };
            }
            return { nazwa: officialName, punkty: null };
        });
    }

    const extraFound = rawCriteria.filter((item) => !item.used);
    const slotCount = Math.max(maxAdditional, extraFound.length);
    const additionalRows = [];
    for (let i = 0; i < slotCount; i++) {
        if (extraFound[i]) {
            additionalRows.push({ nazwa: extraFound[i].nazwa, punkty: extraFound[i].punkty });
        } else {
            additionalRows.push({ nazwa: '', punkty: null });
        }
    }

    return { mandatoryRows, additionalRows };
}

function renderScoreCells(points) {
    return SCORE_COLUMNS.map((scoreVal) => {
        const mark = points === scoreVal ? 'X' : '';
        return `<td class="gov-center gov-x-cell">${mark}</td>`;
    }).join('');
}

function renderSignatureBox(timestamp, signerName) {
    if (!timestamp) {
        return '<div class="gov-sign-empty">&nbsp;</div>';
    }
    return `
        <div class="gov-sign-digital">
            <strong>${escapeHtml(signerName || 'Podpisano elektronicznie')}</strong>
            <span>e-podpis: ${escapeHtml(formatDateTime(timestamp))}</span>
        </div>
    `;
}

function buildPrintStyles() {
    return `
        <style>
            @page {
                size: A4 portrait;
                margin: 10mm 12mm;
            }
            @media print {
                #print-sheet-area {
                    display: block !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }
            }
            #print-sheet-area .gov-sheet {
                font-family: 'Times New Roman', Times, Georgia, serif;
                font-size: 9.5pt;
                line-height: 1.25;
                color: #000000;
                background: #ffffff;
            }
            #print-sheet-area .gov-page {
                page-break-after: always;
                break-after: page;
                padding: 0;
                margin: 0;
                box-sizing: border-box;
            }
            #print-sheet-area .gov-page:last-child {
                page-break-after: auto;
                break-after: auto;
            }
            #print-sheet-area .gov-top-meta {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                font-size: 8.5pt;
                margin-bottom: 4px;
            }
            #print-sheet-area .gov-title-block {
                text-align: center;
                margin-bottom: 8px;
            }
            #print-sheet-area .gov-sheet-letter {
                font-size: 13pt;
                font-weight: bold;
                letter-spacing: 0.5px;
            }
            #print-sheet-area .gov-wzor {
                font-size: 9pt;
                font-style: italic;
                margin: 2px 0;
            }
            #print-sheet-area .gov-main-title {
                font-size: 11.5pt;
                font-weight: bold;
                text-transform: uppercase;
                margin: 2px 0;
            }
            #print-sheet-area .gov-part-heading {
                text-align: center;
                font-size: 11pt;
                font-weight: bold;
                margin: 6px 0 6px 0;
                letter-spacing: 0.5px;
            }
            #print-sheet-area .gov-section-bar {
                font-size: 9pt;
                font-weight: bold;
                text-transform: uppercase;
                background: #efefef !important;
                border: 1px solid #000000;
                border-bottom: none;
                padding: 3px 6px;
                margin-top: 7px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            #print-sheet-area table.gov-table {
                width: 100%;
                border-collapse: collapse;
                margin: 0 0 6px 0;
                table-layout: fixed;
            }
            #print-sheet-area table.gov-table th,
            #print-sheet-area table.gov-table td {
                border: 1px solid #000000;
                padding: 3px 5px;
                vertical-align: middle;
                background: #ffffff;
                color: #000000;
                font-size: 9pt;
                word-wrap: break-word;
            }
            #print-sheet-area table.gov-table th {
                background: #f3f3f3 !important;
                font-weight: bold;
                text-align: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            #print-sheet-area .gov-label {
                display: block;
                font-size: 7.5pt;
                color: #222222;
                margin-bottom: 2px;
            }
            #print-sheet-area .gov-value {
                display: block;
                font-size: 9.5pt;
                min-height: 14px;
                font-weight: normal;
            }
            #print-sheet-area .gov-center {
                text-align: center;
            }
            #print-sheet-area .gov-x-cell {
                font-size: 11pt;
                font-weight: bold;
            }
            #print-sheet-area .gov-confirm-box {
                border: 1px solid #000000;
                padding: 6px 8px;
                margin-top: 8px;
                font-size: 8.8pt;
            }
            #print-sheet-area .gov-confirm-box ul {
                margin: 3px 0 6px 18px;
                padding: 0;
            }
            #print-sheet-area .gov-confirm-box li {
                margin-bottom: 2px;
            }
            #print-sheet-area .gov-sign-grid {
                width: 100%;
                border-collapse: collapse;
                margin-top: 6px;
            }
            #print-sheet-area .gov-sign-grid td {
                border: none !important;
                padding: 2px 6px 0 6px;
                vertical-align: bottom;
                text-align: center;
            }
            #print-sheet-area .gov-sign-line {
                border-bottom: 1px dotted #000000;
                min-height: 22px;
                padding-bottom: 2px;
                font-size: 8.5pt;
            }
            #print-sheet-area .gov-sign-caption {
                font-size: 7.5pt;
                padding-top: 2px;
            }
            #print-sheet-area .gov-sign-digital strong {
                display: block;
                font-size: 8.2pt;
            }
            #print-sheet-area .gov-sign-digital span {
                display: block;
                font-size: 7pt;
            }
            #print-sheet-area .gov-text-box {
                border: 1px solid #000000;
                padding: 6px 8px;
                min-height: 76px;
                white-space: pre-line;
                font-size: 9pt;
                margin-bottom: 6px;
            }
            #print-sheet-area .gov-text-box-lg {
                min-height: 115px;
            }
            #print-sheet-area .gov-checkbox {
                display: inline-block;
                width: 14px;
                height: 14px;
                line-height: 13px;
                text-align: center;
                border: 1px solid #000000;
                font-weight: bold;
                font-size: 10pt;
                margin-right: 4px;
                vertical-align: middle;
            }
            #print-sheet-area .gov-check-row {
                display: flex;
                gap: 18px;
                flex-wrap: wrap;
                align-items: center;
                padding: 5px 6px;
                border: 1px solid #000000;
                margin-bottom: 6px;
                font-size: 9pt;
            }
            #print-sheet-area .gov-pouczenie {
                border: 1px solid #000000;
                padding: 6px 8px;
                margin-top: 6px;
                font-size: 8.5pt;
            }
            #print-sheet-area .gov-pouczenie-title {
                text-align: center;
                font-weight: bold;
                margin-bottom: 3px;
            }
            #print-sheet-area .gov-footnotes {
                margin-top: 8px;
                padding-top: 4px;
                border-top: 1px solid #000000;
                font-size: 7.3pt;
                line-height: 1.2;
            }
            #print-sheet-area .gov-footnotes p {
                margin: 2px 0;
            }
            #print-sheet-area .gov-avg-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border: 1px solid #000000;
                padding: 4px 8px;
                margin: 5px 0 6px 0;
                font-size: 9.2pt;
            }
            #print-sheet-area .gov-avg-value {
                font-weight: bold;
                font-size: 10.5pt;
                min-width: 70px;
                text-align: center;
                border-left: 1px solid #000000;
                padding-left: 10px;
            }
            #print-sheet-area .gov-part3-note {
                text-align: center;
                font-size: 8.5pt;
                font-style: italic;
                margin-bottom: 8px;
            }
            #print-sheet-area .gov-inline-fill {
                display: inline-block;
                border-bottom: 1px dotted #000000;
                padding: 0 8px;
                min-width: 110px;
                text-align: center;
                font-weight: bold;
            }
        </style>
    `;
}

export function printEvaluationSheet({
    employee = null,
    evaluator = null,
    evaluation,
    previousEvaluation = null,
    rankRequest = null,
    officeName = 'Urząd Służby Cywilnej',
    city = 'Warszawa',
}) {
    const area = document.getElementById('print-sheet-area');
    if (!area || !evaluation) return;

    const allUsers = Array.isArray(state.users) ? state.users : [];
    const resolvedEmployee =
        employee || allUsers.find((u) => u.id === evaluation.pracownik_id) || null;
    const resolvedEvaluator =
        evaluator || allUsers.find((u) => u.id === evaluation.oceniajacy_id) || null;

    const rawSheetType = String(
        evaluation.typ_arkusza || (resolvedEmployee && resolvedEmployee.arkusz) || 'C'
    ).toUpperCase();
    const sheetType = SHEET_CONFIG[rawSheetType] ? rawSheetType : 'C';
    const config = SHEET_CONFIG[sheetType];

    const empFullName =
        (resolvedEmployee && resolvedEmployee.imie_nazwisko) || evaluation.pracownik_nazwa || '';
    const empNameParts = splitFullName(empFullName);
    const empPosition =
        (resolvedEmployee && resolvedEmployee.nazwa_stanowiska) || evaluation.pracownik_stanowisko || '';
    const empDepartment =
        (resolvedEmployee && resolvedEmployee.komorka_organizacyjna) || evaluation.pracownik_komorka || '';

    const evalFullName =
        (resolvedEvaluator && resolvedEvaluator.imie_nazwisko) || evaluation.oceniajacy_nazwa || '';
    const evalNameParts = splitFullName(evalFullName);
    const evalPosition =
        (resolvedEvaluator && resolvedEvaluator.nazwa_stanowiska) || evaluation.oceniajacy_stanowisko || '';
    const evalDepartment =
        (resolvedEvaluator && resolvedEvaluator.komorka_organizacyjna) || evaluation.oceniajacy_komorka || '';

    const { mandatoryRows, additionalRows } = buildCriteriaPartitions(evaluation, config, sheetType);
    const appealDaysLimit =
        (state.dictionaries && state.dictionaries.legalConfig && state.dictionaries.legalConfig.appealDaysLimit) || 7;
    const dynamicPouczenieHtml = config.pouczenieHtml.replace(
        /w terminie \d+ dni/i,
        `w terminie ${appealDaysLimit} dni`
    );

    const plannedDateText = formatDatePl(evaluation.planowana_data_oceny);
    const part1EvalSignDate = formatDatePl(
        evaluation.podpis_kryteria_oceniajacy_at || evaluation.data_rozmowy_wstepnej
    );
    const part1EmpSignDate = formatDatePl(evaluation.podpis_kryteria_oceniany_at);

    const reviewInterviewDate = formatDatePl(evaluation.data_rozmowy_oceniajacej);
    const periodFromDate = formatDatePl(
        evaluation.podpis_kryteria_oceniany_at ||
            evaluation.data_rozmowy_wstepnej ||
            evaluation.data_rozpoczecia_cyklu
    );
    const periodToDate = formatDatePl(
        evaluation.podpis_ocena_oceniajacy_at ||
            evaluation.data_zapoznania_z_ocena ||
            evaluation.data_rozmowy_oceniajacej
    );

    const avgText = formatAveragePl(evaluation.srednia_punktow);
    const levelCode = resolveLevelCode(evaluation);
    const isPositive = evaluation.wynik_ogolny === 'POZYTYWNA';
    const isNegative = evaluation.wynik_ogolny === 'NEGATYWNA';

    const resolvedPrevEval = resolvePreviousEvaluation(evaluation, previousEvaluation);
    const resolvedRankRequest = resolveRankRequest(evaluation, rankRequest);

    const currentRank = resolvedEmployee
        ? Number(resolvedEmployee.aktualny_stopien_sluzbowy ?? resolvedEmployee.rank ?? 0)
        : 0;
    const isCivilServant = Boolean(
        (resolvedEmployee && resolvedEmployee.employmentType === 'MIANOWANIE') || currentRank > 0
    );

    const hasRankRequest = Boolean(isCivilServant && resolvedRankRequest);
    const prevEvalResult =
        isCivilServant && resolvedPrevEval && resolvedPrevEval.wynik_ogolny
            ? String(resolvedPrevEval.wynik_ogolny).toLowerCase()
            : '';
    const prevEvalLevel =
        isCivilServant && resolvedPrevEval
            ? getLevelLabel(
                  resolveLevelCode(resolvedPrevEval),
                  resolvedPrevEval.poziom_oceny_label || resolvedPrevEval.poziom_oceny
              )
            : '';
    const prevEvalDate =
        isCivilServant && resolvedPrevEval
            ? formatDatePl(
                  resolvedPrevEval.data_zapoznania_z_ocena ||
                      resolvedPrevEval.podpis_ocena_oceniajacy_at ||
                      resolvedPrevEval.data_rozmowy_oceniajacej
              )
            : '';

    const part2EvalSignDate = formatDatePl(
        evaluation.podpis_ocena_oceniajacy_at || evaluation.data_rozmowy_oceniajacej
    );
    const part2EmpSignDate = formatDatePl(
        evaluation.podpis_ocena_oceniany_at || evaluation.data_zapoznania_z_ocena
    );

    const departmentRowEmployee = config.hasDepartment
        ? `<tr><td colspan="2"><span class="gov-label">Komórka organizacyjna</span><span class="gov-value">${escapeHtml(empDepartment)}</span></td></tr>`
        : '';

    const departmentRowEvaluator = config.hasDepartment
        ? `<tr><td colspan="2"><span class="gov-label">Komórka organizacyjna</span><span class="gov-value">${escapeHtml(evalDepartment)}</span></td></tr>`
        : '';

    const mandatoryPart1Html = mandatoryRows
        .map((row) => `<tr><td>${escapeHtml(row.nazwa)}</td></tr>`)
        .join('');

    const additionalPart1Html = additionalRows
        .map((row) => `<tr><td style="height:18px;">${escapeHtml(row.nazwa || '')}</td></tr>`)
        .join('');

    const mandatoryPart2Html = mandatoryRows
        .map(
            (row) => `
                <tr>
                    <td>${escapeHtml(row.nazwa)}</td>
                    ${renderScoreCells(row.punkty)}
                </tr>
            `
        )
        .join('');

    const additionalPart2Html = additionalRows
        .map(
            (row) => `
                <tr>
                    <td style="height:20px;">${escapeHtml(row.nazwa || '')}</td>
                    ${renderScoreCells(row.punkty)}
                </tr>
            `
        )
        .join('');

    const levelTableRowsHtml = LEVEL_ROWS.map((item) => {
        const mark = levelCode === item.code ? 'X' : '';
        return `
            <tr>
                <td class="gov-center gov-x-cell" style="width:14%;">${mark}</td>
                <td style="width:46%;">${item.rangeText}</td>
                <td style="width:40%;">${item.label}</td>
            </tr>
        `;
    }).join('');

    // STRONA 1 — CZĘŚĆ I
    const page1Html = `
        <section class="gov-page">
            <div class="gov-top-meta">
                <span>Dz. U. z 2016 r. poz. 470</span>
                <span><strong>Załącznik nr ${config.attachmentNo}</strong></span>
            </div>

            <div class="gov-title-block">
                <div class="gov-sheet-letter">ARKUSZ ${sheetType}</div>
                <div class="gov-wzor">WZÓR</div>
                <div class="gov-main-title">OCENA OKRESOWA</div>
                <div class="gov-main-title">URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ<sup>1)</sup></div>
            </div>

            <div class="gov-part-heading">CZĘŚĆ I</div>

            <table class="gov-table">
                <tbody>
                    <tr>
                        <td>
                            <span class="gov-label">NAZWA URZĘDU</span>
                            <span class="gov-value">${escapeHtml(officeName)}</span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-section-bar">DANE OCENIANEGO</div>
            <table class="gov-table">
                <tbody>
                    <tr>
                        <td style="width:50%;">
                            <span class="gov-label">Imię</span>
                            <span class="gov-value">${escapeHtml(empNameParts.firstName)}</span>
                        </td>
                        <td style="width:50%;">
                            <span class="gov-label">Nazwisko</span>
                            <span class="gov-value">${escapeHtml(empNameParts.lastName)}</span>
                        </td>
                    </tr>
                    ${departmentRowEmployee}
                    <tr>
                        <td colspan="2">
                            <span class="gov-label">Stanowisko pracy${config.hasDepartment ? '<sup>2)</sup>' : ''}</span>
                            <span class="gov-value">${escapeHtml(empPosition)}</span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-section-bar">DANE OCENIAJĄCEGO</div>
            <table class="gov-table">
                <tbody>
                    <tr>
                        <td style="width:50%;">
                            <span class="gov-label">Imię</span>
                            <span class="gov-value">${escapeHtml(evalNameParts.firstName)}</span>
                        </td>
                        <td style="width:50%;">
                            <span class="gov-label">Nazwisko</span>
                            <span class="gov-value">${escapeHtml(evalNameParts.lastName)}</span>
                        </td>
                    </tr>
                    ${departmentRowEvaluator}
                    <tr>
                        <td colspan="2">
                            <span class="gov-label">${config.evaluatorPositionLabel}</span>
                            <span class="gov-value">${escapeHtml(evalPosition)}</span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-section-bar">KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY</div>
            <table class="gov-table">
                <tbody>
                    <tr>
                        <th rowspan="${mandatoryRows.length}" style="width:32%; text-align:left;">Kryteria obowiązkowe</th>
                        <td>${escapeHtml(mandatoryRows[0].nazwa)}</td>
                    </tr>
                    ${mandatoryRows
                        .slice(1)
                        .map((row) => `<tr><td>${escapeHtml(row.nazwa)}</td></tr>`)
                        .join('')}
                    <tr>
                        <th rowspan="3" style="width:32%; text-align:left;">Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3)<sup>${config.hasDepartment ? '3' : '2'})</sup></th>
                        <td style="height:18px;">${escapeHtml(additionalRows[0].nazwa || '')}</td>
                    </tr>
                    <tr><td style="height:18px;">${escapeHtml(additionalRows[1].nazwa || '')}</td></tr>
                    <tr><td style="height:18px;">${escapeHtml(additionalRows[2].nazwa || '')}</td></tr>
                    <tr>
                        <th style="width:32%; text-align:left;">Termin sporządzenia oceny (dd.mm.rrrr)</th>
                        <td><strong>${escapeHtml(plannedDateText)}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-confirm-box">
                <strong>Potwierdzamy:</strong>
                <ul>
                    <li>przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej (Dz. U. poz. 470), i omówienie w trakcie tej rozmowy wszystkich wymaganych zagadnień<sup>${config.hasDepartment ? '4' : '3'})</sup>,</li>
                    <li>zapoznanie ocenianego z kryteriami oceny oraz terminem sporządzenia oceny.</li>
                </ul>

                <table class="gov-sign-grid">
                    <tbody>
                        <tr>
                            <td style="width:28%;"><div class="gov-sign-line">${part1EvalSignDate ? escapeHtml(city) : ''}</div></td>
                            <td style="width:24%;"><div class="gov-sign-line">${escapeHtml(part1EvalSignDate)}</div></td>
                            <td style="width:48%;"><div class="gov-sign-line">${renderSignatureBox(evaluation.podpis_kryteria_oceniajacy_at, evalFullName)}</div></td>
                        </tr>
                        <tr>
                            <td class="gov-sign-caption">miejscowość</td>
                            <td class="gov-sign-caption">data (dd.mm.rrrr)</td>
                            <td class="gov-sign-caption">podpis oceniającego</td>
                        </tr>
                        <tr>
                            <td><div class="gov-sign-line">${part1EmpSignDate ? escapeHtml(city) : ''}</div></td>
                            <td><div class="gov-sign-line">${escapeHtml(part1EmpSignDate)}</div></td>
                            <td><div class="gov-sign-line">${renderSignatureBox(evaluation.podpis_kryteria_oceniany_at, empFullName)}</div></td>
                        </tr>
                        <tr>
                            <td class="gov-sign-caption">miejscowość</td>
                            <td class="gov-sign-caption">data (dd.mm.rrrr)</td>
                            <td class="gov-sign-caption">podpis ocenianego</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="gov-footnotes">
                <p><sup>1)</sup> ${config.footnote1}</p>
                ${
                    config.hasDepartment
                        ? '<p><sup>2)</sup> Należy wskazać pełną nazwę stanowiska pracy wraz z jego rozszerzeniem określającym, do jakich spraw jest to stanowisko (jeżeli zostało to określone w opisie stanowiska pracy).</p>'
                        : ''
                }
                <p><sup>${config.hasDepartment ? '3' : '2'})</sup> Należy wpisać nazwy wybranych kryteriów, korzystając z załącznika nr 1 do rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej.</p>
                <p><sup>${config.hasDepartment ? '4' : '3'})</sup> W trakcie rozmowy omawiane są: 1) główne obowiązki wynikające z opisu stanowiska pracy zajmowanego przez ocenianego, 2) kryteria obowiązkowe i kryteria dodatkowe, jeżeli są wybierane przez oceniającego, 3) oczekiwania oceniającego co do sposobu spełniania kryteriów oceny przez ocenianego, 4) cele do osiągnięcia w okresie, w którym oceniany podlega ocenie, jeżeli ich określenie jest uzasadnione ze względu na charakter obowiązków wynikających z opisu stanowiska pracy zajmowanego przez ocenianego, a także sposób realizacji wyznaczonych celów.</p>
            </div>
        </section>
    `;

    // STRONA 2 — CZĘŚĆ II (Tabela ocen cząstkowych i wynik)
    const page2Html = `
        <section class="gov-page">
            <div class="gov-part-heading">CZĘŚĆ II</div>

            <table class="gov-table">
                <tbody>
                    <tr>
                        <th style="width:44%; text-align:left;">DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ<sup>5)</sup></th>
                        <td colspan="2" class="gov-center">
                            <span class="gov-label">(dd.mm.rrrr)</span>
                            <strong>${escapeHtml(reviewInterviewDate)}</strong>
                        </td>
                    </tr>
                    <tr>
                        <th style="width:44%; text-align:left;">OKRES, W KTÓRYM OCENIANY PODLEGAŁ OCENIE</th>
                        <td class="gov-center" style="width:28%;">
                            <span class="gov-label">OD<sup>6)</sup> (dd.mm.rrrr):</span>
                            <strong>${escapeHtml(periodFromDate)}</strong>
                        </td>
                        <td class="gov-center" style="width:28%;">
                            <span class="gov-label">DO<sup>7)</sup> (dd.mm.rrrr):</span>
                            <strong>${escapeHtml(periodToDate)}</strong>
                        </td>
                    </tr>
                </tbody>
            </table>

            <table class="gov-table">
                <thead>
                    <tr>
                        <th rowspan="2" style="width:45%;">KRYTERIA OBOWIĄZKOWE</th>
                        <th colspan="5">OCENA CZĄSTKOWA<sup>8)</sup></th>
                    </tr>
                    <tr>
                        <th style="width:11%;">Znacznie poniżej oczekiwań<br>1 punkt</th>
                        <th style="width:11%;">Poniżej oczekiwań<br>3 punkty</th>
                        <th style="width:11%;">Na poziomie oczekiwań<br>5 punktów</th>
                        <th style="width:11%;">Powyżej oczekiwań<br>7 punktów</th>
                        <th style="width:11%;">Znacznie powyżej oczekiwań<br>9 punktów</th>
                    </tr>
                </thead>
                <tbody>
                    ${mandatoryPart2Html}
                </tbody>
            </table>

            <table class="gov-table">
                <thead>
                    <tr>
                        <th style="width:45%;">KRYTERIA DODATKOWE WYBRANE PRZEZ OCENIAJĄCEGO<sup>9)</sup></th>
                        <th colspan="5">OCENA CZĄSTKOWA<sup>8)</sup></th>
                    </tr>
                </thead>
                <tbody>
                    ${additionalPart2Html}
                </tbody>
            </table>

            <div class="gov-avg-bar">
                <span>Średnia arytmetyczna z ocen cząstkowych przyznanych za poszczególne kryteria oceny:</span>
                <span class="gov-avg-value">${escapeHtml(avgText || '—')}</span>
            </div>

            <div class="gov-section-bar">PRZYZNANIE OCENY</div>
            <table class="gov-table">
                <thead>
                    <tr>
                        <th style="width:14%;">Należy wstawić znak „X” w odpowiednie pole</th>
                        <th style="width:46%;">Liczba punktów stanowiąca średnią arytmetyczną ze wszystkich ocen cząstkowych</th>
                        <th style="width:40%;">Ogólny poziom spełnienia kryteriów oceny</th>
                    </tr>
                </thead>
                <tbody>
                    ${levelTableRowsHtml}
                </tbody>
            </table>

            <table class="gov-table" style="margin-top:8px;">
                <tbody>
                    <tr>
                        <th style="width:36%;">OCENA OKRESOWA<br>W SŁUŻBIE CYWILNEJ</th>
                        <td class="gov-center" style="width:32%; padding:8px;">
                            <span class="gov-checkbox">${isPositive ? 'X' : '&nbsp;'}</span>
                            <strong>POZYTYWNA<sup>10)</sup></strong>
                        </td>
                        <td class="gov-center" style="width:32%; padding:8px;">
                            <span class="gov-checkbox">${isNegative ? 'X' : '&nbsp;'}</span>
                            <strong>NEGATYWNA<sup>11)</sup></strong>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-footnotes">
                <p><sup>5)</sup> W trakcie rozmowy oceniającej omawia się: 1) główne obowiązki wykonywane przez ocenianego w okresie, w którym podlegał ocenie, oraz sposób ich realizacji, z uwzględnieniem spełniania przez ocenianego ustalonych kryteriów oceny, 2) sposób realizowania przez ocenianego celów do osiągnięcia w okresie, w którym oceniany podlegał ocenie, jeżeli cele te zostały wyznaczone, 3) kierunki dalszego rozwoju zawodowego i potrzeby ocenianego w zakresie podnoszenia kwalifikacji i doskonalenia umiejętności.</p>
                <p><sup>6)</sup> Data „od” oznacza datę zapoznania ocenianego z kryteriami oceny – z części I arkusza oceny.</p>
                <p><sup>7)</sup> Data „do” oznacza datę sporządzenia oceny na piśmie.</p>
                <p><sup>8)</sup> Należy wstawić znak „X” w odpowiednie pole.</p>
                <p><sup>9)</sup> Należy wpisać nazwy wybranych kryteriów, korzystając z załącznika nr 1 do rozporządzenia.</p>
                <p><sup>10)</sup> POZYTYWNA – w przypadku ustalenia ogólnego poziomu spełniania kryteriów oceny na poziomie „znacznie powyżej oczekiwań”, „powyżej oczekiwań” albo „na poziomie oczekiwań”, pod warunkiem nieuzyskania przez ocenianego żadnej z ocen cząstkowych na poziomie „znacznie poniżej oczekiwań”.</p>
                <p><sup>11)</sup> NEGATYWNA – w przypadku ustalenia ogólnego poziomu spełniania kryteriów oceny na poziomie „poniżej oczekiwań” albo „znacznie poniżej oczekiwań”, a także w przypadku uzyskania przez ocenianego co najmniej jednej oceny cząstkowej na poziomie „znacznie poniżej oczekiwań”.</p>
            </div>
        </section>
    `;

    // STRONA 3 — CZĘŚĆ II (Uzasadnienie, IPRZ, poprzednia ocena, podpisy, pouczenie)
    const page3Html = `
        <section class="gov-page">
            <div class="gov-section-bar" style="margin-top:0;">UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ<sup>12)</sup></div>
            <div class="gov-text-box gov-text-box-lg">${escapeHtml(evaluation.uzasadnienie_oceny || '')}</div>

            <div class="gov-section-bar">WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO<sup>13)</sup></div>
            <div class="gov-text-box">${escapeHtml(evaluation.wnioski_iprz || '')}</div>

            <div class="gov-section-bar">DANE DOTYCZĄCE POPRZEDNIEJ OCENY OKRESOWEJ URZĘDNIKA SŁUŻBY CYWILNEJ</div>
            <table class="gov-table">
                <thead>
                    <tr>
                        <th style="width:28%;">Ocena<sup>14)</sup></th>
                        <th style="width:44%;">Poziom<sup>15)</sup></th>
                        <th style="width:28%;">Data sporządzenia (dd.mm.rrrr)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="gov-center" style="height:22px;">${escapeHtml(prevEvalResult)}</td>
                        <td class="gov-center">${escapeHtml(prevEvalLevel)}</td>
                        <td class="gov-center">${escapeHtml(prevEvalDate)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-section-bar">CZY DO OCENY OKRESOWEJ DOŁĄCZONO WNIOSEK O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO?<sup>16)</sup></div>
            <div class="gov-check-row">
                <span><span class="gov-checkbox">${hasRankRequest ? 'X' : '&nbsp;'}</span> TAK</span>
                <span><span class="gov-checkbox">${isCivilServant && !hasRankRequest ? 'X' : '&nbsp;'}</span> NIE</span>
                <span><span class="gov-checkbox">${!isCivilServant ? 'X' : '&nbsp;'}</span> NIE DOTYCZY (oceniany jest pracownikiem służby cywilnej)</span>
            </div>

            <div class="gov-section-bar">DANE OCENIAJĄCEGO</div>
            <table class="gov-table">
                <tbody>
                    <tr>
                        <td style="width:50%;">
                            <span class="gov-label">Imię</span>
                            <span class="gov-value">${escapeHtml(evalNameParts.firstName)}</span>
                        </td>
                        <td style="width:50%;">
                            <span class="gov-label">Nazwisko</span>
                            <span class="gov-value">${escapeHtml(evalNameParts.lastName)}</span>
                        </td>
                    </tr>
                    ${departmentRowEvaluator}
                    <tr>
                        <td colspan="2">
                            <span class="gov-label">${config.evaluatorPositionLabel}</span>
                            <span class="gov-value">${escapeHtml(evalPosition)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <table class="gov-sign-grid" style="margin-top:2px;">
                                <tbody>
                                    <tr>
                                        <td style="width:28%;"><div class="gov-sign-line">${part2EvalSignDate ? escapeHtml(city) : ''}</div></td>
                                        <td style="width:24%;"><div class="gov-sign-line">${escapeHtml(part2EvalSignDate)}</div></td>
                                        <td style="width:48%;"><div class="gov-sign-line">${renderSignatureBox(evaluation.podpis_ocena_oceniajacy_at, evalFullName)}</div></td>
                                    </tr>
                                    <tr>
                                        <td class="gov-sign-caption">miejscowość</td>
                                        <td class="gov-sign-caption">data (dd.mm.rrrr)</td>
                                        <td class="gov-sign-caption">podpis oceniającego</td>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="gov-confirm-box" style="margin-top:6px;">
                <p style="margin:0 0 4px 0;">
                    Przeprowadzono ze mną rozmowę oceniającą oraz zapoznałem(-łam) się z oceną okresową i wnioskami dotyczącymi indywidualnego programu rozwoju zawodowego.
                </p>
                <table class="gov-sign-grid" style="margin-top:2px;">
                    <tbody>
                        <tr>
                            <td style="width:20%;"><div class="gov-sign-line">${part2EmpSignDate ? escapeHtml(city) : ''}</div></td>
                            <td style="width:18%;"><div class="gov-sign-line">${escapeHtml(part2EmpSignDate)}</div></td>
                            <td style="width:31%;"><div class="gov-sign-line">${escapeHtml(empFullName)}</div></td>
                            <td style="width:31%;"><div class="gov-sign-line">${renderSignatureBox(evaluation.podpis_ocena_oceniany_at, empFullName)}</div></td>
                        </tr>
                        <tr>
                            <td class="gov-sign-caption">miejscowość</td>
                            <td class="gov-sign-caption">data (dd.mm.rrrr)</td>
                            <td class="gov-sign-caption">imię i nazwisko lub pieczątka ocenianego</td>
                            <td class="gov-sign-caption">podpis ocenianego</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="gov-pouczenie">
                <div class="gov-pouczenie-title">Pouczenie</div>
                <div>${dynamicPouczenieHtml}</div>
            </div>

            <div class="gov-footnotes">
                <p><sup>12)</sup> Uzasadnienie jest obligatoryjne w przypadku otrzymania przez ocenianego negatywnej oceny okresowej. W przypadku przyznania oceny pozytywnej uzasadnienie jest fakultatywne.</p>
                <p><sup>13)</sup> Uwzględniając sporządzoną ocenę, realizowane i przyszłe zadania oraz oczekiwania ocenianego, należy określić kierunki rozwoju zawodowego ocenianego, biorąc pod uwagę obszary wiedzy i umiejętności wymagające doskonalenia, oraz zaproponować optymalne formy i metody ich realizacji.</p>
                <p><sup>14)</sup> Należy wpisać „pozytywna” lub „negatywna”. &nbsp; <sup>15)</sup> Należy wpisać, na jakim poziomie była przyznana poprzednia ocena okresowa (np. „na poziomie oczekiwań”). &nbsp; <sup>16)</sup> Należy wstawić znak „X” w odpowiednie pole.</p>
                ${config.pouczenieFootnote ? `<p>${config.pouczenieFootnote}</p>` : ''}
            </div>
        </section>
    `;

    // STRONA 4 — CZĘŚĆ III (Drukujemy WYŁĄCZNIE gdy oceniany jest urzędnikiem SC i dołączono wniosek o stopień)
    let page4Html = '';
    if (hasRankRequest) {
        const requestedRankNum =
            resolvedRankRequest.wnioskowany_stopien ||
            (currentRank > 0 && currentRank < 9 ? currentRank + 1 : '');
        const requestedRankText = formatRankRoman(requestedRankNum) || String(requestedRankNum || '');
        const currentRankText = formatRankRoman(currentRank);
        const requestJustification =
            resolvedRankRequest.umotywowanie_przelozonego ||
            resolvedRankRequest.umotywowanie ||
            '';
        const requestDateText = formatDatePl(
            resolvedRankRequest.data_decyzji ||
                evaluation.podpis_ocena_oceniajacy_at ||
                evaluation.data_rozmowy_oceniajacej
        );

        page4Html = `
            <section class="gov-page">
                <div class="gov-part-heading">CZĘŚĆ III</div>
                <div class="gov-part3-note">
                    Wniosek jest wypełniany i dołączany do arkusza oceny okresowej ocenianego tylko w sytuacji skorzystania przez oceniającego z możliwości przewidzianej w art. 89 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej.<sup>18)</sup>
                </div>

                <div class="gov-section-bar">DANE URZĘDNIKA SŁUŻBY CYWILNEJ</div>
                <table class="gov-table">
                    <tbody>
                        <tr>
                            <td style="width:50%;">
                                <span class="gov-label">Imię</span>
                                <span class="gov-value">${escapeHtml(empNameParts.firstName)}</span>
                            </td>
                            <td style="width:50%;">
                                <span class="gov-label">Nazwisko</span>
                                <span class="gov-value">${escapeHtml(empNameParts.lastName)}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table class="gov-table">
                    <tbody>
                        <tr>
                            <td style="width:30%;">
                                <span class="gov-label">Rok mianowania (rrrr)</span>
                                <span class="gov-value">${escapeHtml(resolvedEmployee && resolvedEmployee.rok_mianowania ? resolvedEmployee.rok_mianowania : '')}</span>
                            </td>
                            <td style="width:35%;">
                                <span class="gov-label">Posiadany stopień służbowy</span>
                                <span class="gov-value">${escapeHtml(currentRankText ? `${currentRankText} stopień służbowy` : '')}</span>
                            </td>
                            <td style="width:35%;">
                                <span class="gov-label">Data przyznania stopnia służbowego (dd.mm.rrrr)</span>
                                <span class="gov-value">${escapeHtml(formatDatePl(resolvedEmployee && resolvedEmployee.data_przyznania_stopnia))}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="gov-section-bar">WNIOSEK O PRZYZNANIE URZĘDNIKOWI SŁUŻBY CYWILNEJ KOLEJNEGO STOPNIA SŁUŻBOWEGO</div>
                <div class="gov-confirm-box" style="margin-top:0;">
                    <p style="margin:4px 0 10px 0; line-height:1.6;">
                        W związku z uzyskaniem przez Panią/Pana
                        <span class="gov-inline-fill">${escapeHtml(empFullName)}</span>
                        pozytywnej oceny okresowej, na podstawie art. 89 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej wnioskuję o przyznanie
                        <span class="gov-inline-fill" style="min-width:60px;">${escapeHtml(requestedRankText)}</span>
                        stopnia służbowego.
                    </p>

                    <div style="font-weight:bold; margin-bottom:4px;">Umotywowanie wniosku</div>
                    <div class="gov-text-box gov-text-box-lg" style="min-height:170px;">${escapeHtml(requestJustification)}</div>

                    <table class="gov-sign-grid" style="margin-top:16px;">
                        <tbody>
                            <tr>
                                <td style="width:20%;"><div class="gov-sign-line">${requestDateText ? escapeHtml(city) : ''}</div></td>
                                <td style="width:18%;"><div class="gov-sign-line">${escapeHtml(requestDateText)}</div></td>
                                <td style="width:31%;"><div class="gov-sign-line">${escapeHtml(evalFullName)}</div></td>
                                <td style="width:31%;"><div class="gov-sign-line">${renderSignatureBox(evaluation.podpis_ocena_oceniajacy_at, evalFullName)}</div></td>
                            </tr>
                            <tr>
                                <td class="gov-sign-caption">miejscowość</td>
                                <td class="gov-sign-caption">data (dd.mm.rrrr)</td>
                                <td class="gov-sign-caption">imię i nazwisko lub pieczątka oceniającego</td>
                                <td class="gov-sign-caption">podpis oceniającego</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="gov-footnotes">
                    <p><sup>18)</sup> Części III nie drukuje się i nie dołącza do arkusza oceny okresowej w przypadku ocenianego będącego pracownikiem służby cywilnej oraz w razie nieskładania wniosku o przyznanie urzędnikowi służby cywilnej kolejnego stopnia służbowego.</p>
                </div>
            </section>
        `;
    }

    area.innerHTML = `
        ${buildPrintStyles()}
        <div class="gov-sheet">
            ${page1Html}
            ${page2Html}
            ${page3Html}
            ${page4Html}
        </div>
    `;

    window.print();
}