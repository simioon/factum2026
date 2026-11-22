import { escapeHtml, formatDateTime, getCriterionById } from '../utils.js';

export function printEvaluationSheet({ employee, evaluator, evaluation }) {
    const area = document.getElementById('print-sheet-area');
    if (!area || !evaluation) return;

    const rows = (evaluation.criteria || [])
        .map((c) => {
            const crit = getCriterionById(c.kryterium_id);
            const name = c.nazwa || (crit ? crit.nazwa : `#${c.kryterium_id}`);
            const pts = c.punkty !== null && c.punkty !== undefined ? `${c.punkty} pkt` : '—';
            return `<tr><td>${escapeHtml(name)}</td><td>${pts}</td></tr>`;
        })
        .join('');

    const dateText =
        evaluation.data_rozmowy_oceniajacej ||
        evaluation.data_zapoznania_z_ocena ||
        new Date().toISOString().slice(0, 10);

    const signedText = evaluation.podpis_ocena_oceniajacy_at
        ? `Oceniający: ${formatDateTime(evaluation.podpis_ocena_oceniajacy_at)}` +
          (evaluation.podpis_ocena_oceniany_at
              ? ` | Oceniany: ${formatDateTime(evaluation.podpis_ocena_oceniany_at)}`
              : ' | Oczekuje na podpis ocenianego')
        : 'Projekt arkusza (do podpisu)';

    area.innerHTML = `
        <h2 style="text-align:center;">ARKUSZ ${escapeHtml(evaluation.typ_arkusza)} — OCENA OKRESOWA W SŁUŻBIE CYWILNEJ</h2>
        <p style="text-align:center; margin-bottom:16px;">Wygenerowano przez Cyfrowego Asystenta Ocen Okresowych (Podejście nr ${evaluation.numer_podejscia || 1})</p>
        <p><strong>Oceniany:</strong> ${employee ? `${escapeHtml(employee.imie_nazwisko)} — ${escapeHtml(employee.nazwa_stanowiska)}` : escapeHtml(evaluation.pracownik_nazwa || '')}</p>
        <p><strong>Oceniający:</strong> ${evaluator ? `${escapeHtml(evaluator.imie_nazwisko)} — ${escapeHtml(evaluator.nazwa_stanowiska)}` : escapeHtml(evaluation.oceniajacy_nazwa || '')}</p>
        <p><strong>Data sporządzenia:</strong> ${escapeHtml(dateText)}</p>
        <table>
            <thead><tr><th>Kryterium</th><th>Ocena cząstkowa</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p><strong>Średnia arytmetyczna:</strong> ${evaluation.srednia_punktow ?? '—'} pkt (${escapeHtml(evaluation.poziom_oceny_label || evaluation.poziom_oceny || '—')})</p>
        <p><strong>Ocena okresowa:</strong> ${escapeHtml(evaluation.wynik_ogolny || '—')}</p>
        <p style="margin-top:10px; white-space:pre-line;"><strong>Uzasadnienie:</strong><br>${escapeHtml(evaluation.uzasadnienie_oceny || '—')}</p>
        <p style="margin-top:10px; white-space:pre-line;"><strong>Wnioski do IPRZ:</strong><br>${escapeHtml(evaluation.wnioski_iprz || '—')}</p>
        <p style="margin-top:24px;"><strong>Podpisy elektroniczne:</strong> ${escapeHtml(signedText)}</p>
    `;

    window.print();
}
