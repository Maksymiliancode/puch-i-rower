import { useState } from 'react';
import { href, startHref } from '../app/route';
import { useSettings } from '../app/settings';
import { Icon } from '../components/Icon';
import { db } from '../data/db';
import { useMorning, usePlanned, useSessions } from '../data/live';
import { nowSuggestion, type Pick } from '../domain/planner';
import { todayIso } from '../domain/season';
import type { Equipment } from '../domain/types';
import { startKind, workoutMeta } from '../domain/workouts';
import { AddEntry } from './plan/AddEntry';
import { DEFAULT_EQUIPMENT, EQUIPMENT_OPTIONS, familyOfWorkout, famStyle, minutesLabel, plannedItems, sessionItems, shortName } from './plan/common';
import './plan/plan.css';

const TIMES = [30, 45, 60, 90, 120];

/** „Co teraz?”: czas i miejsce → jedna propozycja z uzasadnieniem + alternatywy. */
export function NowCard() {
  const { settings, phase } = useSettings();
  const today = todayIso();
  const sessions = useSessions();
  const planned = usePlanned();
  const morning = useMorning();
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState<Equipment[]>(settings.planner?.equipment ?? DEFAULT_EQUIPMENT);
  const [legsHeavy, setLegsHeavy] = useState(false);
  const [fasted, setFasted] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [rhr, setRhr] = useState('');

  if (!sessions || !planned || !morning) return null;

  const items = [...sessionItems(sessions), ...plannedItems(planned, today)];
  const plannedToday = plannedItems(planned, today).filter((p) => p.date === today);
  const s = nowSuggestion(
    { date: today, phase, items, equipment, minutes, fasted, legsHeavy, morning, rhrAlert: settings.rhrAlert, lightWeeks: settings.lightWeeks },
    plannedToday,
  );
  const options: Pick[] = [s.pick, ...s.alternatives].filter((x): x is Pick => !!x);
  const pick = options.find((o) => o.workoutId === chosen) ?? s.pick;
  const meta = workoutMeta(pick?.workoutId);
  const kind = pick ? startKind(pick.workoutId, phase) : 'log';
  const doneToday = sessions.filter((x) => x.date === today && x.kind !== 'rest');
  const todayRhr = morning.find((m) => m.date === today)?.rhr;

  const toggleEq = (e: Equipment) => {
    setChosen(null);
    setEquipment((eq) => (eq.includes(e) ? eq.filter((x) => x !== e) : [...eq, e]));
  };

  const saveRhr = async () => {
    const v = Number(rhr);
    if (!Number.isFinite(v) || v < 30 || v > 120) return;
    const prev = await db.morning.get(today);
    await db.morning.put({ ...prev, date: today, rhr: Math.round(v) });
    setRhr('');
  };

  return (
    <section className="card now" aria-labelledby="now-h">
      <h2 id="now-h">Co teraz?</h2>
      {doneToday.length > 0 && (
        <p className="muted">
          Dziś zrobione: <b>{doneToday.map((x) => shortName(x.workoutId) || x.title).join(', ')}</b>. Poniżej propozycja na kolejny trening.
        </p>
      )}

      <div className="field">
        <span className="label" id="now-time">
          Ile masz czasu
        </span>
        <div className="chips" role="group" aria-labelledby="now-time">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={minutes === t}
              onClick={() => {
                setMinutes(t);
                setChosen(null);
              }}
            >
              {t === 120 ? '120+' : t}
            </button>
          ))}
          <button
            type="button"
            className="chip chip-text"
            aria-pressed={minutes === 600}
            onClick={() => {
              setMinutes(600);
              setChosen(null);
              if (!equipment.includes('gory')) setEquipment((eq) => [...eq, 'gory']);
            }}
          >
            Dzień w górach
          </button>
        </div>
      </div>

      <div className="field">
        <span className="label" id="now-eq">
          Co masz pod ręką
        </span>
        <div className="chips" role="group" aria-labelledby="now-eq">
          {EQUIPMENT_OPTIONS.map((o) => (
            <button key={o.id} type="button" className="chip chip-text" aria-pressed={equipment.includes(o.id)} onClick={() => toggleEq(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <details className="now-more">
        <summary>Samopoczucie</summary>
        <label className="switch">
          <input type="checkbox" checked={legsHeavy} onChange={(e) => setLegsHeavy(e.target.checked)} />
          <span>Ciężkie nogi</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={fasted} onChange={(e) => setFasted(e.target.checked)} />
          <span>Na czczo</span>
        </label>
        <div className="field">
          <label htmlFor="now-rhr">Tętno spoczynkowe rano{todayRhr ? ` (zapisane: ${todayRhr})` : ''}</label>
          <div className="row">
            <input id="now-rhr" className="input num now-rhr" inputMode="numeric" value={rhr} onChange={(e) => setRhr(e.target.value)} placeholder="np. 44" />
            <button type="button" className="btn" onClick={() => void saveRhr()} disabled={!rhr}>
              Zapisz
            </button>
          </div>
          <span className="hint">Dwa dni z rzędu ≥ {settings.rhrAlert}: aplikacja proponuje tylko spokojne treningi.</span>
        </div>
      </details>

      {pick && meta ? (
        <div className="day-card now-pick" style={famStyle(familyOfWorkout(pick.workoutId))}>
          <div className="day-main">
            <b>{meta.name}</b>
            {pick.minutes && <span className="muted num">{minutesLabel(pick.minutes)}</span>}
          </div>
          {meta.rxText(phase) && <p>{meta.rxText(phase)}</p>}
          <p className="day-why">{chosen ? 'Wybrane z alternatyw.' : s.why}</p>
          {!chosen && s.note && <p className="day-note">{s.note}</p>}
          <div className="row">
            {kind !== 'log' ? (
              <a className="btn btn-primary" href={startHref(pick.workoutId, kind)}>
                <Icon name="play" filled />
                {kind === 'timer' ? 'Start' : 'Ćwiczenia'}
              </a>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setLogging(true)}>
                <Icon name="check" />
                Zrobione
              </button>
            )}
            {kind === 'log' && (
              <a className="btn" href={href.catalog(pick.workoutId)}>
                Opis
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="day-card" style={famStyle('rest')}>
          <b>Odpoczynek</b>
          <p className="day-why">{s.why}</p>
        </div>
      )}

      {logging && pick && <AddEntry key={pick.workoutId} date={today} initial={pick.workoutId} onDone={() => setLogging(false)} />}

      {options.length > 1 && (
        <div className="field">
          <span className="label" id="now-alt">
            Inaczej
          </span>
          <div className="swap" role="group" aria-labelledby="now-alt">
            {options
              .filter((o) => o.workoutId !== pick?.workoutId)
              .map((o) => (
                <button
                  key={o.workoutId}
                  type="button"
                  className="type-tile"
                  style={famStyle(familyOfWorkout(o.workoutId))}
                  onClick={() => {
                    setChosen(o.workoutId);
                    setLogging(false);
                  }}
                >
                  {shortName(o.workoutId)}
                  {o.minutes && <small className="num">{minutesLabel(o.minutes)}</small>}
                </button>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
