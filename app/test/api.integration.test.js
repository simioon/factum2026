const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost';

async function apiReq(path, { method = 'GET', userId = null, body = null } = {}) {
    const headers = {};
    if (userId) headers['X-User-Id'] = String(userId);
    if (body !== null) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    return { status: res.status, data: json };
}

test('Full end-to-end evaluation, HR events, visibility, appeals, and rank workflow', async (t) => {
    let users;
    let anna;
    let tomasz;
    let jan;
    let marek;
    let admin;
    let dictionaries;

    await t.test('1. Health, dictionaries, and seeded users (no haslo_hash leak)', async () => {
        const health = await apiReq('/api/health');
        assert.equal(health.status, 200);
        assert.equal(health.data.status, 'ok');

        const dictRes = await apiReq('/api/dictionaries');
        assert.equal(dictRes.status, 200);
        dictionaries = dictRes.data;
        assert.equal(dictionaries.criteria.length, 14);
        assert.equal(dictionaries.tags.length, 16);
        assert.deepEqual([...dictionaries.sheetCriteria.C.mandatoryIds].sort((a, b) => a - b), [1, 4, 8, 10, 11]);

        const usersRes = await apiReq('/api/users');
        assert.equal(usersRes.status, 200);
        users = usersRes.data.users;
        assert.ok(users.length >= 5);

        for (const u of users) {
            assert.equal('haslo_hash' in u, false, 'haslo_hash must never be returned');
        }

        marek = users.find((u) => u.rola === 'DYREKTOR');
        jan = users.find((u) => u.imie_nazwisko === 'Jan Kowalski');
        admin = users.find((u) => u.rola === 'ADMIN');
        anna = users.find((u) => u.imie_nazwisko === 'Anna Nowak');
        tomasz = users.find((u) => u.imie_nazwisko === 'Tomasz Mazur');

        assert.ok(marek && jan && admin && anna && tomasz);
        assert.equal(anna.rank, 2);
        assert.equal(tomasz.employmentType, 'UMOWA_NIEOKRESLONA');
    });

    await t.test('2. Admin creates user & reassigns evaluator (logs ZMIANA_OCENIAJACEGO)', async () => {
        // Non-admin rejected
        const forbidden = await apiReq('/api/users', {
            method: 'POST',
            userId: anna.id,
            body: { imie_nazwisko: 'Test', nazwa_stanowiska: 'Spec', rola: 'OCENIANY', arkusz: 'C' },
        });
        assert.equal(forbidden.status, 403);

        const created = await apiReq('/api/users', {
            method: 'POST',
            userId: admin.id,
            body: {
                imie_nazwisko: 'Katarzyna Kaczmarek',
                nazwa_stanowiska: 'Specjalista ds. Prawnych',
                komorka_organizacyjna: 'Departament Prawny',
                arkusz: 'C',
                rola: 'OCENIANY',
                aktualny_stopien_sluzbowy: 1,
                przelozony_id: jan.id,
            },
        });
        assert.equal(created.status, 201);
        assert.ok(created.data.activeEvaluation);
        const newUserId = created.data.user.id;

        const reassigned = await apiReq(`/api/users/${newUserId}/evaluator`, {
            method: 'PATCH',
            userId: admin.id,
            body: { przelozony_id: marek.id },
        });
        assert.equal(reassigned.status, 200);
        assert.equal(reassigned.data.user.przelozony_id, marek.id);
        assert.equal(reassigned.data.loggedEvent.typ_zdarzenia, 'ZMIANA_OCENIAJACEGO');
    });

    await t.test('3. Two-sided criteria setup: >3 additional rejected, manager + employee e-sign', async () => {
        const tomaszWs = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        assert.equal(tomaszWs.status, 200);
        const evalId = tomaszWs.data.activeEvaluation.id;

        // >3 additional criteria rejected
        const tooMany = await apiReq(`/api/evaluations/${evalId}/setup`, {
            method: 'PUT',
            userId: jan.id,
            body: { additionalCriteriaIds: [2, 3, 5, 7], signByEvaluator: false },
        });
        assert.equal(tooMany.status, 400);

        const setupOk = await apiReq(`/api/evaluations/${evalId}/setup`, {
            method: 'PUT',
            userId: jan.id,
            body: {
                data_rozmowy_wstepnej: '2026-11-20',
                oczekiwania_i_cele: 'Poprawa terminowości protokołów kontrolnych.',
                additionalCriteriaIds: [7, 2],
                signByEvaluator: true,
            },
        });
        assert.equal(setupOk.status, 200);
        assert.equal(setupOk.data.evaluation.status, 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW');
        assert.equal(setupOk.data.evaluation.criteria.length, 7); // 5 mandatory + 2 additional

        const empSign = await apiReq(`/api/evaluations/${evalId}/sign-criteria`, {
            method: 'POST',
            userId: tomasz.id,
        });
        assert.equal(empSign.status, 200);
        assert.equal(empSign.data.evaluation.status, 'W_TRAKCIE_OKRESU');
    });

    await t.test('4. HR events shift planowana_data_oceny and deleting reverts it', async () => {
        const wsBefore = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        const evalId = wsBefore.data.activeEvaluation.id;
        const origDate = wsBefore.data.activeEvaluation.planowana_data_oceny;

        const hrAdd = await apiReq(`/api/evaluations/${evalId}/hr-events`, {
            method: 'POST',
            userId: jan.id,
            body: {
                typ_zdarzenia: 'NIEOBECNOSC_POWYZEJ_MIESIACA',
                data_od: '2026-12-01',
                data_do: '2027-01-14', // 45 days inclusive
                opis: 'Długie zwolnienie L4',
            },
        });
        assert.equal(hrAdd.status, 201);
        assert.equal(hrAdd.data.event.dni_przesuniecia_terminu, 45);
        assert.notEqual(hrAdd.data.planowana_data_oceny, origDate);

        const hrDel = await apiReq(`/api/hr-events/${hrAdd.data.event.id}`, {
            method: 'DELETE',
            userId: jan.id,
        });
        assert.equal(hrDel.status, 200);
        assert.equal(hrDel.data.planowana_data_oceny, origDate);
    });

    await t.test('5. Task visibility (TYLKO_MENEDZER hidden from employee) & DOBROSTAN polarity', async () => {
        const ws = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        const evalId = ws.data.activeEvaluation.id;

        const privTask = await apiReq(`/api/evaluations/${evalId}/tasks`, {
            method: 'POST',
            userId: jan.id,
            body: {
                tytul: 'Prywatna notatka menedżera o stresie',
                widocznosc: 'TYLKO_MENEDZER',
            },
        });
        assert.equal(privTask.status, 201);

        const wellbeingTag = dictionaries.tags.find((tg) => tg.nazwa === '#Przeciążenie');
        const tagAdd = await apiReq(`/api/tasks/${privTask.data.task.id}/tags`, {
            method: 'POST',
            userId: jan.id,
            body: {
                tag_id: wellbeingTag.id,
                polaryzacja: '+', // Should be auto-forced to '-' for DOBROSTAN
                komentarz: 'Sygnał dobrostanowy',
            },
        });
        assert.equal(tagAdd.status, 201);
        assert.equal(tagAdd.data.taskTag.polaryzacja, '-');

        // Employee workspace must NOT see TYLKO_MENEDZER task
        const empWs = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: tomasz.id });
        assert.equal(empWs.status, 200);
        assert.equal(
            empWs.data.activeEvaluation.tasks.some((x) => x.id === privTask.data.task.id),
            false
        );
    });

    await t.test('6. Negative evaluation requires justification (400 if empty)', async () => {
        const ws = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        const evalId = ws.data.activeEvaluation.id;
        const scores = {};
        for (const c of ws.data.activeEvaluation.criteria) {
            scores[c.kryterium_id] = 3;
        }

        const missingJustif = await apiReq(`/api/evaluations/${evalId}/finalize`, {
            method: 'POST',
            userId: jan.id,
            body: { scores, uzasadnienie_oceny: '   ' },
        });
        assert.equal(missingJustif.status, 400);
    });

    await t.test('7. Anna Nowak positive finalize -> acknowledge -> automatic OBLIGATORYJNY rank promotion + next cycle', async () => {
        const ws = await apiReq(`/api/users/${anna.id}/workspace`, { userId: jan.id });
        const evalId = ws.data.activeEvaluation.id;
        assert.equal(ws.data.previousEvalEligibleForAutoPromotion, true);

        const scores = {};
        for (const c of ws.data.activeEvaluation.criteria) {
            scores[c.kryterium_id] = 7;
        }

        const finalized = await apiReq(`/api/evaluations/${evalId}/finalize`, {
            method: 'POST',
            userId: jan.id,
            body: {
                scores,
                uzasadnienie_oceny: 'Bardzo dobre wyniki pracy.',
                wnioski_iprz: 'Dalszy rozwój analizy BI.',
            },
        });
        assert.equal(finalized.status, 200);
        assert.equal(finalized.data.evaluation.status, 'SPORZADZONA_DO_PODPISU');
        assert.equal(finalized.data.evaluation.srednia_punktow, 7);
        assert.equal(finalized.data.autoRankPromotionPending, true);

        const ack = await apiReq(`/api/evaluations/${evalId}/acknowledge`, {
            method: 'POST',
            userId: anna.id,
        });
        assert.equal(ack.status, 200);
        assert.equal(ack.data.evaluation.status, 'ZAKONCZONA');
        assert.equal(ack.data.autoRankPromoted, true);
        assert.equal(ack.data.newRank, 3); // II -> III
        assert.ok(ack.data.nextEvaluation);
        assert.equal(ack.data.nextEvaluation.status, 'WYZNACZANIE_KRYTERIOW');
    });

    await t.test('8. Employee appeal -> Director UWZGLEDNIONY_PONOWNA_OCENA -> UNIEWAZNIONA + attempt 2', async () => {
        const annaWs = await apiReq(`/api/users/${anna.id}/workspace`, { userId: anna.id });
        const completedEval = annaWs.data.pastEvaluations.find((e) => e.status === 'ZAKONCZONA');
        assert.ok(completedEval);

        const appealRes = await apiReq(`/api/evaluations/${completedEval.id}/appeals`, {
            method: 'POST',
            userId: anna.id,
            body: { uzasadnienie_pracownika: 'Wnoszę o ponowną ocenę kryterium komunikacji.' },
        });
        assert.equal(appealRes.status, 201);
        const appealId = appealRes.data.appeal.id;

        const decideRes = await apiReq(`/api/appeals/${appealId}/decide`, {
            method: 'PATCH',
            userId: marek.id,
            body: {
                decyzja_dyrektora: 'UWZGLEDNIONY_PONOWNA_OCENA',
                uzasadnienie_decyzji: 'Zasadny wniosek — zarządzam ponowną ocenę.',
            },
        });
        assert.equal(decideRes.status, 200);
        assert.equal(decideRes.data.evaluation.status, 'UNIEWAZNIONA');
        assert.ok(decideRes.data.newEvaluation);
        assert.equal(decideRes.data.newEvaluation.numer_podejscia, 2);
        assert.equal(decideRes.data.newEvaluation.poprzednia_ocena_id, completedEval.id);
        assert.equal(decideRes.data.newEvaluation.status, 'PRZED_ROZMOWA_OCENIAJACA');
    });

    await t.test('9. Director requests correction -> evaluator can identify it for notification', async () => {
        const ws = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        const evalId = ws.data.activeEvaluation.id;
        const scores = Object.fromEntries(ws.data.activeEvaluation.criteria.map((c) => [c.kryterium_id, 7]));

        const finalized = await apiReq(`/api/evaluations/${evalId}/finalize`, {
            method: 'POST',
            userId: jan.id,
            body: { scores, uzasadnienie_oceny: 'Wyniki zgodne z oczekiwaniami.' },
        });
        assert.equal(finalized.status, 200);
        const acknowledged = await apiReq(`/api/evaluations/${evalId}/acknowledge`, {
            method: 'POST',
            userId: tomasz.id,
        });
        assert.equal(acknowledged.status, 200);
        assert.equal(acknowledged.data.evaluation.status, 'ZAKONCZONA');

        const appeal = await apiReq(`/api/evaluations/${evalId}/appeals`, {
            method: 'POST',
            userId: tomasz.id,
            body: { uzasadnienie_pracownika: 'Wnoszę o zmianę oceny.' },
        });
        assert.equal(appeal.status, 201);
        const decision = await apiReq(`/api/appeals/${appeal.data.appeal.id}/decide`, {
            method: 'PATCH',
            userId: marek.id,
            body: {
                decyzja_dyrektora: 'UWZGLEDNIONY_ZMIANA',
                uzasadnienie_decyzji: 'Proszę poprawić punktację.',
            },
        });
        assert.equal(decision.status, 200);
        assert.equal(decision.data.evaluation.status, 'PRZED_ROZMOWA_OCENIAJACA');

        const evaluatorAppeals = await apiReq('/api/appeals', { userId: jan.id });
        const correction = evaluatorAppeals.data.appeals.find((item) => item.id === appeal.data.appeal.id);
        assert.equal(correction.evaluation_status, 'PRZED_ROZMOWA_OCENIAJACA');
        assert.equal(correction.oceniajacy_id, jan.id);
    });

    await t.test('10. Director approves Jan Kowalski pending FAKULTATYWNY rank request (IV -> V)', async () => {
        const rrList = await apiReq('/api/rank-requests', { userId: marek.id });
        assert.equal(rrList.status, 200);
        const pending = rrList.data.rankRequests.find(
            (r) => r.pracownik_id === jan.id && r.status_decyzji === 'OCZEKUJE'
        );
        assert.ok(pending);

        const decided = await apiReq(`/api/rank-requests/${pending.id}/decide`, {
            method: 'PATCH',
            userId: marek.id,
            body: {
                status_decyzji: 'ZATWIERDZONY',
                motywacja_dyrektora: 'Wyróżniające kierowanie wydziałem.',
            },
        });
        assert.equal(decided.status, 200);
        assert.equal(decided.data.newRank, 5);
    });
});
