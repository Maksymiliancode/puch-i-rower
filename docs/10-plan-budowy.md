# 10. Plan budowy

Każdy etap kończy się wersją zainstalowaną na iPhonie użytkownika i krótką listą: co działa, jak to sprawdzić.

## Etap 0. Szkielet (pół dnia)

- Pytania startowe z `docs/08-platforma.md`, decyzja o platformie.
- Projekt, PWA z ikoną, działa offline, wdrożony pod stały adres.
- Wczytanie `data/*.json` do katalogu treningów; testy, że każdy trening ma poprawne `rx` i segmenty.
- **Gotowe:** aplikacja otwiera się z ekranu początkowego iPhone'a bez internetu i pokazuje listę treningów.

## Etap 1. Timer rowerowy + ustawienia stref

- Ustawienia: FTP, LTHR, faza.
- Karta treningu i timer według `docs/07-timer.md`.
- Zapis stanu timera i wznowienie.
- **Gotowe:** użytkownik robi na Keiserze trening „Podjazd siłowy” z telefonu na kierownicy. Waty liczą się z FTP 290, są sygnały przed zmianą i ekran nie gaśnie (albo jest jasny komunikat, że może zgasnąć).

## Etap 2. Dziennik + kopie

- Baza (IndexedDB), import `history_seed.json` przy pierwszym uruchomieniu.
- Po timerze: szybki wpis wyników (W / bieg / tętno dla bloków), RPE, notatka; podpowiedź nazwy do Garmina.
- Ręczny wpis dowolnej aktywności z datą wstecz.
- Lista i edycja wpisów, eksport i import JSON, eksport dla Claude.
- **Gotowe:** w dzienniku jest historia od 7.11.2026 i nowe jazdy z watami. Kopię da się odtworzyć na czystej instalacji.

## Etap 3. Nogi na puch

- Ekran treningu siłowego: rozgrzewka, 8 ćwiczeń z animacjami (przeniesione z `reference/nogi-na-puch.html`), serie i tempo dla fazy, pola ciężar × powtórzenia z poprzednim wynikiem jako podpowiedzią, odhaczanie, timer przerwy, core, zapis.
- Siła krótka.
- **Gotowe:** użytkownik robi Nogi na puch z telefonem na siłowni i widzi swoje ciężary z poprzedniego razu.

## Etap 4. Tydzień i „Co teraz?”

- Algorytm z `docs/04-logika-planowania.md` jako czyste funkcje + testy (wszystkie przypadki z sekcji 4).
- Ekran Dziś z kartą „Co teraz?”, ekran Tydzień ze slotami, planowaniem na dni, przesuwaniem, zamianą i pomijaniem.
- Tygodnie lżejsze.
- **Gotowe:** przy nieregularnym tygodniu (wyjazd, zamiana roweru na góry) aplikacja sensownie podpowiada następny trening i pokazuje, czego brakuje w tygodniu.

## Etap 5. Postęp i import z Garmina

- Wykresy: waty w strefie 2 vs tętno, podjazd siłowy, ciężary, historia FTP, liczba slotów na tydzień.
- Kreator testu FTP (W10).
- Import CSV z Garmina.

## Etap 6 (opcjonalnie). Natywnie

- Capacitor albo SwiftUI: tętno z pasa Polar przez Bluetooth zapisywane w trakcie timera, haptyka, zapis do Apple Zdrowie, ewentualnie Strava.
