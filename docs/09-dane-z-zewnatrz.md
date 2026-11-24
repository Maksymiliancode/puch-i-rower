# 09. Dane z zewnątrz

## Co jest dostępne

| Źródło | Co daje | Jak | Kiedy w aplikacji |
|---|---|---|---|
| Konsola Keiser M3 | waty, bieg, kadencja, tętno (średnie po 3 s bez pedałowania) | ręczny wpis | MVP |
| Zegarek Garmin | tętno, czas, dystans, przewyższenie, biegi, góry | eksport CSV listy aktywności (connect.garmin.com → Aktywności → Wszystkie → Eksportuj CSV), plik FIT pojedynczej aktywności (koło zębate → eksport oryginału), pełny eksport konta (zip) | import CSV: etap 5 |
| Strava | aktywności (także jazdy latem) | API Stravy (OAuth, darmowe dla własnej aplikacji) | później, wymaga backendu do OAuth albo PKCE |
| Apple Zdrowie | treningi i dane z Garmina, jeśli użytkownik włączył synchronizację | HealthKit, tylko natywnie | później (B/C) |
| Pas Polar | tętno na żywo | Bluetooth Heart Rate, tylko natywnie | później (B/C) |

Oficjalne API Garmina jest dostępne dla firm (program partnerski), więc w tej aplikacji używaj plików eksportu.

## Import CSV z Garmina (etap 5)

- Użytkownik wybiera plik CSV w aplikacji.
- Mapowanie typu aktywności: Running → `r_easy` (zapytaj, gdy w nazwie są podbiegi), Hiking / Walking z dużym przewyższeniem → `m_day` albo `h_pack`, Indoor Cycling → zapytaj, który trening rowerowy (z listy zaplanowanych na ten dzień), Strength → `s_puch` albo `s_upper` (zapytaj).
- Duplikaty: ten sam dzień, rodzaj i czas trwania ±10% → scal z istniejącym wpisem (uzupełnij tętno i czas, nie nadpisuj watów).
- Kolumny CSV różnią się między wersjami i językami Garmin Connect. Zrób mapowanie odporne na nazwy (PL i EN) i pokaż podgląd przed zapisem.

## Eksport dla Claude

Przycisk **„Eksport dla Claude”** w ustawieniach zapisuje plik `puch-i-rower-AAAA-MM-DD.json` (albo kopiuje go do schowka):

```json
{
  "kind": "puch-i-rower/claude-export", "schemaVersion": 1, "exportedAt": "...",
  "settings": { "ftpW": 290, "ftpHistory": [], "lthrBike": 163, "phase": "P2" },
  "last42days": { "sessions": [], "planned": [], "morning": [] },
  "weekSummary": [{ "week": "2026-11-23", "slotsDone": ["sila", "dlugi"], "hours": 4.5 }]
}
```

Użytkownik wrzuca ten plik do rozmowy z Claude na claude.ai, żeby omówić postęp i zmienić plan. Gdy Claude zmieni treningi, odda zaktualizowane pliki `data/*.json` do podmiany.
