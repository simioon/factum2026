-- ============================================================================
-- SCHEMAT BAZY DANYCH: SYSTEM OCEN OKRESOWYCH W SŁUŻBIE CYWILNEJ (PostgreSQL)
-- ============================================================================

-- 1. UŻYTKOWNICY (Oceniani, Oceniający, Kadry, Dyrektor Generalny)
CREATE TABLE uzytkownicy (
    id SERIAL PRIMARY KEY,
    imie_nazwisko VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    arkusz CHAR(1) CHECK (arkusz IN ('A', 'B', 'C')), -- NULL to dyrektor generalny lub admin
    rola VARCHAR(20) CHECK (rola IN ('OCENIANY', 'OCENIAJACY', 'DYREKTOR', 'ADMIN')),
    haslo_hash VARCHAR(255) NOT NULL,
    aktualny_stopien_sluzbowy INT NOT NULL DEFAULT 0 CHECK (aktualny_stopien_sluzbowy BETWEEN 0 AND 9),
    nazwa_stanowiska VARCHAR(100) NOT NULL,
    komorka_organizacyjna VARCHAR(100) NOT NULL,
    przelozony_id INT REFERENCES uzytkownicy(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SŁOWNIK KRYTERIÓW OCENY (Konfiguracja zależna od przepisów i arkusza) 
-- jakie kryteria są wymagane w danym arkuszu oceny (A, B, C) i czy są obowiązkowe czy dodatkowe
CREATE TABLE slownik_kryteriow (
    id SERIAL PRIMARY KEY,
    nazwa VARCHAR(150) NOT NULL,
    opis TEXT NOT NULL,
    czy_aktywne BOOLEAN DEFAULT TRUE
);

CREATE TABLE arkusz_kryteria (
    id SERIAL PRIMARY KEY,
    kod_arkusza CHAR(1) CHECK (kod_arkusza IN ('A', 'B', 'C')),
    kryterium_id INT NOT NULL REFERENCES slownik_kryteriow(id) ON DELETE RESTRICT,
    typ_kryterium VARCHAR(20) NOT NULL CHECK (typ_kryterium IN ('OBOWIAZKOWE', 'DODATKOWE')),
    UNIQUE (kod_arkusza, kryterium_id)
);

-- 3. OCENY OKRESOWE (Główna tabela procesu)
CREATE TABLE oceny_okresowe (
    id SERIAL PRIMARY KEY,
    pracownik_id INT NOT NULL REFERENCES uzytkownicy(id) ON DELETE RESTRICT,
    oceniajacy_id INT NOT NULL REFERENCES uzytkownicy(id) ON DELETE RESTRICT,
    typ_arkusza CHAR(1) NOT NULL CHECK (typ_arkusza IN ('A', 'B', 'C')),
    
    -- Obsługa ponownego sporządzania oceny po sprzeciwie
    numer_podejscia INT NOT NULL DEFAULT 1 CHECK (numer_podejscia >= 1),
    poprzednia_ocena_id INT REFERENCES oceny_okresowe(id) ON DELETE SET NULL,
    
    -- Maszyna stanów procesu
    status VARCHAR(40) NOT NULL DEFAULT 'WYZNACZANIE_KRYTERIOW' CHECK (status IN (
        'WYZNACZANIE_KRYTERIOW',
        'OCZEKIWANIE_NA_PODPIS_KRYTERIOW',
        'W_TRAKCIE_OKRESU',
        'PRZED_ROZMOWA_OCENIAJACA',
        'SPORZADZONA_DO_PODPISU',
        'ZAKONCZONA',
        'ODWOLANIE_W_TOKU',
        'UNIEWAZNIONA'
    )),
    
    -- Daty i terminy ustawowe
    data_rozpoczecia_cyklu DATE NOT NULL,
    termin_wyznaczenia_kryteriow DATE NOT NULL, -- +30 dni lub +7 dni (po ocenie negatywnej)
    data_rozmowy_wstepnej DATE,
    planowana_data_oceny DATE NOT NULL,         -- domyślnie +24 miesiące, przesuwane przez zdarzenia kadrowe
    data_rozmowy_oceniajacej DATE,
    data_zapoznania_z_ocena DATE,               -- start biegu 7 dni na sprzeciw
    
    -- Treść merytoryczna arkusza i wyniki
    oczekiwania_i_cele TEXT,
    srednia_punktow NUMERIC(3,2),
    poziom_oceny VARCHAR(40) CHECK (poziom_oceny IN (
        'ZNACZNIE_POWYZEJ_OCZEKIWAN',
        'POWYZEJ_OCZEKIWAN',
        'NA_POZIOMIE_OCZEKIWAN',
        'PONIZEJ_OCZEKIWAN',
        'ZNACZNIE_PONIZEJ_OCZEKIWAN'
    )),
    wynik_ogolny VARCHAR(15) CHECK (wynik_ogolny IN ('POZYTYWNA', 'NEGATYWNA')),
    uzasadnienie_oceny TEXT,
    wnioski_iprz TEXT,
    
    -- Elektroniczne potwierdzenia (podpisy w systemie)
    podpis_kryteria_oceniajacy_at TIMESTAMP,
    podpis_kryteria_oceniany_at TIMESTAMP,
    podpis_ocena_oceniajacy_at TIMESTAMP,
    podpis_ocena_oceniany_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. WYNIKI CZĄSTKOWE KRYTERIÓW (5-6 obowiązkowych + 0-3 dodatkowych)
CREATE TABLE ocena_kryteria_wyniki (
    id SERIAL PRIMARY KEY,
    ocena_id INT NOT NULL REFERENCES oceny_okresowe(id) ON DELETE CASCADE,
    kryterium_id INT NOT NULL REFERENCES slownik_kryteriow(id) ON DELETE RESTRICT,
    punkty INT CHECK (punkty IN (1, 3, 5, 7, 9)), -- ustawowa skala pięciostopniowa
    komentarz_czastkowy TEXT,
    
    -- Zapobiega przypisaniu tego samego kryterium dwa razy do jednej oceny
    UNIQUE (ocena_id, kryterium_id)
);

-- 5. ZADANIA, UNIWERSALNE TAGI (+/-) I MAPOWANIE NA KRYTERIA

-- Słownik uniwersalnych tagów (komunikacja, zadania, zarządzanie + dobrostan)
CREATE TABLE slownik_tagow (
    id SERIAL PRIMARY KEY,
    nazwa VARCHAR(60) UNIQUE NOT NULL,        -- np. '#JasnyPrzekaz', '#Przeciążenie'
    kategoria VARCHAR(40) NOT NULL CHECK (kategoria IN (
        'KOMPETENCYJNY',
        'DOBROSTAN'                           -- nie obniża oceny, odpala alerty HR Partnera
    )),
    opis TEXT,
    czy_aktywny BOOLEAN DEFAULT TRUE
);

-- Relacja wiele-do-wielu: które kryteria zasila dany tag
CREATE TABLE tag_kryteria (
    tag_id INT NOT NULL REFERENCES slownik_tagow(id) ON DELETE CASCADE,
    kryterium_id INT NOT NULL REFERENCES slownik_kryteriow(id) ON DELETE CASCADE,
    PRIMARY KEY (tag_id, kryterium_id)
);

-- Zadania / obserwacje dodawane przez przełożonego w trakcie 24 miesięcy
CREATE TABLE zadania_obserwacje (
    id SERIAL PRIMARY KEY,
    ocena_id INT NOT NULL REFERENCES oceny_okresowe(id) ON DELETE CASCADE,
    autor_id INT NOT NULL REFERENCES uzytkownicy(id) ON DELETE RESTRICT,
    tytul VARCHAR(200) NOT NULL,
    opis TEXT,
    data_zdarzenia DATE NOT NULL DEFAULT CURRENT_DATE,
    widocznosc VARCHAR(20) NOT NULL DEFAULT 'OBIE_STRONY' CHECK (widocznosc IN (
        'TYLKO_MENEDZER',
        'OBIE_STRONY'
    )),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Przypisane tagi (+/-) wraz z komentarzem do konkretnego zadania
CREATE TABLE zadanie_tagi (
    id SERIAL PRIMARY KEY,
    zadanie_id INT NOT NULL REFERENCES zadania_obserwacje(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES slownik_tagow(id) ON DELETE RESTRICT,
    polaryzacja CHAR(1) NOT NULL CHECK (polaryzacja IN ('+', '-')),
    komentarz TEXT
);


-- 6. ZDARZENIA KADROWE (Nieobecności, zmiany stanowiska przesuwające termin oceny)
CREATE TABLE zdarzenia_kadrowe (
    id SERIAL PRIMARY KEY,
    ocena_id INT NOT NULL REFERENCES oceny_okresowe(id) ON DELETE CASCADE,
    typ_zdarzenia VARCHAR(50) NOT NULL CHECK (typ_zdarzenia IN (
        'NIEOBECNOSC_POWYZEJ_MIESIACA',
        'ZMIANA_STANOWISKA',
        'ZMIANA_OCENIAJACEGO',
        'INNE'
    )),
    data_od DATE NOT NULL,
    data_do DATE,
    dni_przesuniecia_terminu INT NOT NULL DEFAULT 0 CHECK (dni_przesuniecia_terminu >= 0),
    opis TEXT
);
-- ^to jest ważne do notowania bo przesówa termin oceny, np. w przypadku długiej nieobecności pracownika lub zmiany stanowiska.

-- 7. SPRZECIWY I ODWOŁANIA OD OCENY
CREATE TABLE sprzeciwy_odwolania (
    id SERIAL PRIMARY KEY,
    ocena_id INT NOT NULL REFERENCES oceny_okresowe(id) ON DELETE CASCADE,
    data_zlozenia DATE NOT NULL,
    uzasadnienie_pracownika TEXT NOT NULL,
    termin_rozpatrzenia DATE NOT NULL,
    decyzja_dyrektora VARCHAR(35) NOT NULL DEFAULT 'OCZEKUJE' CHECK (decyzja_dyrektora IN (
        'OCZEKUJE',
        'ODRZUCONY',
        'UWZGLEDNIONY_ZMIANA',
        'UWZGLEDNIONY_PONOWNA_OCENA',
        'NIEROZPATRZONY_W_TERMINIE'
    )),
    uzasadnienie_decyzji TEXT,
    data_decyzji DATE
);

-- 8. WNIOSKI O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO (Urzędnicy SC)
CREATE TABLE wnioski_stopien_sluzbowy (
    id SERIAL PRIMARY KEY,
    ocena_id INT NOT NULL REFERENCES oceny_okresowe(id) ON DELETE CASCADE,
    tryb_przyznania VARCHAR(20) NOT NULL CHECK (tryb_przyznania IN ('FAKULTATYWNY', 'OBLIGATORYJNY')),
    wnioskowany_stopien INT NOT NULL CHECK (wnioskowany_stopien BETWEEN 2 AND 9),
    umotywowanie_przelozonego TEXT,
    status_decyzji VARCHAR(20) NOT NULL DEFAULT 'OCZEKUJE' CHECK (status_decyzji IN (
        'OCZEKUJE',
        'ZATWIERDZONY',
        'ODRZUCONY'
    )),
    motywacja_dyrektora TEXT,
    data_decyzji DATE
);

-- ============================================================================
-- INDEKSY PRZYSPIESZAJĄCE ZAPYTANIA W APLIKACJI
-- ============================================================================
CREATE INDEX idx_uzytkownicy_przelozony ON uzytkownicy(przelozony_id);
CREATE INDEX idx_oceny_pracownik ON oceny_okresowe(pracownik_id);
CREATE INDEX idx_oceny_oceniajacy ON oceny_okresowe(oceniajacy_id);
CREATE INDEX idx_oceny_status ON oceny_okresowe(status);
CREATE INDEX idx_wyniki_ocena ON ocena_kryteria_wyniki(ocena_id);
CREATE INDEX idx_zadania_ocena ON zadania_obserwacje(ocena_id);
CREATE INDEX idx_zadanie_tagi_zadanie ON zadanie_tagi(zadanie_id);
CREATE INDEX idx_zadanie_tagi_tag ON zadanie_tagi(tag_id);