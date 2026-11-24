import { useEffect, useMemo, useRef, useState } from 'react';
import { href } from '../../app/route';
import { useSettings } from '../../app/settings';
import { ExerciseFigure } from '../../components/figure/ExerciseFigure';
import { Icon } from '../../components/Icon';
import { saveSession } from '../../data/db';
import { useSessions } from '../../data/live';
import { clock, prettyDate } from '../../domain/format';
import { todayIso } from '../../domain/season';
import { FULL, fullPlan, lastSets, LOGGING_HINT, SHORT, shortPlan, setsSummary, type PlanItem, type SetLog, type Variant } from '../../domain/strength';
import type { Session } from '../../domain/types';
import type { StrengthKey } from '../../domain/workouts';
import { sounds, unlockAudio } from '../../lib/audio';
import { lockScreen, releaseScreen } from '../../lib/wakeLock';
import './strength.css';

interface Draft {
  v: 1;
  date: string;
  startedAt: string | null;
  sets: Record<string, SetLog[]>;
  warm: boolean[];
  core: boolean[];
  rpe?: number;
  notes: string;
}

const draftKey = (v: Variant) => `pir-strength-v1-${v}`;
const emptyDraft = (): Draft => ({ v: 1, date: todayIso(), startedAt: null, sets: {}, warm: [], core: [], notes: '' });

function loadDraft(v: Variant): Draft {
  try {
    const raw = localStorage.getItem(draftKey(v));
    if (raw) {
      const d = JSON.parse(raw) as Draft;
      if (d.v === 1) return d;
    }
  } catch {
    /* brak dostępu do pamięci */
  }
  return emptyDraft();
}

/** Przerwa liczona od teraz (wywoływane tylko w obsłudze kliknięcia). */
const restFor = (sec: number) => ({ endsAt: Date.now() + sec * 1000, total: sec });

const hasProgress = (d: Draft) => d.startedAt !== null || Object.values(d.sets).some((s) => s.some((x) => x.done || x.kg != null || x.reps != null));

function numOrUndef(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? undefined : n;
}

