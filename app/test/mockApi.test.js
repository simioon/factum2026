const test = require('node:test');
const assert = require('node:assert/strict');

test('Offline mockApi reproduces full evaluation, HR event, visibility, appeal, and rank workflows', async (t) => {
    const { mockApi, resetMockDb } = await import('../public/js/mockApi.js');
    resetMockDb();

    let users;
    let marek;
    let jan;
    let admin;
    let anna;
    let tomasz;
    let dictionaries;

    await t.test('1. Dictionaries and seeded users', async () => {
        dictionaries = await mockApi.getDictionaries();
        assert.equal(dictionaries.criteria.length, 14);
        assert.equal(dictionaries.tags.length, 16);

        const usersRes = await mockApi.getUsers();
        users = usersRes.users;
        assert.equal(users.length, 5);

        marek = users.find((u) => u.rola === 'DYREKTOR');
        jan = users.find((u) => u.imie_nazwisko === 'Jan Kowalski');
        admin = users.find((u) => u.rola === 'ADMIN');
        anna = users.find((u) => u.imie_nazwisko === 'Anna Nowak');
        tomasz = users.find((u) => u.imie_nazwisko === 'Tomasz Mazur');
        assert.ok(marek && jan && admin && anna && tomasz);
    });

    await t.test('2. Admin creates user & reassigns evaluator (logs ZMIANA_OCENIAJACEGO)', async () => {
        const created = await mockApi.createUser(
            {
                imie_nazwisko: 'Katarzyna Kaczmarek',
                nazwa_stanowiska: 'Specjalista ds. Prawnych',
                arkusz: 'C',
                rola: 'OCENIANY',
                aktualny_stopien_sluzbowy: 1,
                przelozony_id: jan.id,
            },
            admin.id
        );
        assert.ok(created.activeEvaluation);

        const reassigned = await mockApi.changeEvaluator(created.user.id, marek.id, admin.id);
        assert.equal(reassigned.user.przelozony_id, marek.id);
        assert.equal(reassigned.loggedEvent.typ_zdarzenia, 'ZMIANA_OCENIAJACEGO');
    });

    await t.test('3. Setup >3 additional criteria rejected + two-sided e-signatures', async () => {
        const ws = await mockApi.getWorkspace(tomasz.id, jan.id);
        const evalId = ws.activeEvaluation.id;

        await assert.rejects(
            () => mockApi.saveSetup(evalId, { additionalCriteriaIds: [2, 3, 5, 7], signByEvaluator: false }, jan.id),
            (err) => err.status === 400
        );

        const signedMgr = await mockApi.saveSetup(
            evalId,
            {
                data_rozmowy_wstepnej: '2026-11-20',
                oczekiwania_i_cele: 'Poprawa terminowości.',
                additionalCriteriaIds: [7, 2],
                signByEvaluator: true,
            },
            jan.id
        );
        assert.equal(signedMgr.evaluation.status, 'OCZEKIWANIE_NA_PODPIS_KRYTERIOW');

        const signedEmp = await mockApi.signCriteria(evalId, tomasz.id);
        assert.equal(signedEmp.evaluation.status, 'W_TRAKCIE_OKRESU');
    });

    await t.test('4. HR events shift and revert planowana_data_oceny', async () => {
        const ws = await mockApi.getWorkspace(tomasz.id, jan.id);
        const evalId = ws.activeEvaluation.id;
        const origDate = ws.activeEvaluation.planowana_data_oceny;

        const addRes = await mockApi.createHrEvent(
            evalId,
            {
                typ_zdarzenia: 'NIEOBECNOSC_POWYZEJ_MIESIACA',
                data_od: '2026-12-01',
                data_do: '2027-01-14',
                opis: 'L4',
            },
            jan.id
        );
        assert.equal(addRes.event.dni_przesuniecia_terminu, 45);
        assert.notEqual(addRes.planowana_data_oceny, origDate);

        const delRes = await mockApi.deleteHrEvent(addRes.event.id, jan.id);
        assert.equal(delRes.planowana_data_oceny, origDate);
    });

    await t.test('5. Visibility filtering & DOBROSTAN polarity enforcement', async () => {
        const ws = await mockApi.getWorkspace(tomasz.id, jan.id);
        const evalId = ws.activeEvaluation.id;
        const priv = await mockApi.createTask(
            evalId,
            { tytul: 'Prywatna obserwacja', widocznosc: 'TYLKO_MENEDZER' },
            jan.id
        );
        const wellbeingTag = dictionaries.tags.find((tg) => tg.nazwa === 'Przeciążenie');
        const tagRes = await mockApi.addTagToTask(
            priv.task.id,
            { tag_id: wellbeingTag.id, polaryzacja: '+', komentarz: 'Alert' },
            jan.id
        );
        assert.equal(tagRes.taskTag.polaryzacja, '-');

        const empWs = await mockApi.getWorkspace(tomasz.id, tomasz.id);
        assert.equal(empWs.activeEvaluation.tasks.some((x) => x.id === priv.task.id), false);
        for (const t of empWs.activeEvaluation.tasks) {
            for (const tg of t.tags) {
                assert.ok(tg.tag_nazwa && tg.tag_nazwa.length > 0);
            }
        }
    });

    await t.test('5b. Batch tagging on task creation & existing task + atomic rejection', async () => {
        const ws = await mockApi.getWorkspace(tomasz.id, jan.id);
        const evalId = ws.activeEvaluation.id;
        const tJasny = dictionaries.tags.find((tg) => tg.nazwa === 'Jasny Przekaz');
        const tTerm = dictionaries.tags.find((tg) => tg.nazwa === 'Terminowość I Priorytety');
        const tWell = dictionaries.tags.find((tg) => tg.nazwa === 'Nadgodziny');

        const created = await mockApi.createTask(
            evalId,
            {
                tytul: 'Wpis z wsadowym tagowaniem',
                widocznosc: 'OBIE_STRONY',
                tags: [
                    { tag_id: tJasny.id, polaryzacja: '+' },
                    { tag_id: tTerm.id, polaryzacja: '-' },
                    { tag_id: tWell.id, polaryzacja: '+' },
                ],
                komentarz: 'Wspólna notatka wyjaśniająca.',
            },
            jan.id
        );
        assert.equal(created.task.tags.length, 3);
        assert.equal(created.task.tags[2].polaryzacja, '-');
        assert.equal(created.task.tags[0].komentarz, 'Wspólna notatka wyjaśniająca.');

        const taskId = created.task.id;
        const batchRes = await mockApi.addTagToTask(
            taskId,
            {
                tags: [
                    { tag_id: tJasny.id, polaryzacja: '-' },
                    { tag_id: tTerm.id, polaryzacja: '+' },
                ],
                komentarz: 'Druga notatka.',
            },
            jan.id
        );
        assert.equal(batchRes.taskTags.length, 2);

        await assert.rejects(
            () => mockApi.addTagToTask(taskId, { tags: [], komentarz: 'Pusty' }, jan.id),
            (err) => err.status === 400
        );

        await assert.rejects(
            () =>
                mockApi.addTagToTask(
                    taskId,
                    {
                        tags: [
                            { tag_id: tJasny.id, polaryzacja: '+' },
                            { tag_id: 999999, polaryzacja: '+' },
                        ],
                        komentarz: 'Rollback',
                    },
                    jan.id
                ),
            (err) => err.status === 400
        );

        const afterWs = await mockApi.getWorkspace(tomasz.id, jan.id);
        const savedTask = afterWs.activeEvaluation.tasks.find((x) => x.id === taskId);
        assert.equal(savedTask.tags.length, 5);
    });

    await t.test('6. Negative evaluation requires justification', async () => {
        const ws = await mockApi.getWorkspace(tomasz.id, jan.id);
        const scores = Object.fromEntries(ws.activeEvaluation.criteria.map((c) => [c.kryterium_id, 3]));
        await assert.rejects(
            () => mockApi.finalizeEvaluation(ws.activeEvaluation.id, { scores, uzasadnienie_oceny: '' }, jan.id),
            (err) => err.status === 400
        );
    });

    await t.test('7. Anna Nowak finalize -> acknowledge -> auto rank promotion + next cycle', async () => {
        const ws = await mockApi.getWorkspace(anna.id, jan.id);
        const scores = Object.fromEntries(ws.activeEvaluation.criteria.map((c) => [c.kryterium_id, 7]));

        const fin = await mockApi.finalizeEvaluation(
            ws.activeEvaluation.id,
            { scores, uzasadnienie_oceny: 'Bardzo dobre wyniki.' },
            jan.id
        );
        assert.equal(fin.evaluation.status, 'SPORZADZONA_DO_PODPISU');
        assert.equal(fin.autoRankPromotionPending, true);

        const ack = await mockApi.acknowledgeEvaluation(ws.activeEvaluation.id, anna.id);
        assert.equal(ack.evaluation.status, 'ZAKONCZONA');
        assert.equal(ack.autoRankPromoted, true);
        assert.equal(ack.newRank, 3);
        assert.ok(ack.nextEvaluation);
    });

    await t.test('8. Appeal -> Director UWZGLEDNIONY_PONOWNA_OCENA -> attempt 2', async () => {
        const ws = await mockApi.getWorkspace(anna.id, anna.id);
        const completed = ws.pastEvaluations.find((e) => e.status === 'ZAKONCZONA');
        const ap = await mockApi.createAppeal(completed.id, { uzasadnienie_pracownika: 'Sprzeciw testowy' }, anna.id);
        const dec = await mockApi.decideAppeal(
            ap.appeal.id,
            { decyzja_dyrektora: 'UWZGLEDNIONY_PONOWNA_OCENA', uzasadnienie_decyzji: 'Zgoda' },
            marek.id
        );
        assert.equal(dec.evaluation.status, 'UNIEWAZNIONA');
        assert.equal(dec.newEvaluation.numer_podejscia, 2);
    });

    await t.test('9. Director requests correction -> evaluator notification data is available', async () => {
        const ws = await mockApi.getWorkspace(tomasz.id, jan.id);
        const scores = Object.fromEntries(ws.activeEvaluation.criteria.map((c) => [c.kryterium_id, 7]));
        const finalized = await mockApi.finalizeEvaluation(
            ws.activeEvaluation.id,
            { scores, uzasadnienie_oceny: 'Wyniki zgodne z oczekiwaniami.' },
            jan.id
        );
        const completed = await mockApi.acknowledgeEvaluation(finalized.evaluation.id, tomasz.id);
        const appeal = await mockApi.createAppeal(
            completed.evaluation.id,
            { uzasadnienie_pracownika: 'Wnoszę o zmianę oceny.' },
            tomasz.id
        );

        const decision = await mockApi.decideAppeal(
            appeal.appeal.id,
            { decyzja_dyrektora: 'UWZGLEDNIONY_ZMIANA', uzasadnienie_decyzji: 'Proszę poprawić punktację.' },
            marek.id
        );
        assert.equal(decision.evaluation.status, 'PRZED_ROZMOWA_OCENIAJACA');
        assert.equal(decision.evaluation.podpis_ocena_oceniajacy_at, null);

        const evaluatorAppeals = await mockApi.getAppeals(jan.id);
        const correction = evaluatorAppeals.appeals.find((item) => item.id === appeal.appeal.id);
        assert.equal(correction.evaluation_status, 'PRZED_ROZMOWA_OCENIAJACA');
        assert.equal(correction.oceniajacy_id, jan.id);
    });

    await t.test('10. Director approves Jan rank request & resetMockDb restores clean state', async () => {
        const rrList = await mockApi.getRankRequests(marek.id);
        const pending = rrList.rankRequests.find((r) => r.pracownik_id === jan.id && r.status_decyzji === 'OCZEKUJE');
        await assert.rejects(
            () => mockApi.decideRankRequest(pending.id, { status_decyzji: 'ODRZUCONY', motywacja_dyrektora: '  ' }, marek.id),
            (err) => err.status === 400
        );
        const dec = await mockApi.decideRankRequest(pending.id, { status_decyzji: 'ZATWIERDZONY' }, marek.id);
        assert.equal(dec.newRank, 5);
    });

    await t.test('11. Admin criteria management: CRUD, sheet rules, non-destructive archive & restore', async () => {
        await assert.rejects(() => mockApi.getAdminCriteria(jan.id), (err) => err.status === 403);
        await assert.rejects(
            () =>
                mockApi.createCriterion(
                    { nazwa: 'Bez arkuszy', opis: 'Opis', sheets: { A: null, B: null, C: null } },
                    admin.id
                ),
            (err) => err.status === 400
        );

        const created = await mockApi.createCriterion(
            {
                nazwa: 'Cyberbezpieczeństwo i ochrona danych',
                opis: 'Przestrzeganie zasad RODO.\nZgłaszanie incydentów.',
                sheets: { A: 'DODATKOWE', B: 'DODATKOWE', C: 'DODATKOWE' },
            },
            admin.id
        );
        const critId = created.criterion.id;

        const dict1 = await mockApi.getDictionaries();
        assert.ok(dict1.sheetCriteria.B.additionalIds.includes(critId));

        const janWs = await mockApi.getWorkspace(jan.id, marek.id);
        await mockApi.saveSetup(
            janWs.activeEvaluation.id,
            {
                data_rozmowy_wstepnej: '2026-01-25',
                oczekiwania_i_cele: 'Cyberbezpieczeństwo.',
                additionalCriteriaIds: [critId],
                signByEvaluator: false,
            },
            marek.id
        );

        const edited = await mockApi.updateCriterion(
            critId,
            {
                nazwa: 'Cyberbezpieczeństwo i RODO',
                opis: 'Polityka bezpieczeństwa.\nOchrona danych.',
                sheets: { A: null, B: 'DODATKOWE', C: 'DODATKOWE' },
            },
            admin.id
        );
        assert.equal(edited.criterion.sheets.A, null);

        const archived = await mockApi.deleteCriterion(critId, admin.id);
        assert.equal(archived.archived, true);
        assert.equal(archived.criterion.czy_aktywne, false);
        assert.ok(archived.criterion.usageCount >= 1);

        const dictAfter = await mockApi.getDictionaries();
        assert.equal(dictAfter.criteria.some((c) => c.id === critId), false);

        const janWsAfter = await mockApi.getWorkspace(jan.id, marek.id);
        const preserved = janWsAfter.activeEvaluation.criteria.find((c) => c.kryterium_id === critId);
        assert.ok(preserved);
        assert.equal(preserved.kryterium_czy_aktywne, false);

        const restored = await mockApi.restoreCriterion(critId, admin.id);
        assert.equal(restored.criterion.czy_aktywne, true);
    });

    await t.test('12. Admin tag management: create with criteria, full edit, non-destructive delete, restore & resetMockDb', async () => {
        await assert.rejects(() => mockApi.getAdminTags(jan.id), (err) => err.status === 403);
        await assert.rejects(
            () => mockApi.createTag({ nazwa: 'Pusty Tag', kategoria: 'KOMPETENCYJNY', criteriaIds: [] }, admin.id),
            (err) => err.status === 400
        );

        const wellTag = await mockApi.createTag(
            { nazwa: 'Wypalenie Testowe', kategoria: 'DOBROSTAN', opis: 'HR', criteriaIds: [1] },
            admin.id
        );
        assert.deepEqual(wellTag.tag.criteriaIds, []);

        const allCrit = await mockApi.getAdminCriteria(admin.id);
        const cyberCrit = allCrit.criteria.find((c) => c.nazwa === 'Cyberbezpieczeństwo i RODO');

        const created = await mockApi.createTag(
            {
                nazwa: 'Higiena Cyfrowa',
                kategoria: 'KOMPETENCYJNY',
                opis: 'RODO',
                criteriaIds: [1, cyberCrit.id],
            },
            admin.id
        );
        const tagId = created.tag.id;
        assert.deepEqual(created.tag.criteriaIds, [1, cyberCrit.id]);

        const janWs = await mockApi.getWorkspace(jan.id, marek.id);
        const taskRes = await mockApi.createTask(
            janWs.activeEvaluation.id,
            {
                tytul: 'Audyt RODO',
                tags: [{ tag_id: tagId, polaryzacja: '+' }],
                komentarz: 'Wzorowe wdrożenie.',
            },
            marek.id
        );
        const taskId = taskRes.task.id;

        const edited = await mockApi.updateTag(
            tagId,
            {
                nazwa: 'Bezpieczeństwo Danych',
                kategoria: 'KOMPETENCYJNY',
                opis: 'RODO i IT',
                criteriaIds: [4, cyberCrit.id],
            },
            admin.id
        );
        assert.equal(edited.tag.nazwa, 'Bezpieczeństwo Danych');

        const wsEdit = await mockApi.getWorkspace(jan.id, marek.id);
        assert.equal(wsEdit.activeEvaluation.tasks.find((x) => x.id === taskId).tags[0].tag_nazwa, 'Bezpieczeństwo Danych');
        assert.ok(wsEdit.tagSummariesByCriterion[4].entries.some((e) => e.tagId === 'Bezpieczeństwo Danych'));

        const archived = await mockApi.deleteTag(tagId, admin.id);
        assert.equal(archived.archived, true);
        assert.equal(archived.tag.usageCount, 1);

        const dictDel = await mockApi.getDictionaries();
        assert.equal(dictDel.tags.some((t) => t.id === tagId), false);

        await assert.rejects(
            () => mockApi.addTagToTask(taskId, { tag_id: tagId, polaryzacja: '+' }, marek.id),
            (err) => err.status === 400
        );

        const wsDel = await mockApi.getWorkspace(jan.id, marek.id);
        const preservedTask = wsDel.activeEvaluation.tasks.find((x) => x.id === taskId);
        assert.equal(preservedTask.tags.length, 1);
        assert.equal(preservedTask.tags[0].tag_czy_aktywny, false);
        assert.equal(wsDel.tagSummariesByCriterion[cyberCrit.id].posCount, 1);

        await mockApi.restoreTag(tagId, admin.id);
        const dictRestored = await mockApi.getDictionaries();
        assert.ok(dictRestored.tags.some((t) => t.id === tagId));

        resetMockDb();
        const freshUsers = await mockApi.getUsers();
        assert.equal(freshUsers.users.length, 5);
        assert.equal(freshUsers.users.find((u) => u.id === anna.id).rank, 2);
        const freshDict = await mockApi.getDictionaries();
        assert.equal(freshDict.criteria.length, 14);
        assert.equal(freshDict.tags.length, 16);
    });
});
