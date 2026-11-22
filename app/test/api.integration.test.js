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
    let katarzynaId;

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
        katarzynaId = newUserId;

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

        // Part I is now locked: any further setup save or re-sign is rejected with 409
        const lockedResave = await apiReq(`/api/evaluations/${evalId}/setup`, {
            method: 'PUT',
            userId: jan.id,
            body: { additionalCriteriaIds: [7], signByEvaluator: false },
        });
        assert.equal(lockedResave.status, 409);
        const lockedResign = await apiReq(`/api/evaluations/${evalId}/setup`, {
            method: 'PUT',
            userId: jan.id,
            body: { additionalCriteriaIds: [7, 2], signByEvaluator: true },
        });
        assert.equal(lockedResign.status, 409);

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

        const wellbeingTag = dictionaries.tags.find((tg) => tg.nazwa === 'Przeciążenie');
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
        // Verify seeded tags hydrated properly (no missing tag names)
        for (const t of empWs.data.activeEvaluation.tasks) {
            for (const tg of t.tags) {
                assert.ok(tg.tag_nazwa && tg.tag_nazwa.length > 0);
            }
        }
    });

    await t.test('5b. Batch tagging on task creation & existing task + atomic rollback on invalid tag', async () => {
        const ws = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        const evalId = ws.data.activeEvaluation.id;
        const tJasny = dictionaries.tags.find((tg) => tg.nazwa === 'Jasny Przekaz');
        const tTerm = dictionaries.tags.find((tg) => tg.nazwa === 'Terminowość I Priorytety');
        const tWell = dictionaries.tags.find((tg) => tg.nazwa === 'Nadgodziny');

        // Create task with initial mixed-polarity batch + shared explaining note
        const created = await apiReq(`/api/evaluations/${evalId}/tasks`, {
            method: 'POST',
            userId: jan.id,
            body: {
                tytul: 'Wpis z wsadowym tagowaniem',
                widocznosc: 'OBIE_STRONY',
                tags: [
                    { tag_id: tJasny.id, polaryzacja: '+' },
                    { tag_id: tTerm.id, polaryzacja: '-' },
                    { tag_id: tWell.id, polaryzacja: '+' }, // DOBROSTAN auto-forced to '-'
                ],
                komentarz: 'Wspólna notatka wyjaśniająca dla całego zestawu.',
            },
        });
        assert.equal(created.status, 201);
        assert.equal(created.data.task.tags.length, 3);
        assert.equal(created.data.task.tags[0].polaryzacja, '+');
        assert.equal(created.data.task.tags[1].polaryzacja, '-');
        assert.equal(created.data.task.tags[2].polaryzacja, '-');
        for (const tg of created.data.task.tags) {
            assert.equal(tg.komentarz, 'Wspólna notatka wyjaśniająca dla całego zestawu.');
        }

        // Batch-add tags to existing task
        const taskId = created.data.task.id;
        const batchAdd = await apiReq(`/api/tasks/${taskId}/tags`, {
            method: 'POST',
            userId: jan.id,
            body: {
                tags: [
                    { tag_id: tJasny.id, polaryzacja: '-' },
                    { tag_id: tTerm.id, polaryzacja: '+' },
                ],
                komentarz: 'Drugi wsad z notatką.',
            },
        });
        assert.equal(batchAdd.status, 201);
        assert.equal(batchAdd.data.taskTags.length, 2);
        assert.equal(batchAdd.data.taskTags[0].komentarz, 'Drugi wsad z notatką.');

        // Empty batch rejected with 400
        const emptyBatch = await apiReq(`/api/tasks/${taskId}/tags`, {
            method: 'POST',
            userId: jan.id,
            body: { tags: [], komentarz: 'Pusty zestaw' },
        });
        assert.equal(emptyBatch.status, 400);

        // Partial invalid batch rolls back atomically (zero new rows inserted)
        const invalidBatch = await apiReq(`/api/tasks/${taskId}/tags`, {
            method: 'POST',
            userId: jan.id,
            body: {
                tags: [
                    { tag_id: tJasny.id, polaryzacja: '+' },
                    { tag_id: 999999, polaryzacja: '+' },
                ],
                komentarz: 'Nie powinno się zapisać',
            },
        });
        assert.equal(invalidBatch.status, 400);

        const afterWs = await apiReq(`/api/users/${tomasz.id}/workspace`, { userId: jan.id });
        const savedTask = afterWs.data.activeEvaluation.tasks.find((x) => x.id === taskId);
        assert.equal(savedTask.tags.length, 5); // 3 initial + 2 valid batch, 0 from rolled-back batch
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

        // Rejecting without motivation must fail with 400
        const rejectNoReason = await apiReq(`/api/rank-requests/${pending.id}/decide`, {
            method: 'PATCH',
            userId: marek.id,
            body: { status_decyzji: 'ODRZUCONY', motywacja_dyrektora: '   ' },
        });
        assert.equal(rejectNoReason.status, 400);

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

    await t.test('11. Admin criteria management: CRUD, sheet rules, non-destructive archive & restore', async () => {
        // Non-admin rejected
        const nonAdminCrit = await apiReq('/api/criteria', { userId: jan.id });
        assert.equal(nonAdminCrit.status, 403);

        // Must assign at least 1 sheet
        const noSheets = await apiReq('/api/criteria', {
            method: 'POST',
            userId: admin.id,
            body: {
                nazwa: 'Bez arkuszy',
                opis: 'Test',
                sheets: { A: null, B: null, C: null },
            },
        });
        assert.equal(noSheets.status, 400);

        // Create new criterion assigned as DODATKOWE on A, B, C
        const createdCrit = await apiReq('/api/criteria', {
            method: 'POST',
            userId: admin.id,
            body: {
                nazwa: 'Cyberbezpieczeństwo i ochrona danych',
                opis: 'Przestrzeganie zasad RODO.\nZgłaszanie incydentów.',
                sheets: { A: 'DODATKOWE', B: 'DODATKOWE', C: 'DODATKOWE' },
            },
        });
        assert.equal(createdCrit.status, 201);
        const critId = createdCrit.data.criterion.id;
        assert.equal(createdCrit.data.criterion.descriptions.length, 2);

        // Duplicate name rejected with 409
        const dupCrit = await apiReq('/api/criteria', {
            method: 'POST',
            userId: admin.id,
            body: {
                nazwa: 'cyberbezpieczeństwo i ochrona danych',
                opis: 'Duplikat',
                sheets: { A: 'DODATKOWE', B: null, C: null },
            },
        });
        assert.equal(dupCrit.status, 409);

        // Appears in dictionaries and can be selected in Jan's Sheet B setup
        const dictAfterCreate = await apiReq('/api/dictionaries');
        assert.ok(dictAfterCreate.data.criteria.some((c) => c.id === critId));
        assert.ok(dictAfterCreate.data.sheetCriteria.B.additionalIds.includes(critId));

        const janWs = await apiReq(`/api/users/${katarzynaId}/workspace`, { userId: marek.id });
        const janEvalId = janWs.data.activeEvaluation.id;
        const setupWithNewCrit = await apiReq(`/api/evaluations/${janEvalId}/setup`, {
            method: 'PUT',
            userId: marek.id,
            body: {
                data_rozmowy_wstepnej: '2026-01-25',
                oczekiwania_i_cele: 'Rozszerzony zakres o cyberbezpieczeństwo.',
                additionalCriteriaIds: [critId],
                signByEvaluator: false,
            },
        });
        assert.equal(setupWithNewCrit.status, 200);
        assert.ok(setupWithNewCrit.data.evaluation.criteria.some((c) => c.kryterium_id === critId));

        // Edit criterion name & sheet roles
        const updatedCrit = await apiReq(`/api/criteria/${critId}`, {
            method: 'PUT',
            userId: admin.id,
            body: {
                nazwa: 'Cyberbezpieczeństwo i RODO',
                opis: 'Przestrzeganie polityki bezpieczeństwa.\nOchrona danych osobowych.',
                sheets: { A: null, B: 'DODATKOWE', C: 'DODATKOWE' },
            },
        });
        assert.equal(updatedCrit.status, 200);
        assert.equal(updatedCrit.data.criterion.nazwa, 'Cyberbezpieczeństwo i RODO');
        assert.equal(updatedCrit.data.criterion.sheets.A, null);

        // Soft-delete (archive) used criterion -> disappears from dictionaries, preserved in Jan's evaluation
        const archivedCrit = await apiReq(`/api/criteria/${critId}`, {
            method: 'DELETE',
            userId: admin.id,
        });
        assert.equal(archivedCrit.status, 200);
        assert.equal(archivedCrit.data.archived, true);
        assert.equal(archivedCrit.data.criterion.czy_aktywne, false);
        assert.ok(archivedCrit.data.criterion.usageCount >= 1);

        const dictAfterArchive = await apiReq('/api/dictionaries');
        assert.equal(dictAfterArchive.data.criteria.some((c) => c.id === critId), false);
        assert.equal(dictAfterArchive.data.sheetCriteria.B.additionalIds.includes(critId), false);

        const janWsAfterArchive = await apiReq(`/api/users/${katarzynaId}/workspace`, { userId: marek.id });
        const preservedCrit = janWsAfterArchive.data.activeEvaluation.criteria.find((c) => c.kryterium_id === critId);
        assert.ok(preservedCrit);
        assert.equal(preservedCrit.nazwa, 'Cyberbezpieczeństwo i RODO');
        assert.equal(preservedCrit.kryterium_czy_aktywne, false);

        // Restore criterion so Test 12 can map tags to it
        const restoredCrit = await apiReq(`/api/criteria/${critId}/restore`, {
            method: 'PATCH',
            userId: admin.id,
        });
        assert.equal(restoredCrit.status, 200);
        assert.equal(restoredCrit.data.criterion.czy_aktywne, true);
    });

    await t.test('12. Admin tag management: create with criteria, full edit, non-destructive delete & restore', async () => {
        // Non-admin rejected
        const forbidden = await apiReq('/api/tags', { userId: jan.id });
        assert.equal(forbidden.status, 403);

        // KOMPETENCYJNY requires >= 1 criterion
        const noCritTag = await apiReq('/api/tags', {
            method: 'POST',
            userId: admin.id,
            body: { nazwa: 'Tag Bez Kryteriów', kategoria: 'KOMPETENCYJNY', criteriaIds: [] },
        });
        assert.equal(noCritTag.status, 400);

        // DOBROSTAN auto-clears criteriaIds
        const wellTag = await apiReq('/api/tags', {
            method: 'POST',
            userId: admin.id,
            body: { nazwa: 'Wypalenie Testowe', kategoria: 'DOBROSTAN', opis: 'HR alert', criteriaIds: [1] },
        });
        assert.equal(wellTag.status, 201);
        assert.deepEqual(wellTag.data.tag.criteriaIds, []);

        // Create KOMPETENCYJNY tag simultaneously mapped to custom criterion + Komunikacja (1)
        const adminCriteriaRes = await apiReq('/api/criteria', { userId: admin.id });
        const cyberCrit = adminCriteriaRes.data.criteria.find((c) => c.nazwa === 'Cyberbezpieczeństwo i RODO');
        assert.ok(cyberCrit);

        const createdTag = await apiReq('/api/tags', {
            method: 'POST',
            userId: admin.id,
            body: {
                nazwa: 'Higiena Cyfrowa',
                kategoria: 'KOMPETENCYJNY',
                opis: 'bezpieczeństwo IT i RODO',
                criteriaIds: [1, cyberCrit.id],
            },
        });
        assert.equal(createdTag.status, 201);
        const tagId = createdTag.data.tag.id;
        assert.deepEqual(createdTag.data.tag.criteriaIds, [1, cyberCrit.id]);

        // Duplicate name rejected with 409
        const dupTag = await apiReq('/api/tags', {
            method: 'POST',
            userId: admin.id,
            body: { nazwa: 'higiena cyfrowa', kategoria: 'KOMPETENCYJNY', criteriaIds: [1] },
        });
        assert.equal(dupTag.status, 409);

        // Assign newly created tag to a task in Jan's evaluation -> feeds both criteria in workspace
        const janWs = await apiReq(`/api/users/${katarzynaId}/workspace`, { userId: marek.id });
        const janEvalId = janWs.data.activeEvaluation.id;
        const taggedTask = await apiReq(`/api/evaluations/${janEvalId}/tasks`, {
            method: 'POST',
            userId: marek.id,
            body: {
                tytul: 'Audyt uprawnień i szkolenie RODO',
                tags: [{ tag_id: tagId, polaryzacja: '+' }],
                komentarz: 'Wzorowe wdrożenie polityki bezpieczeństwa.',
            },
        });
        assert.equal(taggedTask.status, 201);
        const taskId = taggedTask.data.task.id;

        const wsAfterTag = await apiReq(`/api/users/${katarzynaId}/workspace`, { userId: marek.id });
        assert.equal(wsAfterTag.data.tagSummariesByCriterion[cyberCrit.id].posCount, 1);
        assert.ok(wsAfterTag.data.tagSummariesByCriterion[1].entries.some((e) => e.tagId === 'Higiena Cyfrowa'));

        // Full edit: rename tag & remap criteria from [1, cyberCrit.id] -> [4, cyberCrit.id]
        const editedTag = await apiReq(`/api/tags/${tagId}`, {
            method: 'PUT',
            userId: admin.id,
            body: {
                nazwa: 'Bezpieczeństwo Danych',
                kategoria: 'KOMPETENCYJNY',
                opis: 'RODO i procedury IT',
                criteriaIds: [4, cyberCrit.id],
            },
        });
        assert.equal(editedTag.status, 200);
        assert.equal(editedTag.data.tag.nazwa, 'Bezpieczeństwo Danych');
        assert.deepEqual(editedTag.data.tag.criteriaIds, [4, cyberCrit.id]);

        const wsAfterEdit = await apiReq(`/api/users/${katarzynaId}/workspace`, { userId: marek.id });
        const updatedTask = wsAfterEdit.data.activeEvaluation.tasks.find((x) => x.id === taskId);
        assert.equal(updatedTask.tags[0].tag_nazwa, 'Bezpieczeństwo Danych');
        assert.ok(wsAfterEdit.data.tagSummariesByCriterion[4].entries.some((e) => e.tagId === 'Bezpieczeństwo Danych'));
        assert.equal(wsAfterEdit.data.tagSummariesByCriterion[1].entries.some((e) => e.tagId === 'Bezpieczeństwo Danych'), false);

        // Non-destructive delete (archive): disappears from dictionaries & blocked for new tasks, ZERO loss of past data
        const deletedTag = await apiReq(`/api/tags/${tagId}`, {
            method: 'DELETE',
            userId: admin.id,
        });
        assert.equal(deletedTag.status, 200);
        assert.equal(deletedTag.data.archived, true);
        assert.equal(deletedTag.data.tag.czy_aktywny, false);
        assert.equal(deletedTag.data.tag.usageCount, 1);

        const dictAfterDelete = await apiReq('/api/dictionaries');
        assert.equal(dictAfterDelete.data.tags.some((t) => t.id === tagId), false);

        // Assigning archived tag to a new task is rejected with 400
        const assignArchived = await apiReq(`/api/tasks/${taskId}/tags`, {
            method: 'POST',
            userId: marek.id,
            body: { tag_id: tagId, polaryzacja: '+', komentarz: 'Nie powinno się udać' },
        });
        assert.equal(assignArchived.status, 400);

        // Historical task tag AND Wizard summary remain 100% preserved
        const wsAfterDelete = await apiReq(`/api/users/${katarzynaId}/workspace`, { userId: marek.id });
        const preservedTask = wsAfterDelete.data.activeEvaluation.tasks.find((x) => x.id === taskId);
        assert.equal(preservedTask.tags.length, 1);
        assert.equal(preservedTask.tags[0].tag_nazwa, 'Bezpieczeństwo Danych');
        assert.equal(preservedTask.tags[0].tag_czy_aktywny, false);
        assert.equal(wsAfterDelete.data.tagSummariesByCriterion[cyberCrit.id].posCount, 1);

        // Restore tag -> reappears in dictionaries & can be assigned again
        const restoredTag = await apiReq(`/api/tags/${tagId}/restore`, {
            method: 'PATCH',
            userId: admin.id,
        });
        assert.equal(restoredTag.status, 200);
        assert.equal(restoredTag.data.restored, true);
        assert.equal(restoredTag.data.tag.czy_aktywny, true);

        const dictAfterRestore = await apiReq('/api/dictionaries');
        assert.ok(dictAfterRestore.data.tags.some((t) => t.id === tagId));

        const assignRestored = await apiReq(`/api/tasks/${taskId}/tags`, {
            method: 'POST',
            userId: marek.id,
            body: { tag_id: tagId, polaryzacja: '+', komentarz: 'Po przywróceniu tagu' },
        });
        assert.equal(assignRestored.status, 201);
    });
});
