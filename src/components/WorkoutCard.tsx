import type { CSSProperties } from 'react';
import { href } from '../app/route';
import { useSettings } from '../app/settings';
import { hasTimer, workoutZone } from '../domain/catalog';
import { bpm, watts, ZONES, type ZoneId } from '../domain/zones';
import type { BikeRxKey, BikeWorkout } from '../domain/types';
import { Icon } from './Icon';
import { Profile } from './Profile';

export function zoneLine(zone: ZoneId, ftp: number, lthr: number): string {
  const z = ZONES[zone];
  const w = `${watts(ftp, z.pct_ftp[0])}–${watts(ftp, z.pct_ftp[1])} W`;
  const hr = z.pct_lthr ? ` · tętno ${bpm(lthr, z.pct_lthr[0])}–${bpm(lthr, z.pct_lthr[1])}` : '';
  return `${z.name}: ${w}${hr}. ${z.feel[0].toUpperCase()}${z.feel.slice(1)}.`;
}

export function WorkoutCard({ workout, rxKey, focused }: { workout: BikeWorkout; rxKey: BikeRxKey; focused?: boolean }) {
  const { settings } = useSettings();
  const rx = workout.rx[rxKey];
  const zone = workoutZone(workout, rxKey) as ZoneId;
  const available = !!rx;
  const recommended = available && (workout.phases_recommended?.includes(rxKey) ?? true);
  const minutes = rx ? Math.round(rx.segments.reduce((a, s) => a + s.sec, 0) / 60) : 0;

  return (
    <article className="wo card" id={`wo-${workout.id}`} data-off={!available || undefined} data-focus={focused || undefined} style={{ '--zc': `var(--zone-${zone})` } as CSSProperties}>
      <header className="wo-head">
        <h3>{workout.name}</h3>
        <div className="row">
          {workout.goals?.map((g) => (
            <span key={g} className="tag">
              {g}
            </span>
          ))}
          {!available && <span className="tag">nie w tej fazie</span>}
          {available && !recommended && <span className="tag">poza planem fazy</span>}
        </div>
      </header>

      <p className="wo-why">{workout.why}</p>

      {rx && rx.segments.length > 0 && (
        <div className="wo-profile">
          <Profile parts={rx.segments.map((s) => ({ sec: s.sec, pct: s.pct_ftp }))} />
          <p className="wo-profile-cap">
            <span className="num">{minutes} min</span>
            <span>linia przerywana = FTP</span>
          </p>
        </div>
      )}

      <dl className="wo-rx">
        <dt>Ile</dt>
        <dd>{rx ? rx.text : 'Ten trening nie jest rozpisany na bieżącą fazę.'}</dd>
        <dt>Jak mocno</dt>
        <dd>{ZONES[zone] ? zoneLine(zone, settings.ftpW, settings.lthrBike) : zone}</dd>
      </dl>

      <details className="wo-how">
        <summary>Jak to zrobić</summary>
        <ul>
          {workout.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </details>

      {rx && hasTimer(workout, rxKey) && (
        <div className="row">
          <a className="btn btn-zone" href={href.timer(workout.id)}>
            <Icon name="play" filled />
            Uruchom timer
          </a>
        </div>
      )}
    </article>
  );
}
