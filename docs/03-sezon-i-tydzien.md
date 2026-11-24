# 03. Sezon i tydzień

Dane: `data/season.json`.

## Fazy

| Faza | Daty | Siła (rx) | Rower (rx) | Rola roweru |
|---|---|---|---|---|
| P1 Fundament | 27.10 – 23.11.2026 | f1 | sm | okazjonalnie |
| P2 Siła i moc | 24.11 – 21.12.2026 | f2 | sm | 2× w tygodniu, najwyżej 3 |
| P3 Sezon skiturowy | 22.12.2026 – Alpy (~14.02.2027) | f3 | ss | 1–2×, tylko w tygodniach bez gór |
| P4 Po Alpach | 15.02 – 30.04.2027 | f3* | pr | 3–4×, główny trening |
| P5 Lato | 1.05 – 30.09.2027 | f3* | la | 3–5×, głównie na zewnątrz |

\* Program siłowy na P4 i P5 jest do ustalenia z użytkownikiem; na razie f3 i 1 trening w tygodniu.

Kolumny „rx” mówią, którą wersję treningu pokazać. Każdy trening w `data/*.json` ma `rx` z kluczami faz: rowerowe sm/ss/pr/la (`bike_rx`), siłowe i pozostałe (bieg, podejścia, góry) f1/f2/f3 (`strength_rx`). Trening może nie mieć wersji dla danej fazy (np. 30/15 jest tylko w pr/la). Wtedy w tej fazie jest niedostępny w propozycjach, ale da się go uruchomić ręcznie z katalogu z najbliższą dostępną wersją, z wyraźnym oznaczeniem.

Faza wynika z dzisiejszej daty, ale użytkownik może ją ręcznie przestawić w ustawieniach.

## Wydarzenia i tygodnie lżejsze

- Kurs lawinowy, Tatry: 15.01.2027. Tydzień lżejszy 8–14.01.
- Alpy: ~14.02.2027 (do potwierdzenia). Tydzień lżejszy 7–13.02.

W tygodniu lżejszym planer ma najwyżej 4 sloty, siła idzie połową serii z tym samym ciężarem, interwały są krótsze, a rower to tylko rozkręcenie i przetarcie.

## Idealny tydzień

`season.json → ideal_weeks` zawiera przykładowy rozkład dni dla każdej fazy rowerowej, np. P2:

| Pn | Wt | Śr | Cz | Pt | Sb | Nd |
|---|---|---|---|---|---|---|
| Nogi na puch | Rozkręcenie 30–45 | Podjazd siłowy / sweet spot | Bieg lub wolne | Siła krótka | Góry / długa jazda | Wolne / podejścia |

**Ważne:** dni są umowne. Użytkownik ma nieregularne tygodnie, więc źródłem prawdy jest **lista priorytetów (sloty)** z `planner_rules.json`, a nie dni. Idealny tydzień służy do domyślnego ułożenia zaplanowanych treningów na dni. Użytkownik przesuwa je i zamienia, a planer przelicza, co zostało.

## Sloty, czyli priorytety tygodnia (P1–P3)

1. Siła nóg (najważniejsze)
2. Długi tlen (najważniejsze)
3. Pod górę (najważniejsze)
4. Interwały
5. Spokojny tlen
6. Druga siła
7. Spokojny tlen
8. Pod górę
9. Regeneracja

Jeśli w tygodniu są tylko 2–3 treningi, niech to będą trzy pierwsze. Dla P4 i P5 sloty są inne (rower na pierwszym planie), patrz `planner_rules.json`.
