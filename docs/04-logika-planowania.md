# 04. Logika planowania

Dane: `data/planner_rules.json`. Wzór działającej implementacji to funkcje `weekPlan()` i `suggest()` w `reference/nogi-na-puch.html`. Ta specyfikacja je rozszerza o rower, czas, miejsce i więcej reguł zmęczenia.

## 1. Model

- **Kategorie:** sila, dlugi, gora, mocny, luz, sila2, regen (nazwy w `categories`).
- **Sloty tygodnia:** uporządkowana lista kategorii dla fazy (`slots_by_phase`). Pierwsze `core_slots` (3) są najważniejsze.
- **Trening wypełnia sloty** według `covers`: lista „jednostek”, z których każda to lista kategorii do wyboru. Przykłady:
  - `b_z2` ma `[["dlugi","luz"]]`: jedna jednostka, wypełnia długi tlen albo spokojny tlen.
  - `m_day` (góry) ma `[["dlugi"],["gora"]]`: dwie jednostki, wypełnia naraz długi tlen i pod górę.
  - `s_upper` ma `[]`: nie wypełnia slotów, ale jest w historii.
- **Preferencje:** dla każdej fazy i kategorii uporządkowana lista treningów (`preferences_by_phase`). Pierwszy to domyślna propozycja, reszta to zamienniki.

## 2. Plan tygodnia (tydzień od poniedziałku do niedzieli)

1. Weź treningi z dziennika z tego tygodnia.
2. Rozłóż ich jednostki `covers` na sloty fazy **dopasowaniem maksymalnym w grafie dwudzielnym** (jak `weekPlan()` w wzorcu). Jednostki z mniejszą liczbą alternatyw idą pierwsze. Slot o wyższym priorytecie jest dopasowywany wcześniej.
3. Treningi, których jednostki nie trafiły w żaden slot, pokaż jako „dodatkowo w tym tygodniu”.
4. Tydzień lżejszy: tylko pierwsze `light_week_max_slots` (4) slotów.
5. Wynik: lista slotów ze statusem (zrobiony: czym i kiedy / wolny: zamienniki) plus licznik „najważniejsze trzy: x z 3”.

Treningi **zaplanowane** (przypisane do dni, ale niezrobione) pokazuj osobno, na dniach tygodnia. Liczą się do slotów dopiero po zapisaniu jako zrobione.

## 3. „Co teraz?”: propozycja treningu

Wejście: data, dostępny czas (min), co jest pod ręką (wielokrotny wybór: `keiser_m3`, `silownia`, `schody_lub_bieznia`, `gory`; nic = wyjazd bez sprzętu), opcjonalnie: nogi ciężkie, na czczo, tętno spoczynkowe dziś.

Wersja treningu (`rx`): dla rowerowych klucz `bike_rx` fazy (sm/ss/pr/la), dla siłowych i pozostałych `strength_rx` (f1/f2/f3), obie z `season.json → phases`.

Kroki:

1. **Wolne sloty** z planu tygodnia, w kolejności priorytetu.
2. **Kandydaci** dla każdego wolnego slotu: treningi z preferencji fazy dla tej kategorii. Te, których jeszcze nie było w tym tygodniu, idą pierwsze.
3. **Filtry twarde:**
   - sprzęt (`equipment`): cała lista musi być dostępna; pusta lista oznacza „wszędzie” (`planner_rules.json → location_fit`);
   - czas: trening musi się zmieścić. Treningi z segmentami mają `total_min`. Treningi z `duration_min_range` (np. 75–120 min) skracaj do dostępnego czasu, ale nie poniżej dolnej granicy. Rozgrzewka i schłodzenie zostają, skraca się główny odcinek;
   - faza: trening musi mieć `rx` dla bieżącej fazy;
   - na czczo: ukryj `not_fasted=true`.
