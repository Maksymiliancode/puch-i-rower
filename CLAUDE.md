# Instrukcje dla Claude: budowa aplikacji „Puch i Rower”

Budujesz osobistą aplikację treningową na iPhone'a dla jednej osoby, Maksa. W tym folderze jest wszystko, co ustaliliśmy w rozmowie z Claude na claude.ai: plan sezonu, treningi, reguły planowania, profil i historia. Ty projektujesz i piszesz kod, ale **treść treningową bierzesz z plików, nie wymyślasz jej**.

## Najpierw przeczytaj, w tej kolejności

1. `docs/01-wizja-i-wymagania.md`: po co ta aplikacja i co ma umieć.
2. `docs/08-platforma.md`: technologia. **Decyzja już zapadła: Windows + aplikacja webowa (PWA).** Zapytaj tylko o konto GitHub. Na Windowsie przeprowadź użytkownika przez instalację Node.js i Git, krok po kroku.
3. `docs/10-plan-budowy.md`: etapy i kryteria „gotowe”.
4. Pozostałe dokumenty w `docs/` w miarę potrzeby oraz dane w `data/`.
5. `reference/`: dwie działające strony HTML z claude.ai. To wzór zachowania (timer, planer tygodnia, animacje ćwiczeń), a nie kod do skopiowania w całości.

## Zasady

- **Interfejs po polsku**, prosty język, telefon w pionie, duże cyfry w timerze. Użytkownik patrzy na ekran w trakcie jazdy na rowerze.
- **Treść treningowa jest ustalona.** Serie, czasy, waty w % FTP, kadencje i wskazówki pochodzą z `data/*.json`. Nie zmieniaj ich i nie dodawaj nowych treningów bez pytania. Jeśli czegoś brakuje (np. program siłowy na wiosnę, oznaczony jako „do ustalenia”), zapytaj.
- **Wszystkie liczby osobiste są edytowalne w ustawieniach:** FTP, próg tętna, tętno maks., próg tętna spoczynkowego, daty faz i wydarzeń. Waty i tętno w treningach liczą się z nich na bieżąco.
- **Historia to najcenniejsze dane.** Przechowuj lokalnie i trwale, z eksportem i importem JSON od pierwszego etapu. Nigdy nie kasuj wpisów bez potwierdzenia. Zaimportuj `data/history_seed.json` przy pierwszym uruchomieniu.
- **Logika domenowa oddzielona od UI:** strefy, wyliczanie celów segmentu, planer tygodnia i propozycja „co teraz” to czyste funkcje z testami jednostkowymi. Ułatwi to późniejsze przeniesienie do wersji natywnej.
- **Offline.** Aplikacja działa bez internetu (siłownia, góry, wyjazd).
- **Małe kroki.** Każdy etap z `docs/10-plan-budowy.md` kończ działającą wersją, którą użytkownik może zainstalować na telefonie i sprawdzić. Po każdym etapie krótko powiedz, co działa i jak to sprawdzić.
- **Nie przesadzaj z integracjami.** Bluetooth, HealthKit, Strava i import z Garmina są na później (etapy 5+). Najpierw timer, dziennik i planer.
- Użytkownik nie jest programistą. Komendy podawaj gotowe do wklejenia, wyjaśniaj krótko i bez żargonu.

## Słowniczek

- **FTP**: moc progowa w watach. Tu mierzona na konkretnym rowerze Keiser M3; jego waty są szacowane i nieporównywalne z innymi rowerami.
- **LTHR**: próg tętna na rowerze (163 na start).
- **Faza**: okres sezonu (P1–P5 w `data/season.json`). Wyznacza wersję każdego treningu (`rx`).
- **Slot**: miejsce w tygodniu o danej kategorii (siła nóg, długi tlen, pod górę…). Treningi wypełniają sloty, a różne treningi są wymienne w ramach kategorii.
- **Nogi na puch**: program siłowy nóg pod splitboard.
