# 07. Timer rowerowy

Działający wzór: `reference/rower-pod-puch-i-lato.html`. Otwórz plik w przeglądarce, wpisz FTP 290 i naciśnij „Uruchom timer” przy dowolnym treningu. Kod timera jest w sekcji `/* ---------- timer ---------- */`. Użytkownik używał go na telefonie i jest z niego zadowolony. Zachowaj układ i zachowanie, popraw technicznie.

## Dane wejściowe

Segmenty z `workouts_bike.json → rx[faza].segments`: `sec`, `pct_ftp`, `label`, `cadence`, `cue`, `rep`, `set`, `after_rep`.

## Ekran (telefon w pionie, od góry)

1. Nazwa treningu; czas: upłynęło / całość / zostało.
2. Mini wykres całego treningu z pionowym znacznikiem bieżącej pozycji.
3. Karta segmentu w kolorze strefy:
   - „Powtórzenie 2 z 4”, „Seria 1 z 3 · po powtórzeniu 5 z 13” (z `rep`/`set`/`after_rep`);
   - nazwa segmentu (np. „Podjazd siłowy”);
   - **duże odliczanie mm:ss** (ok. 25–30% szerokości ekranu na cyfrę), czerwone w ostatnich 3 s;
   - pasek postępu segmentu.
4. Trzy kafelki celów: **Moc** (zakres W albo % FTP bez FTP), **Tętno**, **Kadencja**. Przy niskiej kadencji (strefa tempo w podjeździe siłowym) wyróżniona jest kadencja, w pozostałych moc. Reguły zakresów: `zones.json → timer_target_rule`.
5. Wskazówka (`cue`).
6. „Dalej: Przerwa · 3 min · 110–145 W · kad. 90”.
7. Przyciski: **◀ Wstecz** (pierwsze 5 s segmentu: poprzedni segment; później: początek bieżącego), **Start/Pauza/Wznów**, **Dalej ▶**.
8. Drugi rząd: **−1 min**, **+1 min** (zmienia długość bieżącego segmentu, nie mniej niż upłynęło + 5 s), **Dźwięk wł./wył.**, **Zakończ** (dwa naciśnięcia).
9. Podpowiedź na dole: przed startem „Włącz na zegarku Rower stacjonarny”; gdy nie udało się utrzymać włączonego ekranu, wskazówka o autoblokadzie.

## Zachowanie

- Odliczanie na znacznikach czasu (`performance.now()` / `Date`), nie na zliczaniu tyknięć. Po powrocie z tła przeskocz tyle segmentów, ile minęło.
- 3 krótkie sygnały (ok. 1040 Hz, 110 ms) w ostatnich 3 sekundach segmentu ≥ 10 s; dłuższy sygnał przy zmianie segmentu; melodyjka na koniec. Audio inicjowane przy pierwszym naciśnięciu Start (wymóg iOS).
- Wibracje tam, gdzie platforma pozwala (Safari na iOS nie obsługuje Vibration API; w wersji natywnej użyj haptyki).
- Blokada wygaszania ekranu (Screen Wake Lock w przeglądarce / `isIdleTimerDisabled` natywnie), wznawiana po powrocie z tła.
- Opcjonalny głos zapowiadający segment: „Podjazd siłowy. 6 minut. 220 do 250 watów. Kadencja 55 do 65”.
- **Stan timera zapisywany co kilka sekund**, żeby po przypadkowym zamknięciu aplikacji dało się wznowić trening.
- Przypomnienie w przerwach dłuższych niż 45 s: „Kręć lekko, Keiser zeruje się po minucie bez pedałowania”.

## Po zakończeniu

1. Ekran „Trening zrobiony”.
2. **Szybki wpis wyników:** dla każdego bloku roboczego (segmenty z `rep`) pola W / bieg / tętno, plus średnie całości z konsoli Keisera (instrukcja: „przestań pedałować na 3 s, konsola pokaże średnie”) i RPE. Pola numeryczne z klawiaturą liczbową, podpowiedzi z poprzedniego razu.
3. Zapis do dziennika.
4. Podpowiedź nazwy do Garmin Connect z `garmin_title` i średnimi watami, np. „Podjazd siłowy 4×6 min kad 60 · 238 W”, z przyciskiem Kopiuj.
