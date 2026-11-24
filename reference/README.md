# Pliki referencyjne

Dwie strony zbudowane w rozmowie z Claude na claude.ai i używane przez użytkownika. Otwórz je w przeglądarce, żeby zobaczyć zachowanie.

## rower-pod-puch-i-lato.html

- Strefy z FTP i LTHR, wybór fazy, przykładowy tydzień, katalog treningów rowerowych z wykresem przebiegu.
- **Timer** (sekcja `/* ---------- timer ---------- */`): pełny ekran, odliczanie oparte na znacznikach czasu, sygnały, Wake Lock, ±1 min, Wstecz/Dalej, ekran końcowy z nazwą do Garmina. To wzór dla `docs/07-timer.md`.
- Dane treningów w tym pliku są źródłem `data/workouts_bike.json` (wygenerowanym z tego kodu).

## nogi-na-puch.html

- Program siłowy z animowanymi ludzikami SVG (obiekt `FIG`: kinematyka odwrotna, klatki kluczowe, podpisy faz ruchu). Animacje warto przenieść 1:1 jako komponent.
- Profil sezonu (SVG z fazami), **planer tygodnia ze slotami** (`weekPlan`, `suggest`), katalog wymiennych treningów, dziennik.
- Strona używa przestrzeni `claude.use('db')` z claude.ai, której w Twojej aplikacji nie będzie. Zastąp ją lokalną bazą.
- Dane z tej strony są źródłem `data/workouts_strength.json`, `data/workouts_other.json` i `data/planner_rules.json`.

Nie kopiuj tych plików do aplikacji w całości. Przenieś zachowanie i treść do nowej struktury według `docs/`.
