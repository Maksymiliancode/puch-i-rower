import { useState } from 'react';
import { prettyDate } from '../../domain/format';
import { addDays, mondayOf } from '../../domain/planner';
import { hoursText, summarize, trainingsText } from '../../domain/summary';
import type { Phase, PhaseId, Session } from '../../domain/types';
import { FAMILY_LABEL } from '../../domain/workouts';
import { famStyle } from './common';

type Period = 'week' | 'month' | 'phase' | 'season';

const monthFmt = new Intl.DateTimeFormat('pl-PL', { month: 'long', timeZone: 'UTC' });

/** Ile treningów jakiego rodzaju: tydzień, miesiąc z kalendarza, faza, cały sezon. */
export function SummaryCard({ sessions, month, today, phases, phaseId }: { sessions: Session[]; month: string; today: string; phases: Phase[]; phaseId: PhaseId }) {
  const [period, setPeriod] = useState<Period>('month');
  const phase = phases.find((p) => p.id === phaseId) ?? phases[0];
  const seasonStart = [...phases].sort((a, b) => a.start.localeCompare(b.start))[0]?.start ?? '2000-01-01';
  const monthName = monthFmt.format(new Date(`${month}-01T12:00:00Z`));
  const monthEnd = addDays(`${month}-01`, 40).slice(0, 7) + '-01';

  const range: Record<Period, { from: string; to: string; label: string; chip: string }> = {
    week: { from: mondayOf(today), to: addDays(mondayOf(today), 6), label: `Tydzień od ${prettyDate(mondayOf(today))}`, chip: 'Tydzień' },
    month: { from: `${month}-01`, to: addDays(monthEnd, -1), label: monthName[0].toUpperCase() + monthName.slice(1), chip: monthName[0].toUpperCase() + monthName.slice(1) },
    phase: { from: phase.start, to: phase.end, label: `Faza ${phase.name}`, chip: 'Faza' },
    season: { from: seasonStart, to: today, label: `Od ${prettyDate(seasonStart)}`, chip: 'Sezon' },
  };
  const r = range[period];
  const sum = summarize(sessions, r.from, r.to);
  const max = Math.max(1, ...sum.byFamily.map((f) => f.count));

  return (
    <section className="card summary" aria-labelledby="sum-h">
      <h2 id="sum-h">Podsumowanie</h2>
      <div className="chips" role="group" aria-label="Okres">
        {(Object.keys(range) as Period[]).map((p) => (
          <button key={p} type="button" className="chip chip-text" aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {range[p].chip}
          </button>
        ))}
      </div>
      <p className="sum-total">
        <b className="num">{trainingsText(sum.count)}</b>
        {sum.minutes > 0 && <span className="num"> · {hoursText(sum.minutes)}</span>}
        <span className="muted"> · {r.label}</span>
      </p>
      {sum.byFamily.length === 0 ? (
        <p className="muted">W tym okresie nie ma jeszcze treningów.</p>
      ) : (
        <ul className="sum-list">
          {sum.byFamily.map((f) => (
            <li key={f.fam} style={famStyle(f.fam)}>
              <span className="sum-label">
                <i aria-hidden="true" />
                {FAMILY_LABEL[f.fam]}
              </span>
              <span className="sum-bar" aria-hidden="true">
                <span style={{ width: `${(f.count / max) * 100}%` }} />
              </span>
              <span className="sum-n num">{f.count}</span>
              <span className="sum-min num muted">{f.minutes ? hoursText(f.minutes) : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {sum.count > 0 && <p className="hint">Dni z treningiem: {sum.activeDays}. Czas liczony z wpisów, które go mają.</p>}
    </section>
  );
}
