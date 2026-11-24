# 08. Platforma

> **Decyzja użytkownika (24.11.2026): komputer z Windows, aplikacja webowa (PWA) dodana do ekranu początkowego iPhone'a.** Nie pytaj o Maca ani o konto Apple Developer. Zapytaj tylko, czy ma konto GitHub (do hostingu), i pomóż je założyć, jeśli nie ma.

## Zapytaj na start

Zanim cokolwiek zainstalujesz, zapytaj użytkownika:

1. Na jakim komputerze pracujesz: Mac czy Windows?
2. Czy masz płatne konto Apple Developer (99 USD rocznie)? Czy jesteś gotów je założyć?
3. Czy masz konto GitHub (potrzebne do darmowego hostingu wersji webowej)?

Potem zaproponuj ścieżkę według tabeli i poczekaj na zgodę.

## Opcje

| | A. Aplikacja webowa instalowana na iPhonie (PWA) | B. Natywna aplikacja (SwiftUI) | C. PWA opakowana natywnie (Capacitor) |
|---|---|---|---|
| Komputer | dowolny (Mac albo Windows) | **tylko Mac** z Xcode | Mac do budowy na iOS |
| Koszt | 0 zł (hosting np. GitHub Pages, Cloudflare Pages, Netlify) | darmowe konto Apple: aplikacja wygasa po 7 dniach i trzeba ją ponownie wgrać z Xcode; 99 USD/rok: TestFlight, bez wygasania | jak B |
| Instalacja na telefonie | Safari → Udostępnij → Do ekranu początkowego | z Xcode przez kabel albo TestFlight | jak B |
| Offline | tak (service worker) | tak | tak |
| Timer, dźwięk | tak; dźwięk po pierwszym dotknięciu | tak, także w tle | tak |
| Ekran nie gaśnie | Screen Wake Lock w Safari (sprawdź działanie w trybie „Do ekranu początkowego” na wersji iOS użytkownika) | tak | tak |
| Wibracje | **brak** w Safari | haptyka | haptyka |
| Tętno z pasa Polar przez Bluetooth | **nie** (Safari nie ma Web Bluetooth) | tak (CoreBluetooth, profil Heart Rate) | tak, wtyczką |
| Apple Zdrowie | nie | tak (HealthKit) | tak, wtyczką |
| Szybkość pierwszej wersji | najszybciej | wolniej | średnio |

## Rekomendacja

**Zacznij od A (PWA)**, jeśli nie ma wyraźnego powodu na B:

- działa z każdego komputera, nic nie kosztuje i nie wygasa;
- wszystkie funkcje MVP (timer, dziennik, planer, offline) działają w przeglądarce;
- Bluetooth i HealthKit na razie nie są potrzebne: tętno i tak zapisuje zegarek Garmin, a Keiser niczego nie wysyła;
- logika domenowa w czystym TypeScripcie przeniesie się później do C (Capacitor) bez przepisywania.

Przejdź na C albo B, gdy użytkownik zechce, żeby telefon sam nagrywał tętno z pasa i zastąpił zegarek, albo żeby trening trafiał do Apple Zdrowie.

## Stos dla A (propozycja)

- Vite + TypeScript + React albo Preact (lekko) albo Svelte.
- IndexedDB przez Dexie (dziennik, plany, ustawienia) + `navigator.storage.persist()`.
- Service worker (np. vite-plugin-pwa), manifest z ikoną, `display: standalone`.
- Testy jednostkowe (Vitest) dla: stref, celów segmentu, planu tygodnia, „co teraz”. Przypadki z `docs/04-logika-planowania.md`.
- Hosting: GitHub Pages albo Cloudflare Pages z automatycznym wdrożeniem z gałęzi main.

## Ryzyka do sprawdzenia na prawdziwym iPhonie

- Trwałość danych w aplikacji dodanej do ekranu początkowego. Mimo to od pierwszego etapu kopie przez eksport JSON i przypomnienie raz w tygodniu.
- Dźwięk przy wyciszonym telefonie (przełącznik wyciszenia blokuje Web Audio): pokaż ostrzeżenie w timerze.
- Wake Lock i powrót z tła.