export function StrengthScreen({ variant }: { variant: Variant }) {
  const { phase } = useSettings();
  const key = phase.strength_rx as StrengthKey;
  const plan = useMemo(() => (variant === 'full' ? fullPlan(key) : shortPlan(key)), [variant, key]);
  const sessions = useSessions();
  const [draft, setDraft] = useState<Draft>(() => loadDraft(variant));
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const meta = variant === 'full' ? FULL : SHORT;

  useEffect(() => {
    try {
      if (hasProgress(draft)) localStorage.setItem(draftKey(variant), JSON.stringify(draft));
      else localStorage.removeItem(draftKey(variant));
    } catch {
      /* ignoruj */
    }
  }, [draft, variant]);

  useEffect(() => () => releaseScreen(), []);

  const begin = (d: Draft): Draft => (d.startedAt ? d : { ...d, startedAt: new Date().toISOString() });
  // Pierwsze dotknięcie: odblokuj dźwięk przerwy i nie pozwól gasnąć ekranowi.
  const wake = () => {
    if (draft.startedAt) return;
    unlockAudio();
    void lockScreen();
  };

  const setOf = (id: string, i: number): SetLog => draft.sets[id]?.[i] ?? {};
  const updateSet = (item: PlanItem, i: number, patch: Partial<SetLog>) => {
    wake();
    setDraft((d) => {
      const list = [...(d.sets[item.id] ?? [])];
      while (list.length < item.sets) list.push({});
      list[i] = { ...list[i], ...patch };
      return begin({ ...d, sets: { ...d.sets, [item.id]: list } });
    });
  };

  const toggleDone = (item: PlanItem, i: number) => {
    const done = !setOf(item.id, i).done;
    updateSet(item, i, { done });
    // Przerwa po serii; ćwiczenia 5 i 6 idą w parze, więc po 5 przerwy nie ma.
    if (done && item.restSec) setRest(restFor(item.restSec));
  };

  const toggleList = (field: 'warm' | 'core', i: number) => {
    wake();
    setDraft((d) => {
      const list = [...d[field]];
      list[i] = !list[i];
      return begin({ ...d, [field]: list });
    });
  };

  const save = async () => {
    const now = new Date();
    const started = draft.startedAt ? new Date(draft.startedAt) : null;
    const measured = started ? Math.round((now.getTime() - started.getTime()) / 60000) : null;
    const durationMin = measured && measured >= 10 && measured <= 240 ? measured : meta.duration_min;
    const session: Session = {
      id: crypto.randomUUID(),
      date: draft.date,
      startedAt: draft.startedAt ?? undefined,
      workoutId: meta.id,
      kind: 'strength',
      title: meta.name,
      phase: phase.id,
      rxKey: key,
      durationMin,
      rpe: draft.rpe,
      notes: draft.notes.trim() || undefined,
      strength: {
        exercises: plan.map((p) => {
          const sets = (draft.sets[p.id] ?? []).filter((s) => s.done || s.kg != null || s.reps != null || s.sec != null).map(({ kg, reps, sec }) => ({ kg, reps, sec }));
          const done = Array.from({ length: p.sets }, (_, i) => !!draft.sets[p.id]?.[i]?.done).every(Boolean);
          return { id: p.id, sets, done };
        }),
      },
      source: 'app',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await saveSession(session);
    setSaved(session.date);
    setRest(null);
    setDraft(emptyDraft());
    releaseScreen();
  };

  const reset = () => {
    if (window.confirm('Wyczyścić wpisane serie i ciężary z tego treningu? Zapisane wcześniej treningi zostają.')) {
      setDraft(emptyDraft());
      setRest(null);
    }
  };

  const doneSets = plan.reduce((a, p) => a + Array.from({ length: p.sets }, (_, i) => (draft.sets[p.id]?.[i]?.done ? 1 : 0)).reduce<number>((x, y) => x + y, 0), 0);
  const totalSets = plan.reduce((a, p) => a + p.sets, 0);

  return (
    <main className="page strength">
      <header className="page-head">
        <nav className="seg-switch" aria-label="Wersja treningu">
          <a href={href.strength('full')} aria-current={variant === 'full' ? 'page' : undefined}>
            Pełny · {FULL.duration_min} min
          </a>
          <a href={href.strength('short')} aria-current={variant === 'short' ? 'page' : undefined}>
            Krótki · {SHORT.duration_min} min
          </a>
        </nav>
        <h1 className="page-title">{variant === 'full' ? 'Nogi na puch' : 'Siła krótka'}</h1>
        <p className="muted">
          Faza <b>{phase.name}</b>
          {phase.rir && <> · ciężar: {phase.rir}</>}
        </p>
        {phase.strength_text && <p>{phase.strength_text}</p>}
        <p className="st-progress num" aria-live="polite">
          Serie: <b>{doneSets}</b> z {totalSets}
        </p>
      </header>

      {saved && (
        <section className="card st-saved" role="status">
          <h2>Zapisane</h2>
          <p>Trening z dnia {prettyDate(saved)} jest w kalendarzu. Twoje ciężary podpowiedzą się następnym razem.</p>
          <div className="row">
            <a className="btn btn-primary" href={href.plan()}>
              <Icon name="calendar" />
              Zobacz plan
            </a>
          </div>
        </section>
      )}

      {draft.date !== todayIso() && hasProgress(draft) && (
        <p className="notice">
          Ten trening zaczął się {prettyDate(draft.date)} i zapisze się z tą datą. Jeśli to nowy trening, wyczyść go przyciskiem na dole.
        </p>
      )}

      {variant === 'full' && (
        <section className="card" aria-labelledby="warm-h">
          <h2 id="warm-h">Rozgrzewka · {FULL.warmup.min} min</h2>
          <ul className="checklist">
            {FULL.warmup.steps.map((s, i) => (
              <li key={s}>
                <label>
                  <input type="checkbox" checked={!!draft.warm[i]} onChange={() => toggleList('warm', i)} />
                  <span>{s}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="st-legend">
        <i aria-hidden="true" /> {FULL.note_highlight}
      </p>

      {plan.map((item, idx) => (
        <ExerciseCard
          key={item.id}
          n={idx + 1}
          item={item}
          sets={draft.sets[item.id] ?? []}
          prev={sessions ? lastSets(sessions, item.id) : null}
          onChange={(i, patch) => updateSet(item, i, patch)}
          onToggle={(i) => toggleDone(item, i)}
        />
      ))}

      {variant === 'full' && (
        <section className="card" aria-labelledby="core-h">
          <h2 id="core-h">Core · {FULL.core.min} min</h2>
          <ul className="checklist">
            {FULL.core.items.map((s, i) => (
              <li key={s}>
                <label>
                  <input type="checkbox" checked={!!draft.core[i]} onChange={() => toggleList('core', i)} />
                  <span>{s}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card">
        <summary>Zasady</summary>
        <ul className="steps">
          {FULL.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="hint">{LOGGING_HINT}</p>
      </details>

      <section className="card" aria-labelledby="save-h">
        <h2 id="save-h">Zapis</h2>
        <div className="field">
          <span className="label" id="rpe-l">
            Jak ciężko (1–10)
          </span>
          <div className="chips" role="group" aria-labelledby="rpe-l">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={draft.rpe === n} onClick={() => setDraft((d) => ({ ...d, rpe: d.rpe === n ? undefined : n }))}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-notes">Notatka</label>
          <textarea id="st-notes" className="input" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="np. przysiad 70 kg, kolano OK" />
        </div>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!hasProgress(draft)}>
            <Icon name="check" />
            Zapisz trening
          </button>
          <button type="button" className="btn" onClick={reset} disabled={!hasProgress(draft)}>
            Wyczyść
          </button>
        </div>
      </section>

      {rest && <RestBar rest={rest} onChange={setRest} />}
    </main>
  );
}

function ExerciseCard(props: {
  n: number;
  item: PlanItem;
  sets: SetLog[];
  prev: { date: string; sets: SetLog[] } | null;
  onChange: (i: number, patch: Partial<SetLog>) => void;
  onToggle: (i: number) => void;
}) {
  const { n, item, sets, prev, onChange, onToggle } = props;
  const allDone = Array.from({ length: item.sets }, (_, i) => !!sets[i]?.done).every(Boolean);
  return (
    <article className="card ex" data-done={allDone || undefined} aria-labelledby={`ex-${item.id}`}>
      <header className="ex-head">
        <span className="ex-num num">{n}</span>
        <h2 id={`ex-${item.id}`}>{item.name}</h2>
        {allDone && (
          <span className="ex-ok" aria-label="Zrobione">
            <Icon name="check" />
          </span>
        )}
      </header>
      <div className="ex-body">
        {item.animation && <ExerciseFigure exerciseKey={item.animation} name={item.name} />}
        <div className="ex-info">
          <dl className="ex-rx">
            <dt>Serie</dt>
            <dd>{item.setsText}</dd>
            {item.tempo && (
              <>
                <dt>Tempo</dt>
                <dd>{item.tempo}</dd>
              </>
            )}
            {item.restText && (
              <>
                <dt>Przerwa</dt>
                <dd>{item.restText}</dd>
              </>
            )}
          </dl>
          {item.why && <p className="ex-why">{item.why}</p>}
        </div>
      </div>
      {item.cues.length > 0 && (
        <details>
          <summary>Wskazówki</summary>
          <ul className="steps">
            {item.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      )}
      {item.extra && <p className="notice">{item.extra}</p>}
      {prev && (
        <p className="ex-prev">
          Poprzednio ({prettyDate(prev.date)}): <b className="num">{setsSummary(prev.sets)}</b>
        </p>
      )}
      <ol className="sets">
        {Array.from({ length: item.sets }, (_, i) => {
          const s = sets[i] ?? {};
          const p = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
          return (
            <li key={i} className="set" data-done={s.done || undefined}>
              <span className="set-n num">{i + 1}</span>
              {item.timed ? (
                <label className="set-field">
                  <input
                    className="input num"
                    inputMode="numeric"
                    aria-label={`Seria ${i + 1}: sekundy`}
                    placeholder={p?.sec != null ? String(p.sec) : ''}
                    value={s.sec ?? ''}
                    onChange={(e) => onChange(i, { sec: numOrUndef(e.target.value) })}
                  />
                  <span>s</span>
                </label>
              ) : null}
              <label className="set-field">
                <input
                  className="input num"
                  inputMode="decimal"
                  aria-label={`Seria ${i + 1}: ciężar w kg`}
                  placeholder={p?.kg != null ? String(p.kg) : ''}
                  value={s.kg ?? ''}
                  onChange={(e) => onChange(i, { kg: numOrUndef(e.target.value) })}
                />
                <span>kg</span>
              </label>
              {!item.timed && (
                <label className="set-field">
                  <span>×</span>
                  <input
                    className="input num"
                    inputMode="numeric"
                    aria-label={`Seria ${i + 1}: powtórzenia`}
                    placeholder={p?.reps != null ? String(p.reps) : (item.repsHint.match(/\d+(?:–\d+)?/)?.[0] ?? '')}
                    value={s.reps ?? ''}
                    onChange={(e) => onChange(i, { reps: numOrUndef(e.target.value) })}
                  />
                </label>
              )}
              <button type="button" className="set-check" aria-pressed={!!s.done} aria-label={`Seria ${i + 1} zrobiona`} onClick={() => onToggle(i)}>
                <Icon name="check" />
              </button>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function RestBar({ rest, onChange }: { rest: { endsAt: number; total: number }; onChange: (r: { endsAt: number; total: number } | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const lastSec = useRef<number | null>(null);
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (lastSec.current === left) return;
    lastSec.current = left;
    if (left >= 1 && left <= 3) sounds.countdown();
    if (left === 0) {
      sounds.finish();
      navigator.vibrate?.(300);
    }
  }, [left]);

  return (
    <div className="rest-bar" role="timer" aria-label={`Przerwa: zostało ${left} s`} data-over={left === 0 || undefined}>
      <div className="rest-fill" style={{ transform: `scaleX(${rest.total ? 1 - left / rest.total : 1})` }} />
      <span className="rest-label">{left === 0 ? 'Następna seria' : 'Przerwa'}</span>
      <b className="rest-time num">{clock(left)}</b>
      <button type="button" className="btn" onClick={() => onChange({ ...rest, endsAt: rest.endsAt + 30000, total: rest.total + 30 })}>
        +30 s
      </button>
      <button type="button" className="btn" onClick={() => onChange(null)} aria-label="Zamknij przerwę">
        <Icon name="close" />
      </button>
    </div>
  );
}
