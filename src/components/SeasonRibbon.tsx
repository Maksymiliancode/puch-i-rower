import { daysBetween } from '../domain/season';
import type { Phase, SeasonEvent } from '../domain/types';
import { prettyDate } from '../domain/format';

/** Pasek sezonu: fazy proporcjonalnie do długości, znacznik „dziś” i wydarzenia. */
export function SeasonRibbon({ phases, events, today, currentId }: { phases: Phase[]; events: SeasonEvent[]; today: string; currentId: string }) {
  const sorted = [...phases].sort((a, b) => a.start.localeCompare(b.start));
  const start = sorted[0].start;
  const end = sorted[sorted.length - 1].end;
  const total = daysBetween(start, end) + 1;
  const pos = (d: string) => Math.min(100, Math.max(0, (daysBetween(start, d) / total) * 100));

  return (
    <figure className="ribbon" aria-label="Sezon">
      <div className="ribbon-track">
        {sorted.map((p) => (
          <div
            key={p.id}
            className="ribbon-phase"
            data-current={p.id === currentId || undefined}
            style={{ width: `${((daysBetween(p.start, p.end) + 1) / total) * 100}%` }}
            title={`${p.name}: ${prettyDate(p.start)} – ${prettyDate(p.end)}`}
          >
            <span>{p.id}</span>
          </div>
        ))}
        {events.map((e) => (
          <span key={e.id} className="ribbon-event" style={{ left: `${pos(e.date)}%` }} aria-hidden="true" />
        ))}
        <span className="ribbon-today" style={{ left: `${pos(today)}%` }} aria-hidden="true" />
      </div>
      <figcaption className="ribbon-legend">
        {events.map((e) => (
          <span key={e.id}>
            <i className="ribbon-flag" aria-hidden="true" />
            {e.name}, {prettyDate(e.date)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
