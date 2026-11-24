import { useEffect } from 'react';
import { useSettings } from '../app/settings';
import { WorkoutCard } from '../components/WorkoutCard';
import { orderForPhase } from '../domain/catalog';

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
        <h1 className="page-title">Rower na Keiserze</h1>
        <p className="muted">
          Wersje na fazę <b>{phase.name}</b>. {phase.bike_role}
        </p>
      </header>
      {list.map((w) => (
        <WorkoutCard key={w.id} workout={w} rxKey={rxKey} focused={w.id === focus} />
      ))}
      <p className="muted">Nogi na puch, bieganie i góry pojawią się tu w kolejnych etapach.</p>
    </main>
  );
}
