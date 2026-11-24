import { useState } from 'react';
import { href } from '../app/route';
import { useSettings } from '../app/settings';
import { Icon } from '../components/Icon';
import { SeasonRibbon } from '../components/SeasonRibbon';
import { BIKE_WORKOUTS, bikeWorkout, hasTimer } from '../domain/catalog';
import { daysText } from '../domain/format';
import { nextEvent, todayIso } from '../domain/season';
import { clearTimer, loadTimer } from '../lib/timerStore';
import { NowCard } from './NowCard';

export function Today() {
  const { settings, phase } = useSettings();
  const today = todayIso();
  const ev = nextEvent(settings.events, today);
  const [saved, setSaved] = useState(() => loadTimer());

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

      <NowCard />

      <a className="quick" href={href.plan()}>
        <span>
          <Icon name="calendar" /> Plan na kolejne dni i kalendarz
        </span>
        <span aria-hidden="true">›</span>
      </a>

      <a className="quick" href={href.strength('full')}>
        <span>
          <Icon name="dumbbell" /> Nogi na puch: ćwiczenia z animacjami
        </span>
        <span aria-hidden="true">›</span>
      </a>
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
