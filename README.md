# Cyfrowy Asystent Ocen Okresowych w Służbie Cywilnej (HackNation 2026)

Aplikacja wspierająca cały ustawowy proces ocen okresowych w służbie cywilnej (Rozporządzenie z 4 kwietnia 2016 r.) — od rozmowy wstępnej, wyznaczania kryteriów i zdarzeń kadrowych, przez dziennik obserwacji z tagami kompetencyjnymi i dobrostanowymi (Wirtualny HR Partner), po kreator oceny ze Split-Screenem uzasadnienia, dwustronne e-podpisy, sprzeciwy do Dyrektora oraz wnioski o stopień służbowy.

---

## 1. Pełne uruchomienie z bazą PostgreSQL (Docker Compose)

Wymagany Docker + Docker Compose:

```bash
cp .env.example .env
docker compose up -d --build
```

Aplikacja będzie dostępna pod adresem: **http://localhost/**

Przydatne komendy:
```bash
# Reset bazy danych do czystego stanu demonstracyjnego
docker compose exec -T app npm run db:reset

# Testy jednostkowe i integracyjne
cd app && npm run test:unit
cd app && API_BASE_URL=http://localhost npm run test:api
```

---

## 2. Podgląd samego UI bez Dockera i bez bazy danych (dla współpracowników)

Jeśli nie masz zainstalowanego Dockera ani PostgreSQL, aplikacja automatycznie przełączy się w **tryb podglądu UI (wbudowana baza demonstracyjna w przeglądarce / `localStorage`)** z przyciskiem **„Resetuj dane demo”** w górnym pasku.

Wybierz **jedną** z poniższych opcji (bez `npm install` i bez konfiguracji):

### Opcja A — Python 3 (wbudowany w macOS / Linux / większość Windows)
```bash
python3 -m http.server 8080 -d app/public
```
Otwórz w przeglądarce: **http://localhost:8080/**

### Opcja B — VS Code (Live Server)
1. Zainstaluj rozszerzenie **Live Server** w VS Code.
2. Kliknij prawym przyciskiem myszy plik `app/public/index.html` i wybierz **Open with Live Server**.

### Opcja C — Node.js (bez `npm install`)
```bash
node app/preview-server.js
```
Otwórz w przeglądarce: **http://127.0.0.1:8080/**

> **Wskazówka:** Możesz też wymusić tryb lokalny przy działającym Dockerze, dopisując `?mock=1` do adresu (np. `http://localhost/?mock=1`).
