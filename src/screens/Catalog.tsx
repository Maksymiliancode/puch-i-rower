import { useEffect } from 'react';
import { href } from '../app/route';
import { useSettings } from '../app/settings';
import { Icon } from '../components/Icon';
import { WorkoutCard } from '../components/WorkoutCard';
import { orderForPhase } from '../domain/catalog';
import { FULL, SHORT } from '../domain/strength';
import { WORKOUTS, type WorkoutMeta } from '../domain/workouts';

const OTHER_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Bieganie', ids: ['r_easy', 'r_hills'] },
  { title: 'Pod górę i góry', ids: ['h_pack', 'm_day'] },
  { title: 'Regeneracja i inne', ids: ['mob', 'walk', 's_upper', 'other'] },
];

export function Catalog({ focus }: { focus?: string }) {
  const { phase } = useSettings();
  const rxKey = phase.bike_rx;
  const list = orderForPhase(rxKey);

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`wo-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus]);

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="page-title">Treningi</h1>
        <nav className="jump" aria-label="Działy">
          <a href="#/treningi/sila">Nogi na puch</a>
          <a href="#/treningi/rower">Rower</a>
          <a href="#/treningi/inne">Bieg i góry</a>
        </nav>
      </header>

      <section className="stack" id="wo-sila" aria-labelledby="sila-h">
        <h2 id="sila-h" className="section-title">
          Nogi na puch
        </h2>
        <p className="muted">
          Wersja na fazę <b>{phase.name}</b>
          {phase.rir && <>, ciężar: {phase.rir}</>}.
        </p>
        <StrengthCard id={FULL.id} title={FULL.name} text={`Rozgrzewka, 8 ćwiczeń z animacjami, core. Około ${FULL.duration_min} minut.`} to={href.strength('full')} />
        <StrengthCard id={SHORT.id} title={SHORT.name} text={`5 ćwiczeń, gdy brakuje czasu. Około ${SHORT.duration_min} minut.`} to={href.strength('short')} />
      </section>

      <section className="stack" id="wo-rower" aria-labelledby="rower-h">
        <h2 id="rower-h" className="section-title">
          Rower na Keiserze
        </h2>
        <p className="muted">
          Wersje na fazę <b>{phase.name}</b>. {phase.bike_role}
        </p>
        {list.map((w) => (
          <WorkoutCard key={w.id} workout={w} rxKey={rxKey} focused={w.id === focus} />
        ))}
      </section>

      <section className="stack" id="wo-inne" aria-labelledby="inne-h">
        <h2 id="inne-h" className="section-title">
          Bieg, góry i regeneracja
        </h2>
        {OTHER_GROUPS.map((g) => (
          <div key={g.title} className="stack">
            <h3 className="group-title">{g.title}</h3>
            {g.ids.map((id) => {
              const w = WORKOUTS.find((x) => x.id === id);
              return w ? <OtherCard key={id} w={w} focused={id === focus} /> : null;
            })}
          </div>
        ))}
      </section>
    </main>
  );
}

function StrengthCard({ id, title, text, to }: { id: string; title: string; text: string; to: string }) {
  return (
    <article className="card wo wo-strength" id={`wo-${id}`}>
      <header className="wo-head">
        <h3>{title}</h3>
      </header>
      <p>{text}</p>
      <div className="row">
        <a className="btn btn-primary" href={to}>
          <Icon name="dumbbell" />
          Otwórz trening
        </a>
      </div>
    </article>
  );
}

function OtherCard({ w, focused }: { w: WorkoutMeta; focused: boolean }) {
  const { phase } = useSettings();
  return (
    <article className="card wo wo-other" id={`wo-${w.id}`} data-focus={focused || undefined}>
      <header className="wo-head">
        <h3>{w.name}</h3>
        <div className="row">
          {w.hard && <span className="tag">mocny</span>}
          {w.equipment.length > 0 && <span className="tag">{w.equipment.map(EQUIPMENT_LABEL).join(', ')}</span>}
        </div>
      </header>
      <dl className="wo-rx">
        <dt>Ile</dt>
        <dd>{w.rxText(phase) ?? 'dowolnie'}</dd>
      </dl>
      {w.how.length > 0 && (
        <details className="wo-how">
          <summary>Jak to zrobić</summary>
          <ul>
            {w.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="row">
        <a className="btn" href={href.plan()}>
          <Icon name="calendar" />
          Zapisz w kalendarzu
        </a>
      </div>
    </article>
  );
}

function EQUIPMENT_LABEL(e: string): string {
  return ({ keiser_m3: 'Keiser', silownia: 'siłownia', schody_lub_bieznia: 'schody lub bieżnia', gory: 'góry', rower_szosowy: 'rower szosowy' } as Record<string, string>)[e] ?? e;
}
