# Puch i Rower: paczka do zbudowania aplikacji

Ten folder zawiera wszystko, czego Claude potrzebuje, żeby zbudować Twoją aplikację treningową na iPhone'a: plan sezonu, treningi rowerowe z timerem, „Nogi na puch”, reguły planowania tygodnia, Twoje strefy i historię treningów.

## Jak tego użyć

1. Rozpakuj folder na komputerze.
2. Zainstaluj Claude Code (aplikacja Claude na komputerze, zakładka Code, albo terminal) i otwórz w nim ten folder.
3. Napisz do Claude:

   > Przeczytaj CLAUDE.md i zbuduj aplikację według planu. Zacznij od pytań startowych.

4. Wybrana technologia: aplikacja webowa (Windows + iPhone, bez opłat). Claude zapyta o konto GitHub, pomoże zainstalować potrzebne narzędzia i zbuduje aplikację etapami. Po każdym etapie sprawdzasz ją na telefonie.

## Co jest w środku

| Plik | Co zawiera |
|---|---|
| `CLAUDE.md` | Instrukcje dla Claude, który buduje aplikację |
| `docs/01-wizja-i-wymagania.md` | Po co aplikacja i co ma umieć |
| `docs/02-sportowiec-i-sprzet.md` | Twój profil, Keiser M3, Polar, Garmin |
| `docs/03-sezon-i-tydzien.md` | Fazy, wydarzenia, idealne tygodnie |
| `docs/04-logika-planowania.md` | Jak aplikacja wybiera, co robić dziś |
| `docs/05-model-danych.md` | Jak zapisywać treningi i ustawienia |
| `docs/06-ekrany.md` | Ekrany aplikacji |
| `docs/07-timer.md` | Timer na rower, szczegółowo |
| `docs/08-platforma.md` | Aplikacja webowa czy natywna, koszty, wymagania |
| `docs/09-dane-z-zewnatrz.md` | Garmin, Keiser, Strava, Apple Zdrowie, eksport dla Claude |
| `docs/10-plan-budowy.md` | Etapy budowy i kryteria „gotowe” |
| `data/*.json` | Treningi, fazy, strefy, reguły, profil i historia jako dane |
| `reference/*.html` | Dwie działające strony z claude.ai: timer rowerowy i „Nogi na puch” |

## Uruchomienie na komputerze

W folderze projektu (PowerShell):

```powershell
npm install
npm run dev
```

Aplikacja otworzy się pod adresem `http://localhost:5173`. `npm run check` sprawdza typy, styl kodu i testy, `npm run build` buduje wersję do publikacji.

Na iPhonie pełne działanie (offline, ekran nie gaśnie, instalacja na ekranie początkowym) wymaga adresu `https://`, czyli wersji opublikowanej na GitHub Pages.

## Wymaga uzupełnienia

- Data wyjazdu w Alpy (przyjęto 14.02.2027).
- Program siłowy na wiosnę i lato (na razie wersja z fazy „Utrzymanie”).
- Wynik testu FTP (planowany 2.12.2026); na razie FTP 290 W jako szacunek.
