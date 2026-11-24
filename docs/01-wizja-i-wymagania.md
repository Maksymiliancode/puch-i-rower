# 01. Wizja i wymagania

## Po co ta aplikacja

Maks przygotowuje się do sezonu skiturowo-splitboardowego (kurs lawinowy w Tatrach 15.01.2027, Alpy w połowie lutego 2027), a po nim do sezonu rowerowego latem 2027. Trenuje na siłowni („Nogi na puch”), na starym rowerze stacjonarnym Keiser M3, biega i chodzi po górach. Tygodnie ma **dynamiczne**: wyjazdy, zmienne dni, różna ilość czasu.

Aplikacja ma odpowiadać na trzy pytania:

1. **Co dziś zrobić?** Na podstawie fazy sezonu, tego, co już było w tym tygodniu i ostatnio, dostępnego czasu i miejsca.
2. **Jak to zrobić?** Prowadzi przez trening: timer rowerowy z celami w watach, tętnie i kadencji albo lista ćwiczeń siłowych z seriami.
3. **Co już zrobiłem?** Historia z wynikami (waty, bieg, ciężary), żeby widać było postęp i żeby plan się dopasowywał.

Jedna aplikacja na wszystko: rower, siła nóg, bieganie, góry i inne aktywności. Planowanie wymaga widoku całości, bo reguły łączą dyscypliny (np. „nie rób mocnego roweru dzień po Nogach na puch”).

## Wymagania funkcjonalne

### Must have (MVP)

- **W1. Timer rowerowy** dla każdego treningu z `data/workouts_bike.json`, w wersji dla bieżącej fazy. Specyfikacja w `docs/07-timer.md`.
- **W2. Dziennik.** Zapis każdego treningu i każdej aktywności: data, rodzaj, czas, odczucie (RPE 1–10), notatka. Dla roweru dodatkowo średnie waty, bieg, kadencja i tętno, całości i opcjonalnie każdego powtórzenia. Dla siły ciężar × powtórzenia dla kluczowych ćwiczeń. Wpis możliwy także wstecz, dla dowolnej daty.
- **W3. Nogi na puch.** Lista ćwiczeń z seriami, tempem i przerwą dla fazy, wskazówki i animacje (do przeniesienia z `reference/nogi-na-puch.html`), odhaczanie ćwiczeń, zapis ciężarów i timer przerw.
- **W4. Tydzień.** Widok bieżącego tygodnia ze slotami według priorytetu (`data/planner_rules.json`), tym, co zrobione, i tym, co zostało. Użytkownik może:
  - zamienić proponowany trening na inny z tej samej kategorii albo na dowolną aktywność (spacer, góry, bieg…);
  - przesunąć zaplanowany trening na inny dzień;
  - oznaczyć trening jako pominięty;
  - dodać coś poza planem.
- **W5. „Co teraz?”** Na ekranie głównym: podaj dostępny czas (30, 45, 60, 90, 120+ min albo dzień w górach) i co masz pod ręką (Keiser, siłownia, schody/bieżnia, góry, nic), opcjonalnie samopoczucie (świeże / ciężkie nogi, na czczo, tętno spoczynkowe). Aplikacja proponuje jeden trening z uzasadnieniem i 2–3 alternatywy. Algorytm w `docs/04-logika-planowania.md`.
- **W6. Ustawienia:** FTP, próg tętna na rowerze i na nogach, tętno maks., próg tętna spoczynkowego, daty faz, wydarzeń i tygodni lżejszych. Zmiana od razu przelicza waty i tętno we wszystkich treningach. Przy zmianie FTP aplikacja zachowuje historię wartości (data, wartość, źródło).
- **W7. Kopia danych:** eksport i import całej bazy do pliku JSON, plus eksport „dla Claude” (`docs/09-dane-z-zewnatrz.md`).
- **W8. Działa offline**, instaluje się na ekranie początkowym iPhone'a.

### Should have

- **W9. Postęp:** wykresy watów w strefie 2 przy podobnym tętnie, watów w podjazdach siłowych, ciężarów w przysiadzie, RDL i bułgarskim, historia FTP.
- **W10. Test FTP:** po teście wpisujesz średnie waty z 20 minut i średnie tętno z ostatnich 10 minut, a aplikacja proponuje nowe FTP (95%) i próg tętna i pyta, czy zapisać.
- **W11. Tydzień lżejszy:** automatycznie ograniczony do 4 slotów, z połową serii w sile.
- **W12. Ściąga Keisera:** zapamiętane biegi dla stref („Z2: bieg 11–12 przy 90 rpm”), uczone z dziennika.

### Could have (później)

- Import z Garmina (CSV albo FIT), żeby biegi i góry same trafiały do historii.
- Natywnie: tętno z pasa Polar przez Bluetooth, zapis do Apple Zdrowie, wysyłka na Stravę.
- Powiadomienia („jutro test, zjedz śniadanie”).

## Wymagania niefunkcjonalne

- Telefon w pionie; timer czytelny z odległości ramion na kierownicy: duże cyfry, wysoki kontrast, jasny i ciemny motyw.
- Ekran nie gaśnie w trakcie timera, jeśli platforma na to pozwala; w przeciwnym razie aplikacja wyraźnie o tym mówi.
- Timer liczy na podstawie znaczników czasu, a nie zliczanych tyknięć, więc po wygaszeniu ekranu wraca we właściwe miejsce.
- Zero kont i logowania w MVP. Dane lokalnie plus pliki kopii.
- Polski interfejs i polskie formaty dat.
