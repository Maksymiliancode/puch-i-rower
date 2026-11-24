import { useEffect, useState } from 'react';
import { href } from '../app/route';
import { useSettings } from '../app/settings';
import { Icon } from '../components/Icon';
import { SeasonRibbon } from '../components/SeasonRibbon';
import { db } from '../data/db';
import { BIKE_WORKOUTS, bikeWorkout, hasTimer, workoutName } from '../domain/catalog';
import { daysText, prettyDate } from '../domain/format';
import { daysBetween, nextEvent, todayIso } from '../domain/season';
import type { Planned } from '../domain/types';
import { clearTimer, loadTimer } from '../lib/timerStore';

const weekday = new Intl.DateTimeFormat('pl-PL', { weekday: 'long' });

function dayLabel(date: string, today: string): string {
  const d = daysBetween(today, date);
  if (d === 0) return 'Dziś';
  if (d === 1) return 'Jutro';
  const w = weekday.format(new Date(`${date}T12:00:00`));
  return `${w[0].toUpperCase()}${w.slice(1)}, ${prettyDate(date)}`;
}

export function Today() {
  const { settings, phase } = useSettings();
  const today = todayIso();
  const ev = nextEvent(settings.events, today);
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [saved, setSaved] = useState(() => loadTimer());

  useEffect(() => {
    let alive = true;
    void db.planned
      .where('date')
      .between(today, '9999-12-31', true, true)
      .sortBy('date')
      .then((p) => alive && setPlanned(p.filter((x) => x.status === 'planned').slice(0, 6)));
    return () => {
      alive = false;
    };
  }, [today]);

  const savedWorkout = saved ? bikeWorkout(saved.workoutId) : undefined;
  const recommended = BIKE_WORKOUTS.filter((w) => w.rx[phase.bike_rx] && w.phases_recommended?.includes(phase.bike_rx) && hasTimer(w, phase.bike_rx));

  return (
    <main className="page">
      <header className="today-head">
        <p className="today-phase">
          Faza {phase.id}
          {settings.phaseOverride && ' (ustawiona ręcznie)'}
        </p>
        <h1 className="today-title">{phase.name}</h1>
        {ev && (
          <p className="today-event">
            {ev.days === 0 ? (
              <>
                Dziś: <b>{ev.event.name}</b>
              </>
            ) : (
              <>
                <b className="num">{daysText(ev.days)}</b> do: {ev.event.name}
              </>
            )}
          </p>
        )}
      </header>

      <SeasonRibbon phases={settings.phases} events={settings.events} today={today} currentId={phase.id} />

      {saved && savedWorkout && (
        <section className="card resume" aria-labelledby="resume-h">
          <h2 id="resume-h">Niedokończony trening</h2>
          <p>
            {savedWorkout.name}. {saved.state.done ? 'Trening skończony, wyniki nie są jeszcze zapisane.' : 'Timer można wznowić od miejsca, w którym jest.'}
          </p>
          <div className="row">
            <a className="btn btn-primary" href={href.timer(saved.workoutId)}>
              <Icon name="play" filled />
              {saved.state.done ? 'Wpisz wyniki' : 'Wróć do timera'}
            </a>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (window.confirm('Porzucić ten trening? Timer zostanie wyczyszczony.')) {
                  clearTimer();
                  setSaved(null);
                }
              }}
            >
              Porzuć
            </button>
          </div>
        </section>
      )}

      {planned.length > 0 && (
        <section className="stack" aria-labelledby="plan-h">
          <h2 id="plan-h" className="section-title">
            Zaplanowane
          </h2>
          <ul className="plan-list">
            {planned.map((p) => {
              const w = p.workoutId ? bikeWorkout(p.workoutId) : undefined;
              const runnable = w && hasTimer(w, phase.bike_rx);
              return (
                <li key={p.id} className="plan-item" data-today={p.date === today || undefined}>
                  <div className="plan-day">{dayLabel(p.date, today)}</div>
                  <div className="plan-body">
                    <b>{workoutName(p.workoutId)}</b>
                    {p.note && <p className="muted">{p.note}</p>}
                  </div>
                  {runnable && (
                    <a className="btn plan-go" href={href.timer(w.id)} aria-label={`Uruchom timer: ${w.name}`}>
                      <Icon name="play" filled />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="stack" aria-labelledby="bike-h">
        <h2 id="bike-h" className="section-title">
          Rower w tej fazie
        </h2>
        {phase.bike_text && <p>{phase.bike_text}</p>}
        <ul className="quick-list">
          {recommended.map((w) => (
            <li key={w.id}>
              <a className="quick" href={href.catalog(w.id)}>
                <span>{w.name}</span>
                <span className="muted num">{Math.round(w.rx[phase.bike_rx]!.segments.reduce((a, s) => a + s.sec, 0) / 60)} min</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
