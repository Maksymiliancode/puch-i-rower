# 02. Sportowiec i sprzęt

Pełne dane są w `data/athlete.json`. Poniżej to, co ważne dla projektu aplikacji.

## Profil (stan na 24.11.2026)

| Parametr | Wartość | Status |
|---|---|---|
| FTP na Keiserze | 290 W | szacunek; test planowany 2.12.2026 |
| Próg tętna na rowerze (LTHR) | 163 | szacunek z jazd na zewnątrz |
| Próg tętna na nogach | ok. 167 | rower + 3–5 |
| Tętno maks. zanotowane | 191 (bieg), 190 (rower) | |
| Tętno spoczynkowe | 43–45, alarm ≥ 50 | |
| VO₂max (Garmin, bieg) | 57 | |

Strefy liczy się z FTP i LTHR według `data/zones.json`. Przy FTP 290 i LTHR 163 strefa 2 to 160–220 W i tętno 132–145.

## Sprzęt i co z niego mamy

- **Keiser M3, stary model bez Bluetooth.** Konsola pokazuje kadencję, waty, kcal, czas, bieg (1–24) i tętno z pasa Polar.
  - Waty są szacowane z biegu (pozycji magnesu) i kadencji. Według instrukcji dokładność to ±10%, ale wskazania są powtarzalne. Nadają się do śledzenia postępu na tym rowerze, a nie do porównań z innymi.
  - Średnie pokazują się po zatrzymaniu pedałowania na 3 sekundy. **Po 60 sekundach bez pedałowania wszystko się zeruje**, dlatego w przerwach trzeba lekko kręcić (timer może to przypominać).
  - Obserwacja z 24.11.2026: bieg 10 ≈ 180 W, bieg 12 ≈ 220 W przy około 85–90 rpm.
  - **Danych z Keisera nie da się pobrać automatycznie.** Użytkownik przepisuje je z konsoli do aplikacji, więc wpis musi być szybki (duże pola numeryczne, poprzednie wartości jako podpowiedź).
- **Pas Polar** nadaje jednocześnie do Keisera (5 kHz) i przez Bluetooth do zegarka.
- **Zegarek Garmin** nagrywa jazdę jako „Indoor Cycling”, ale zapisuje tylko czas i tętno. Synchronizuje się z Garmin Connect i Stravą. Zostaje w zestawie, bo z niego pochodzi tętno sekunda po sekundzie i obciążenie treningowe.
- **iPhone** na kierownicy pokazuje timer.

## Jak wygląda jazda dziś

Telefon z timerem na kierownicy, zegarek nagrywa „Indoor Cycling”, a konsola Keisera pokazuje waty, kadencję i bieg. Po jeździe użytkownik przepisuje średnie z konsoli. Aplikacja ma ten ostatni krok maksymalnie uprościć: po zakończeniu timera od razu ekran wpisu z polami dla bloków roboczych (np. „Powtórzenie 1: W / bieg / tętno”), wszystkie pola opcjonalne.

## Preferencje

- Krótkie, konkretne komunikaty. Timer ma pokazywać, co robić teraz i co będzie dalej.
- Na czczo robi tylko spokojne treningi (słodki napój w trakcie).
- Strefy w Garminie są ustawione od HRmax 195; aplikacja liczy według LTHR. Nie mieszać tych systemów w UI.
