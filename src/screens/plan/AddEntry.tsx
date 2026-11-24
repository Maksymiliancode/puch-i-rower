import { useState } from 'react';
import { useSettings } from '../../app/settings';
import { Icon } from '../../components/Icon';
import { db, saveSession } from '../../data/db';
import { BIKE_WORKOUTS } from '../../domain/catalog';
import { prettyDate } from '../../domain/format';
import { currentPhase, todayIso } from '../../domain/season';
import type { Session } from '../../domain/types';
import { workoutMeta, type Family } from '../../domain/workouts';
import { famStyle } from './common';

// Szybki wpis: ogólny rodzaj treningu jako kafelek. Data wstecz → dziennik, data w przód → plan.
const TYPES: { id: string; label: string; fam: Family }[] = [
  { id: 's_puch', label: 'Nogi na puch', fam: 'legs' },
  { id: 's_short', label: 'Siła krótka (nogi)', fam: 'legs' },
  { id: 's_upper', label: 'Siłownia: góra ciała', fam: 'upper' },
  { id: 'bike', label: 'Rower', fam: 'bike' },
  { id: 'r_easy', label: 'Bieg spokojny', fam: 'run' },
  { id: 'r_hills', label: 'Podbiegi', fam: 'uphill' },
  { id: 'h_pack', label: 'Podejścia z plecakiem', fam: 'uphill' },
  { id: 'm_day', label: 'Góry / skitury', fam: 'uphill' },
  { id: 'mob', label: 'Mobilność', fam: 'easy' },
  { id: 'walk', label: 'Spacer / dzień w ruchu', fam: 'easy' },
  { id: 'other', label: 'Inne', fam: 'other' },
  { id: 'rest', label: 'Wolne', fam: 'rest' },
];

export function AddEntry({ date, initial, onDone }: { date: string; initial?: string; onDone: () => void }) {
  const { settings } = useSettings();
  const phase = currentPhase(settings.phases, date, settings.phaseOverride);
  const isBikeId = (id?: string) => !!id && id.startsWith('b_');
  const [type, setType] = useState<string | null>(isBikeId(initial) ? 'bike' : (initial ?? null));
  const [bikeId, setBikeId] = useState(isBikeId(initial) ? initial! : 'b_z2');
  const [minutes, setMinutes] = useState('');
  const [rpe, setRpe] = useState<number | undefined>();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const future = date > todayIso();
  const bikes = BIKE_WORKOUTS.filter((w) => w.rx[phase.bike_rx]);

  const workoutId = type === 'bike' ? bikeId : type === 'rest' ? null : type;
  const meta = workoutMeta(workoutId);

  const submit = async () => {
    if (!type) return;
    setBusy(true);
    const now = new Date().toISOString();
    if (future) {
      await db.planned.put({ id: crypto.randomUUID(), date, workoutId, status: 'planned', note: notes.trim() || (type === 'rest' ? 'Wolne' : undefined) });
    } else {
      const min = Number(minutes);
      const session: Session = {
        id: crypto.randomUUID(),
        date,
        workoutId,
        kind: type === 'rest' ? 'rest' : (meta?.kind ?? 'other'),
        title: type === 'other' && title.trim() ? title.trim() : type === 'rest' ? 'Odpoczynek' : (meta?.name ?? 'Trening'),
        phase: phase.id,
        durationMin: minutes && Number.isFinite(min) && min > 0 ? Math.round(min) : undefined,
        rpe,
        notes: notes.trim() || undefined,
        source: 'manual',
        createdAt: now,
        updatedAt: now,
      };
      await saveSession(session);
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="add-entry">
      <p className="label">
        {future ? 'Zaplanuj na' : 'Wpis do dziennika:'} {prettyDate(date)}
      </p>
      <div className="type-grid" role="group" aria-label="Rodzaj treningu">
        {TYPES.map((t) => (
          <button key={t.id} type="button" className="type-tile" style={famStyle(t.fam)} aria-pressed={type === t.id} onClick={() => setType(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {type === 'bike' && (
        <div className="field">
          <label htmlFor="add-bike">Który trening na rowerze</label>
          <select id="add-bike" className="input" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
            {bikes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {type === 'other' && !future && (
        <div className="field">
          <label htmlFor="add-title">Nazwa</label>
          <input id="add-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. basen, squash" />
        </div>
      )}

      {type && type !== 'rest' && !future && (
        <>
          <div className="field">
            <label htmlFor="add-min">Ile minut</label>
            <input id="add-min" className="input num" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={meta?.minutes(phase)?.[0]?.toString() ?? ''} />
          </div>
          <div className="field">
            <span className="label" id="add-rpe">
              Jak ciężko (1–10)
            </span>
            <div className="chips" role="group" aria-labelledby="add-rpe">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={rpe === n} onClick={() => setRpe(rpe === n ? undefined : n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {type && (
        <div className="field">
          <label htmlFor="add-notes">Notatka</label>
          <input id="add-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={future ? 'np. rano przed pracą' : 'np. 45 min, tętno 142'} />
        </div>
      )}

      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!type || busy} onClick={() => void submit()}>
          <Icon name={future ? 'calendar' : 'check'} />
          {future ? 'Zaplanuj' : 'Zapisz'}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Anuluj
        </button>
      </div>
    </div>
  );
}
