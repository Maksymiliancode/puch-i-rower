import { useState } from 'react';
import { startHref } from '../../app/route';
import { useSettings } from '../../app/settings';
import { Icon } from '../../components/Icon';
import { db } from '../../data/db';
import type { DayPlan, Item, Pick, Suggestion } from '../../domain/planner';
import { currentPhase } from '../../domain/season';
import { startKind, workoutMeta } from '../../domain/workouts';
import { dayLabel, familyOfWorkout, famStyle, minutesLabel, shortName } from './common';

/** Jeden dzień w „Najbliższe dni”: zrobione, zaplanowane albo propozycja z zamianą. */
export function DayTile({ day, today, alternativesFor }: { day: DayPlan; today: string; alternativesFor: (date: string) => Suggestion }) {
  const { settings } = useSettings();
  const phase = currentPhase(settings.phases, day.date, settings.phaseOverride);
  const [swapping, setSwapping] = useState(false);
  const isToday = day.date === today;
  const s = day.suggestion;

  const planAs = async (workoutId: string | null) => {
    await db.transaction('rw', db.planned, async () => {
      for (const p of day.planned) if (p.id) await db.planned.delete(p.id);
      await db.planned.put({ id: crypto.randomUUID(), date: day.date, workoutId, status: 'planned', note: workoutId ? undefined : 'Wolne' });
    });
    setSwapping(false);
  };

  const unplan = async (p: Item) => {
    if (p.id) await db.planned.delete(p.id);
  };

  const options: Pick[] = swapping ? (() => {
    const alt = alternativesFor(day.date);
    const current = s?.pick?.workoutId ?? day.planned[0]?.workoutId;
    return [alt.pick, ...alt.alternatives].filter((x): x is Pick => !!x && x.workoutId !== current);
  })() : [];

  const startBtn = (id: string) => {
    const kind = startKind(id, phase);
    return (
      <a className="btn btn-primary" href={startHref(id, kind)}>
        <Icon name={kind === 'log' ? 'list' : 'play'} filled={kind !== 'log'} />
        {kind === 'timer' ? 'Start' : kind === 'strength' ? 'Ćwiczenia' : 'Opis'}
      </a>
    );
  };

  return (
    <li className="day" data-today={isToday || undefined}>
      <p className="day-when">{dayLabel(day.date, today)}</p>

      {day.done.map((d, i) => (
        <div key={`d${i}`} className="day-card day-card--done" style={famStyle(familyOfWorkout(d.workoutId, d.workoutId ? undefined : 'rest'))}>
          <Icon name="check" />
          <b>{d.workoutId ? shortName(d.workoutId) : 'Odpoczynek'}</b>
          <span className="muted">zrobione</span>
        </div>
      ))}

      {day.planned.map((p, i) => (
        <div key={`p${i}`} className="day-card" style={famStyle(familyOfWorkout(p.workoutId))}>
          <div className="day-main">
            <b>{p.workoutId ? (workoutMeta(p.workoutId)?.name ?? p.workoutId) : 'Wolne'}</b>
            <span className="tag">w planie</span>
          </div>
          {p.note && <p className="day-why">{p.note}</p>}
          <div className="row">
            {isToday && p.workoutId && startBtn(p.workoutId)}
            <button type="button" className="btn" onClick={() => setSwapping((v) => !v)} aria-expanded={swapping}>
              <Icon name="swap" />
              Zamień
            </button>
            <button type="button" className="btn" onClick={() => void unplan(p)} aria-label="Usuń z planu">
              <Icon name="close" />
            </button>
          </div>
        </div>
      ))}

      {s && s.pick && (
        <div className="day-card day-card--suggest" style={famStyle(familyOfWorkout(s.pick.workoutId))}>
          <div className="day-main">
            <b>{workoutMeta(s.pick.workoutId)?.name}</b>
            {s.pick.minutes && <span className="muted num">{minutesLabel(s.pick.minutes)}</span>}
          </div>
          <p className="day-why">{s.why}</p>
          {s.note && <p className="day-note">{s.note}</p>}
          <div className="row">
            {isToday && startBtn(s.pick.workoutId)}
            <button type="button" className="btn" onClick={() => void planAs(s.pick!.workoutId)}>
              <Icon name="calendar" />
              Zaplanuj
            </button>
            <button type="button" className="btn" onClick={() => setSwapping((v) => !v)} aria-expanded={swapping}>
              <Icon name="swap" />
              Zamień
            </button>
          </div>
        </div>
      )}

      {s && !s.pick && (
        <div className="day-card" style={famStyle('rest')}>
          <b>Odpoczynek</b>
          <p className="day-why">{s.why}</p>
        </div>
      )}

      {swapping && (
        <div className="swap" role="group" aria-label="Zamień na">
          {options.map((o) => (
            <button key={o.workoutId} type="button" className="type-tile" style={famStyle(familyOfWorkout(o.workoutId))} onClick={() => void planAs(o.workoutId)}>
              {shortName(o.workoutId)}
              {o.minutes && <small className="num">{minutesLabel(o.minutes)}</small>}
            </button>
          ))}
          <button type="button" className="type-tile" style={famStyle('rest')} onClick={() => void planAs(null)}>
            Wolne
          </button>
        </div>
      )}
    </li>
  );
}
