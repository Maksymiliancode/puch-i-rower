import { useState } from 'react';
import { href } from '../../app/route';
import { useSettings } from '../../app/settings';
import { Icon } from '../../components/Icon';
import { db, deleteSession } from '../../data/db';
import { prettyDate } from '../../domain/format';
import { addDays, CATEGORY_LABEL, CORE_SLOTS, lightWeekFor, mondayOf, suggest, weekPlan, type Context, type Item } from '../../domain/planner';
import { todayIso } from '../../domain/season';
import type { Equipment, Planned, Session } from '../../domain/types';
import { FAMILY_LABEL, workoutMeta, type Family } from '../../domain/workouts';
import { AddEntry } from './AddEntry';
import { DayTile } from './DayTile';
import { EQUIPMENT_OPTIONS, familyOfWorkout, famStyle, shortName, weekdayName } from './common';
import { SummaryCard } from './SummaryCard';
import { usePlanDays } from './usePlanDays';
import './plan.css';

export function PlanScreen({ focus }: { focus?: string }) {
  const { settings, save } = useSettings();
  const data = usePlanDays();
  const [selected, setSelected] = useState(focus ?? todayIso());
  const [month, setMonth] = useState((focus ?? todayIso()).slice(0, 7));
  const [adding, setAdding] = useState(false);

  if (!data) return <main className="page" aria-busy="true" />;
  const { today, sessions, planned, done, ahead, equipment, base, phaseFor, days } = data;

  // Zamiana kafelka: propozycje dla dnia z pominięciem tego, co na nim jest teraz.
  const alternativesFor = (date: string) => {
    const before = days.filter((d) => d.date < date);
    const virtual: Item[] = [...done, ...before.flatMap((d) => [...d.planned.map((p) => ({ ...p, planned: false })), ...(d.suggestion?.pick ? [{ date: d.date, workoutId: d.suggestion.pick.workoutId }] : [])])];
    const later = ahead.filter((p) => p.date > date);
    const ctx: Context = { ...base, date, phase: phaseFor(date), items: [...virtual, ...later] };
    return suggest(ctx);
  };

  const arrangeWeek = async () => {
    const rows: Planned[] = days
      .filter((d) => d.suggestion?.pick && d.date >= today)
      .map((d) => ({ id: crypto.randomUUID(), date: d.date, workoutId: d.suggestion!.pick!.workoutId, status: 'planned' as const }));
    await db.planned.bulkPut(rows);
  };

  const clearPlan = async () => {
    const future = planned.filter((p) => p.status === 'planned' && p.date >= today);
    if (!future.length) return;
    if (!window.confirm(`Usunąć ${future.length} zaplanowanych treningów od dziś? Historia zrobionych treningów zostaje.`)) return;
    await db.planned.bulkDelete(future.map((p) => p.id));
  };

  const toggleEq = (e: Equipment) => {
    const next = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
    void save({ planner: { equipment: next } });
  };

  // Tydzień zawierający wybrany dzień.
  const wkMon = mondayOf(selected);
  const wkSun = addDays(wkMon, 6);
  const light = lightWeekFor(selected, settings.lightWeeks);
  const wkItems = [...done, ...ahead.filter((p) => p.date >= today)].filter((i) => i.date >= wkMon && i.date <= wkSun);
  const wp = weekPlan(wkItems, phaseFor(selected).id, !!light);
  const core = wp.filledBy.slice(0, CORE_SLOTS);
  const coreDone = core.filter((x) => x && !x.planned).length;
  const corePlanned = core.filter((x) => x?.planned).length;

  return (
    <main className="page plan">
      <header className="page-head">
        <h1 className="page-title">Plan</h1>
        <p className="muted">Propozycje liczą się z tego, co już zrobione w tym tygodniu, i z reguł zmęczenia. Zamień dowolny dzień, a kolejne dopasują się same.</p>
      </header>

      <section className="stack" aria-labelledby="next-h">
        <h2 id="next-h" className="section-title">
          Najbliższe dni
        </h2>
        <ul className="days">
          {days.map((d) => (
            <DayTile key={d.date} day={d} today={today} alternativesFor={alternativesFor} />
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => void arrangeWeek()} disabled={!days.some((d) => d.suggestion?.pick)}>
            <Icon name="calendar" />
            Zaplanuj wszystkie propozycje
          </button>
          <button type="button" className="btn" onClick={() => void clearPlan()}>
            Wyczyść plan
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="eq-h">
        <h2 id="eq-h">Co zwykle masz pod ręką</h2>
        <div className="chips" role="group" aria-labelledby="eq-h">
          {EQUIPMENT_OPTIONS.map((o) => (
            <button key={o.id} type="button" className="chip chip-text" aria-pressed={equipment.includes(o.id)} onClick={() => toggleEq(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="hint">Bieg, mobilność i spacer są możliwe zawsze. Na dziś możesz to zmienić w karcie „Co teraz?” na ekranie Dziś.</p>
      </section>

      <SummaryCard sessions={sessions} month={month} today={today} phases={settings.phases} phaseId={phaseFor(today).id} />

      <Calendar
        month={month}
        setMonth={setMonth}
        today={today}
        selected={selected}
        onSelect={(d) => {
          setSelected(d);
          setAdding(false);
        }}
        sessions={sessions}
        planned={planned}
      />

      <DayPanel date={selected} today={today} sessions={sessions} planned={planned} adding={adding} setAdding={setAdding} />

      <section className="card" aria-labelledby="week-h">
        <h2 id="week-h">
          Tydzień {prettyDate(wkMon)} – {prettyDate(wkSun)}
        </h2>
        {light && <p className="notice">Tydzień lżejszy {light.reason}: najwyżej 4 treningi, siła połową serii.</p>}
        <p className="hint">
          Tak wygląda idealny tydzień w tej fazie: rodzaje treningów od najważniejszego. Każdy zrobiony albo zaplanowany trening zajmuje jedno miejsce. „Do zrobienia” to miejsce, którego jeszcze nic nie wypełnia — nie
          oznacza dnia wolnego.
        </p>
        <p className="num week-core">
          Najważniejsze trzy: <b>{coreDone}</b> z {CORE_SLOTS} zrobione
          {corePlanned > 0 && <span className="muted"> · {corePlanned} w planie</span>}
        </p>
        <ol className="slots">
          {wp.slots.map((s, i) => {
            const by = wp.filledBy[i];
            const state = !by ? 'todo' : by.planned ? 'planned' : 'done';
            return (
              <li key={i} className="slot" data-state={state} data-core={i < CORE_SLOTS || undefined}>
                <span className="slot-icon" aria-hidden="true">
                  {state === 'done' && <Icon name="check" size={18} />}
                  {state === 'planned' && <Icon name="calendar" size={18} />}
                </span>
                <span className="slot-cat">
                  {CATEGORY_LABEL[s.c]}
                  {i < CORE_SLOTS && <span className="visually-hidden"> (jeden z trzech najważniejszych)</span>}
                </span>
                <span className="slot-by">
                  {by ? (
                    <>
                      <span className="slot-what">{shortName(by.workoutId)}</span>
                      <span className="slot-when">
                        {state === 'done' ? 'zrobione' : 'w planie'}, {weekdayName(by.date)}
                      </span>
                    </>
                  ) : (
                    'do zrobienia'
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <ul className="slot-legend" aria-label="Legenda">
          <li data-state="done">
            <Icon name="check" size={16} /> zrobione
          </li>
          <li data-state="planned">
            <Icon name="calendar" size={16} /> w planie
          </li>
          <li data-state="todo">do zrobienia</li>
        </ul>
        {wp.extra.length > 0 && <p className="muted">Dodatkowo: {wp.extra.map((e) => shortName(e.workoutId)).join(', ')}.</p>}
      </section>
    </main>
  );
}

// ---------- kalendarz ----------
const monthFmt = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

function shiftMonth(ym: string, n: number): string {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

interface Mark {
  fam: Family;
  planned: boolean;
  label: string;
}

function Calendar(props: {
  month: string;
  setMonth: (m: string) => void;
  today: string;
  selected: string;
  onSelect: (d: string) => void;
  sessions: Session[];
  planned: Planned[];
}) {
  const { month, setMonth, today, selected, onSelect, sessions, planned } = props;
  const first = `${month}-01`;
  const start = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells[35].slice(0, 7) === month ? 6 : 5;
  const marks = new Map<string, Mark[]>();
  const add = (d: string, m: Mark) => marks.set(d, [...(marks.get(d) ?? []), m]);
  for (const s of sessions) if (s.kind !== 'rest') add(s.date, { fam: familyOfWorkout(s.workoutId, s.kind), planned: false, label: s.title });
  for (const p of planned) if (p.status === 'planned' && p.date >= today) add(p.date, { fam: familyOfWorkout(p.workoutId), planned: true, label: `plan: ${shortName(p.workoutId)}` });
  const count = sessions.filter((s) => s.date.startsWith(month) && s.kind !== 'rest').length;
  const famsInMonth = new Set(sessions.filter((s) => s.date.startsWith(month) && s.kind !== 'rest').map((s) => familyOfWorkout(s.workoutId, s.kind)));

  return (
    <section className="card cal" aria-labelledby="cal-h">
      <header className="cal-head">
        <button type="button" className="btn cal-nav" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Poprzedni miesiąc">
          <Icon name="back" />
        </button>
        <div>
          <h2 id="cal-h">{monthFmt.format(new Date(`${first}T12:00:00Z`))}</h2>
          <p className="muted num">{count} treningów</p>
        </div>
        <button type="button" className="btn cal-nav cal-nav--next" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Następny miesiąc">
          <Icon name="back" />
        </button>
      </header>
      <div className="cal-grid" role="grid" aria-labelledby="cal-h">
        <div role="row" className="cal-row">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="cal-wd">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: weeks }, (_, r) => (
          <div role="row" className="cal-row" key={r}>
            {cells.slice(r * 7, r * 7 + 7).map((d) => {
              const m = marks.get(d) ?? [];
              const out = d.slice(0, 7) !== month;
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  className="cal-day"
                  data-out={out || undefined}
                  data-today={d === today || undefined}
                  aria-selected={d === selected}
                  aria-label={`${weekdayName(d)} ${prettyDate(d)}${m.length ? ': ' + m.map((x) => x.label).join(', ') : ''}`}
                  onClick={() => onSelect(d)}
                >
                  <span className="cal-n num">{+d.slice(8)}</span>
                  <span className="cal-marks" aria-hidden="true">
                    {m.slice(0, 3).map((x, i) => (
                      <i key={i} style={famStyle(x.fam)} data-planned={x.planned || undefined} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {famsInMonth.size > 0 && (
        <ul className="cal-legend" aria-label="Legenda">
          {[...famsInMonth].map((f) => (
            <li key={f} style={famStyle(f)}>
              <i aria-hidden="true" />
              {FAMILY_LABEL[f]}
            </li>
          ))}
          <li style={famStyle('other')}>
            <i aria-hidden="true" data-planned />w planie
          </li>
        </ul>
      )}
    </section>
  );
}

// ---------- wybrany dzień ----------
function DayPanel(props: { date: string; today: string; sessions: Session[]; planned: Planned[]; adding: boolean; setAdding: (v: boolean) => void }) {
  const { date, today, sessions, planned, adding, setAdding } = props;
  const list = sessions.filter((s) => s.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const plans = planned.filter((p) => p.date === date && p.status === 'planned');

  const remove = async (s: Session) => {
    if (!window.confirm(`Usunąć z dziennika „${s.title}” z ${prettyDate(s.date)}? Tego nie da się cofnąć (chyba że masz kopię danych).`)) return;
    await deleteSession(s.id);
  };

  return (
    <section className="card day-panel" aria-labelledby="dp-h">
      <h2 id="dp-h">
        {date === today ? 'Dziś' : `${weekdayName(date)}`}, {prettyDate(date)}
      </h2>
      {list.length === 0 && plans.length === 0 && !adding && <p className="muted">{date > today ? 'Nic nie zaplanowane.' : 'Brak wpisu.'}</p>}
      {list.length > 0 && (
        <ul className="entries">
          {list.map((s) => (
            <li key={s.id} className="entry" style={famStyle(familyOfWorkout(s.workoutId, s.kind))}>
              <div>
                <b>{s.title}</b>
                <p className="muted num">
                  {[s.durationMin && `${s.durationMin} min`, s.distanceKm && `${String(s.distanceKm).replace('.', ',')} km`, s.bike?.avgW && `${s.bike.avgW} W`, s.avgHr && `tętno ${s.avgHr}`, s.rpe && `odczucie ${s.rpe}/10`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {s.notes && <p className="entry-note">{s.notes}</p>}
              </div>
              <button type="button" className="btn entry-del" onClick={() => void remove(s)} aria-label={`Usuń wpis ${s.title}`}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {plans.length > 0 && (
        <ul className="entries">
          {plans.map((p) => (
            <li key={p.id} className="entry entry--plan" style={famStyle(familyOfWorkout(p.workoutId))}>
              <div>
                <b>{p.workoutId ? workoutMeta(p.workoutId)?.name : 'Wolne'}</b>
                <p className="muted">w planie{p.note ? ` · ${p.note}` : ''}</p>
              </div>
              <button type="button" className="btn entry-del" onClick={() => void db.planned.delete(p.id)} aria-label="Usuń z planu">
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddEntry key={date} date={date} onDone={() => setAdding(false)} />
      ) : (
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            {date > today ? 'Zaplanuj trening' : 'Dodaj trening'}
          </button>
          {date === today && (
            <a className="btn" href={href.strength('full')}>
              <Icon name="dumbbell" />
              Nogi na puch
            </a>
          )}
        </div>
      )}
    </section>
  );
}
