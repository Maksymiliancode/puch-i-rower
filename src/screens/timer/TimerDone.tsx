import { useState } from 'react';
import { db } from '../../data/db';
import { clock } from '../../domain/format';
import { todayIso } from '../../domain/season';
import type { BikeRxKey, BikeWorkout, Session } from '../../domain/types';
import { Icon } from '../../components/Icon';
import { clearTimer } from '../../lib/timerStore';
import { useSettings } from '../../app/settings';

interface Props {
  workout: BikeWorkout;
  rxKey: BikeRxKey;
  garminTitle: string;
  elapsedSec: number;
  startedAt: string | null;
  onClose: () => void;
}

const toNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

export function TimerDone({ workout, rxKey, garminTitle, elapsedSec, startedAt, onClose }: Props) {
  const { phase } = useSettings();
  const [avgW, setAvgW] = useState('');
  const [gear, setGear] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const w = toNum(avgW);
  const name = `${garminTitle}${w ? ` · ${Math.round(w)} W` : ''}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  const store = async () => {
    setError(null);
    const now = new Date().toISOString();
    const date = todayIso();
    const session: Session = {
      id: crypto.randomUUID(),
      date,
      startedAt: startedAt ?? undefined,
      workoutId: workout.id,
      kind: 'bike',
      title: workout.name,
      phase: phase.id,
      rxKey,
      durationMin: Math.max(1, Math.round(elapsedSec / 60)),
      avgHr: toNum(avgHr),
      rpe: rpe ?? undefined,
      bike: { avgW: w, gear: toNum(gear) },
      notes: notes.trim() || undefined,
      source: 'app',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.transaction('rw', [db.sessions, db.planned], async () => {
        await db.sessions.put(session);
        const planned = await db.planned.where('date').equals(date).filter((p) => p.workoutId === workout.id && p.status === 'planned').first();
        if (planned) await db.planned.update(planned.id, { status: 'done', sessionId: session.id });
      });
      clearTimer();
      setSaved(true);
    } catch {
      setError('Nie udało się zapisać. Spróbuj ponownie; wpisane liczby zostają w polach.');
    }
  };

  const closeWithoutSave = () => {
    if (saved || window.confirm('Zamknąć bez zapisu do dziennika? Wyniki z tego treningu przepadną.')) onClose();
  };

  return (
    <div className="t-done">
      <header className="t-done-head">
        <span className="t-done-check" aria-hidden="true">
          <Icon name="check" size={32} />
        </span>
        <div>
          <h1>Trening zrobiony</h1>
          <p className="t-done-sub">
            {workout.name} · <span className="num">{clock(elapsedSec)}</span>
          </p>
        </div>
      </header>

      <div className="t-done-grid">
        <section className="t-done-card">
          <h2>Wyniki z Keisera</h2>
          <p className="t-done-hint">Przestań pedałować na 3 sekundy, a konsola pokaże średnie. Zatrzymaj też nagrywanie na zegarku.</p>
          <div className="t-done-fields">
            <label className="field">
              <span className="label">Średnie waty</span>
              <input className="input num" name="avgW" inputMode="numeric" autoComplete="off" placeholder="np. 238…" value={avgW} onChange={(e) => setAvgW(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Bieg</span>
              <input className="input num" name="gear" inputMode="numeric" autoComplete="off" placeholder="np. 12…" value={gear} onChange={(e) => setGear(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Średnie tętno</span>
              <input className="input num" name="avgHr" inputMode="numeric" autoComplete="off" placeholder="np. 142…" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} />
            </label>
          </div>
          <div className="field">
            <span className="label" id="rpe-label">
              Jak ciężko było? (1–10)
            </span>
            <div className="chips" role="group" aria-labelledby="rpe-label">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={rpe === n} onClick={() => setRpe(rpe === n ? null : n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="label">Notatka</span>
            <textarea className="input" name="notes" autoComplete="off" placeholder="np. bieg 14 przy 60 rpm dawał ~240 W…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </section>

        <section className="t-done-card">
          <h2>Nazwa w Garmin Connect</h2>
          <p className="t-done-hint">Zmień nazwę aktywności na zegarku albo w aplikacji Garmin Connect.</p>
          <code className="t-garmin">{name}</code>
          <div className="row">
            <button type="button" className="btn" onClick={() => void copy()}>
              <Icon name="copy" />
              {copied === 'ok' ? 'Skopiowano' : 'Kopiuj nazwę'}
            </button>
          </div>
          {copied === 'fail' && <p className="t-done-hint">Nie udało się skopiować. Zaznacz nazwę palcem i skopiuj ręcznie.</p>}
        </section>
      </div>

      <div className="t-done-actions" aria-live="polite">
        {error && <p className="notice">{error}</p>}
        {saved ? (
          <>
            <p className="t-done-saved">
              <Icon name="check" /> Zapisano w dzienniku
            </p>
            <button type="button" className="btn btn-zone" onClick={onClose}>
              Zamknij
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-zone" onClick={() => void store()}>
              Zapisz w dzienniku
            </button>
            <button type="button" className="btn" onClick={closeWithoutSave}>
              Zamknij bez zapisu
            </button>
          </>
        )}
      </div>
    </div>
  );
}
