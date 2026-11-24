import { useState } from 'react';
import { href, startHref } from '../app/route';
import { useSettings } from '../app/settings';
import { Icon } from '../components/Icon';
import { db } from '../data/db';
import { nowSuggestion, type Pick } from '../domain/planner';
import type { Equipment } from '../domain/types';
import { startKind, workoutMeta } from '../domain/workouts';
import { AddEntry } from './plan/AddEntry';
import { dayLabel, EQUIPMENT_OPTIONS, familyOfWorkout, famStyle, minutesLabel, shortName } from './plan/common';
import { nextDay, usePlanDays } from './plan/usePlanDays';
import './plan/plan.css';

const TIMES = [30, 45, 60, 90, 120];

/**
 * Następny trening. Domyślnie dokładnie to, co pokazuje Plan (ten sam wspólny plan).
 * Po wybraniu czasu, miejsca albo samopoczucia: propozycja na teraz, dopasowana do sytuacji.
 */
export function NowCard() {
  const { settings, phase } = useSettings();
  const data = usePlanDays();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [legsHeavy, setLegsHeavy] = useState(false);
  const [fasted, setFasted] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [rhr, setRhr] = useState('');

  if (!data) return null;
  const { today, sessions, morning, done, ahead, days } = data;
  const eq = equipment ?? data.equipment;
  const custom = minutes !== null || equipment !== null || legsHeavy || fasted;

  // Tryb planu: pierwszy dzień z czymś do zrobienia. Tryb „teraz”: propozycja na dziś.
  const next = nextDay(days);
  let when = today;
  let pick: Pick | null = null;
  let why = '';
  let note: string | undefined;
  let alternatives: Pick[] = [];
  let inPlan = false;
  if (custom) {
    const s = nowSuggestion(
      { date: today, phase, items: [...done, ...ahead], equipment: eq, minutes, fasted, legsHeavy, morning, rhrAlert: settings.rhrAlert, lightWeeks: settings.lightWeeks },
      ahead.filter((p) => p.date === today),
    );
    pick = s.pick;
    why = s.why;
    note = s.note;
    alternatives = s.alternatives;
  } else if (next) {
    when = next.date;
    const p = next.planned[0];
    if (p) {
      inPlan = true;
      pick = p.workoutId ? { workoutId: p.workoutId, slot: 'luz', minutes: workoutMeta(p.workoutId)?.minutes(data.phaseFor(next.date)) ?? null } : null;
      why = p.note ?? 'W planie.';
    } else if (next.suggestion) {
      pick = next.suggestion.pick;
      why = next.suggestion.why;
      note = next.suggestion.note;
      alternatives = next.suggestion.alternatives;
    }
  }

  const options: Pick[] = [pick, ...alternatives].filter((x): x is Pick => !!x);
  const shown = options.find((o) => o.workoutId === chosen) ?? pick;
  const meta = workoutMeta(shown?.workoutId);
  const kind = shown ? startKind(shown.workoutId, data.phaseFor(when)) : 'log';
  const doneToday = sessions.filter((x) => x.date === today && x.kind !== 'rest');
  const todayRhr = morning.find((m) => m.date === today)?.rhr;
  const isToday = when === today;

  const reset = () => {
    setMinutes(null);
    setEquipment(null);
    setLegsHeavy(false);
    setFasted(false);
    setChosen(null);
    setLogging(false);
  };

  const toggleEq = (e: Equipment) => {
    setChosen(null);
    setEquipment(eq.includes(e) ? eq.filter((x) => x !== e) : [...eq, e]);
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
      <h2 id="now-h">{custom ? 'Co teraz?' : 'Następny trening'}</h2>
      {doneToday.length > 0 && (
        <p className="muted">
          Dziś zrobione: <b>{doneToday.map((x) => shortName(x.workoutId)).join(', ')}</b>.
        </p>
      )}

      {shown && meta ? (
        <div className="day-card now-pick" style={famStyle(familyOfWorkout(shown.workoutId))}>
          <p className="now-when">
            {dayLabel(when, today)}
            {inPlan && !chosen && <span className="tag">w planie</span>}
            {custom && <span className="tag">dopasowane do sytuacji</span>}
          </p>
          <div className="day-main">
            <b>{meta.name}</b>
            {shown.minutes && <span className="muted num">{minutesLabel(shown.minutes)}</span>}
          </div>
          {meta.rxText(data.phaseFor(when)) && <p>{meta.rxText(data.phaseFor(when))}</p>}
          <p className="day-why">{chosen ? 'Wybrane z alternatyw.' : why}</p>
          {!chosen && note && <p className="day-note">{note}</p>}
          <div className="row">
            {kind !== 'log' ? (
              <a className="btn btn-primary" href={startHref(shown.workoutId, kind)}>
                <Icon name="play" filled />
                {kind === 'timer' ? 'Start' : 'Ćwiczenia'}
              </a>
            ) : (
              isToday && (
                <button type="button" className="btn btn-primary" onClick={() => setLogging(true)}>
                  <Icon name="check" />
                  Zrobione
                </button>
              )
            )}
            {kind === 'log' && (
              <a className="btn" href={href.catalog(shown.workoutId)}>
                Opis
              </a>
            )}
            {!custom && (
              <a className="btn" href={href.plan()}>
                <Icon name="calendar" />
                Plan
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="day-card" style={famStyle('rest')}>
          <p className="now-when">{dayLabel(when, today)}</p>
          <b>{inPlan ? 'Wolne' : 'Odpoczynek'}</b>
          {why && <p className="day-why">{why}</p>}
        </div>
      )}

      {logging && shown && <AddEntry key={shown.workoutId} date={today} initial={shown.workoutId} onDone={() => setLogging(false)} />}

      {options.length > 1 && (
        <div className="field">
          <span className="label" id="now-alt">
            Inaczej
          </span>
          <div className="swap" role="group" aria-labelledby="now-alt">
            {options
              .filter((o) => o.workoutId !== shown?.workoutId)
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

      <details className="now-more" open={custom || undefined}>
        <summary>Dopasuj do dzisiejszej sytuacji</summary>
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
                  setMinutes(minutes === t ? null : t);
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
                if (!eq.includes('gory')) setEquipment([...eq, 'gory']);
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
              <button key={o.id} type="button" className="chip chip-text" aria-pressed={eq.includes(o.id)} onClick={() => toggleEq(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

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
        {custom && (
          <button type="button" className="btn" onClick={reset}>
            Wróć do planu
          </button>
        )}
      </details>
    </section>
  );
}