4. **Reguły zmęczenia** (`fatigue_rules`), zastosowane do kandydatów:
   - `hard_after_hard`: jeśli dziś albo wczoraj był trening z `intensity_hard`, proponuj lekki. Jeśli dla najwyższego wolnego slotu nie ma lekkiej opcji, weź następny slot i napisz, że ten mocny lepiej zrobić jutro;
   - `legs_spacing`: mocny rower nie dzień przed ani dzień po treningu z `legs_load = heavy`. „Dzień przed” sprawdzaj z zaplanowanych treningów;
   - `test_spacing`: test FTP najwcześniej 48 h po `legs_load = heavy`, nie na czczo;
   - `rhr`: tętno spoczynkowe ≥ progu dwa dni z rzędu oznacza tylko spokojne treningi;
   - `after_mountains`: dzień po górach rozkręcenie, mobilność albo wolne;
   - ciężkie nogi zaznaczone przez użytkownika działają jak `hard_after_hard`.
5. **Rotacja w P2:** jakość rowerowa na zmianę podjazd siłowy i sweet spot. Wybierz ten, którego nie było w poprzednim tygodniu.
6. **Wynik:** jedna propozycja + 2–3 alternatywy (inne kategorie albo zamienniki) + **krótkie uzasadnienie po polsku**, np. „Siła nóg to najważniejszy slot tygodnia, a ostatni mocny trening był 2 dni temu”. Jeśli żadna reguła nie przepuszcza niczego sensownego, zaproponuj odpoczynek albo mobilność i powiedz dlaczego.
7. **Tydzień zrobiony** (wszystkie sloty pełne): „Odpocznij”, opcjonalnie lekko (b_easy, mob).

Użytkownik zawsze może wybrać coś innego. Zapisuje się to, co zrobił, a nie to, co proponowano. Do wpisu warto dodać `planned_id`, żeby było widać różnicę.

## 4. Przypadki testowe (zrób z nich testy jednostkowe)

Daty z historii startowej, FTP 290, LTHR 163.

1. **Śr 25.11.2026, 90 min, tylko Keiser, nogi świeże.** Wczoraj było b_intro (lekki). W tygodniu (od 23.11) jest tylko b_intro, które wypełnia „luz”. Oczekiwane: slot „Siła nóg” jest pierwszy, ale miejsce to Keiser, więc odpada. Następny jest „Długi tlen” → **b_z2** (75–90 min). Uzasadnienie wspomina, że to najważniejszy slot możliwy na rowerze.
2. **Czw 26.11, 75 min, siłownia.** Wczoraj b_z2 (lekki). Oczekiwane: **s_puch** (P2, wersja f2).
3. **Pt 27.11, 45 min, wyjazd bez sprzętu.** Wczoraj s_puch (heavy). W „Pod górę” i „Interwały” zostają tylko mocne opcje (r_hills), a wczoraj był mocny trening, więc planer schodzi do „Spokojny tlen”. Oczekiwane: **r_easy** (wersja f2: 40–55 min, skrócony do 45) z dopiskiem, że podbiegi lepiej zrobić innego dnia.
4. **Pn 30.11, 60 min, tylko Keiser.** Nowy tydzień, ostatni heavy był 26.11. Oczekiwane: „Siła nóg” odpada (brak siłowni), b_z2 nie mieści się w 60 min (dolna granica 75), w „Pod górę” h_pack odpada (brak schodów/bieżni), więc **b_torque** (wersja sm, ok. 56 min). Zgadza się to z rotacją P2: w poprzednim tygodniu nie było podjazdu siłowego.
5. **Śr 2.12, 60 min, Keiser, po śniadaniu.** Jeśli test zaplanowany → **b_test** (ok. 53 min). Ten sam dzień „na czczo” → test ukryty, propozycja b_z2.
6. **Dzień po s_puch, Keiser, 60 min.** Nie proponuj b_sst, b_vo2, b_torque ani b_test. Zaproponuj b_easy albo b_z2.
7. **Tydzień 11–17.01.2027 (lżejszy 8–14.01).** Plan tygodnia 8–14 ma maksymalnie 4 sloty.
8. **Tętno spoczynkowe 51 i 52 w dwóch kolejnych dniach.** Tylko treningi z `intensity_hard=false`.
