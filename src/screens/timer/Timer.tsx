import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { navigate, href } from '../../app/route';
import { useSettings } from '../../app/settings';
import { Icon } from '../../components/Icon';
import { Profile } from '../../components/Profile';
import { bikeWorkout } from '../../domain/catalog';
import { clock, duration, hrText, isLongRest, KEISER_REST_HINT, powerText, repText } from '../../domain/format';
import type { BikeRxKey, Segment } from '../../domain/types';
import { segmentTarget, ZONES, type MetricId, type SegmentTarget } from '../../domain/zones';
import { unlockAudio } from '../../lib/audio';
import { hasVoice } from '../../lib/speech';
import { clearTimer } from '../../lib/timerStore';
import { lockScreen } from '../../lib/wakeLock';
import { TimerDone } from './TimerDone';
import { useBikeTimer } from './useBikeTimer';
import './timer.css';

const METRIC_LABEL: Record<MetricId, string> = { power: 'Moc', hr: 'Tętno', cadence: 'Kadencja' };

function metricValue(m: MetricId, t: SegmentTarget): { value: string; unit: string } {
  if (m === 'power') return powerText(t.power);
  if (m === 'hr') return hrText(t.hr);
  return { value: t.cadence, unit: 'rpm' };
}

const chars = (s: string) => Math.max(3, s.length);

export function TimerScreen({ workoutId }: { workoutId: string }) {
  const { phase } = useSettings();
  const workout = bikeWorkout(workoutId);
  const rxKey = phase.bike_rx;
  // Wersja z bieżącej fazy, a gdy jej nie ma — pierwsza dostępna.
  const key = (workout?.rx[rxKey] ? rxKey : (Object.keys(workout?.rx ?? {})[0] as BikeRxKey | undefined)) ?? rxKey;
  const rx = workout?.rx[key];

  if (!workout || !rx || rx.segments.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Brak timera dla tego treningu</h1>
        <p>Ten trening nie ma rozpisanych odcinków. Wybierz inny w katalogu.</p>
        <a className="btn" href={href.catalog()}>
          Wróć do treningów
        </a>
      </div>
    );
  }
  return <TimerRun key={`${workoutId}-${key}`} workoutId={workoutId} rxKey={key} />;
}

function TimerRun({ workoutId, rxKey }: { workoutId: string; rxKey: BikeRxKey }) {
  const { settings, save } = useSettings();
  const workout = bikeWorkout(workoutId)!;
  const rx = workout.rx[rxKey]!;
  const segments = rx.segments;
  const { ftpW, lthrBike } = settings;
  const targetOf = useCallback((seg: Segment) => segmentTarget(seg, ftpW, lthrBike), [ftpW, lthrBike]);

  const t = useBikeTimer({ workoutId, rxKey, segments, targetOf, sound: settings.timer.sound, voice: settings.timer.voice });
  const { timer, view: v } = t;

  const [endArmed, setEndArmed] = useState(false);
  const [needsTouch, setNeedsTouch] = useState(t.restored && t.running);

  useEffect(() => {
    if (!endArmed) return;
    const id = window.setTimeout(() => setEndArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [endArmed]);

  const seg = segments[timer.idx];
  const target = targetOf(seg);
  const nextSeg = segments[timer.idx + 1];
  const nextTarget = nextSeg ? targetOf(nextSeg) : null;
  const primary: MetricId = t.primary ?? target.primary;
  const secondary = (['power', 'hr', 'cadence'] as MetricId[]).filter((m) => m !== primary);
  const warn = t.running && v.segDurSec >= 10 && v.segLeftSec <= 3.05;
  const parts = segments.map((s, i) => ({ sec: timer.durations[i], pct: s.pct_ftp }));

  const close = () => {
    clearTimer();
    navigate(href.catalog(workoutId));
  };

  const toggle = () => (t.running ? t.pause() : t.start());

  const onEnd = () => {
    if (!timer.started) return close();
    if (endArmed) {
      setEndArmed(false);
      t.end();
    } else setEndArmed(true);
  };

  // Klawiatura (podgląd na komputerze): spacja = start/pauza, strzałki = odcinki.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (timer.done || (e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        if (t.running) t.pause();
        else t.start();
      } else if (e.key === 'ArrowRight') t.next();
      else if (e.key === 'ArrowLeft') t.prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t, timer.done]);

  const onTouch = () => {
    if (!needsTouch) return;
    unlockAudio();
    void lockScreen();
    setNeedsTouch(false);
  };

  const zc = `var(--zone-${target.zone})`;
  const cue = [seg.cue, isLongRest(seg) ? KEISER_REST_HINT : null].filter(Boolean).join('. ');
  const segClockChars = chars(clock(v.segDurSec));

  let hint: string | null = null;
  if (needsTouch) hint = 'Trening wznowiony. Dotknij ekranu, żeby włączyć sygnały.';
  else if (!timer.started) hint = 'Włącz na zegarku „Rower stacjonarny” i naciśnij Start. Przed zmianą odcinka: 3 krótkie sygnały.';
  const screenWarning = timer.started && t.wakeOk === false;

  if (timer.done) {
    return (
      <div className="timer timer--done" style={{ '--zc': zc } as CSSProperties}>
        <TimerDone
          workout={workout}
          rxKey={rxKey}
          garminTitle={rx.garmin_title ?? workout.name}
          elapsedSec={t.elapsedAtEnd ?? v.totalSec}
          startedAt={t.startedAt}
          onClose={close}
        />
      </div>
    );
  }

  return (
    <div className="timer" data-warn={warn || undefined} data-zone={target.zone} style={{ '--zc': zc } as CSSProperties} onPointerDown={onTouch}>
      <header className="t-top">
        {!timer.started && (
          <button type="button" className="t-icon" onClick={close} aria-label="Zamknij timer">
            <Icon name="close" />
          </button>
        )}
        <div className="t-titles">
          <h1 className="t-title">{workout.name}</h1>
          <p className="t-total num">
            <b>{clock(v.totalElapsedSec)}</b> z {clock(v.totalSec)}
            <span className="t-left">zostało {clock(v.totalLeftSec)}</span>
          </p>
        </div>
        {screenWarning && (
          <p className="t-badge" title="Na czas jazdy wyłącz autoblokadę (Ustawienia → Ekran i jasność). Timer liczy dalej także po wygaszeniu.">
            Ekran może zgasnąć
          </p>
        )}
      </header>

      <div className="t-profile">
        <Profile parts={parts} height={60} className="t-profile-svg" />
        <span className="t-mark" style={{ left: `${(v.totalElapsedSec / v.totalSec) * 100}%` }} />
      </div>

      <section className="t-slab" aria-label="Bieżący odcinek">
        <p className="t-rep">{repText(seg) || `Odcinek ${timer.idx + 1} z ${segments.length}`}</p>
        <h2 className="t-seg">{seg.label}</h2>
        <div className="t-clock-wrap">
          <div className="t-clock num" role="timer" aria-label={`Do końca odcinka ${clock(v.segLeftSec)}`} style={{ '--chars': segClockChars } as CSSProperties}>
            {clock(v.segLeftSec)}
          </div>
        </div>
        <div className="t-bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${v.segDurSec ? v.segElapsedSec / v.segDurSec : 0})` }} />
        </div>
        <p className="t-zone">
          <b>{ZONES[target.zone].name}</b> {ZONES[target.zone].feel}
        </p>
      </section>

      <section className="t-metrics" aria-label="Cele">
        <MetricTile metric={primary} target={target} primary pinned={t.primary !== null} onUnpin={() => t.setPrimary(null)} />
        <div className="t-secondary">
          {secondary.map((m) => (
            <MetricTile key={m} metric={m} target={target} onPromote={() => t.setPrimary(m)} />
          ))}
        </div>
        {(cue || hint) && <p className={hint ? 't-cue t-cue--hint' : 't-cue'}>{hint ?? cue}</p>}
        <p className="t-next">
          {nextSeg && nextTarget ? (
            <>
              Dalej: <b>{nextSeg.label}</b> · {duration(timer.durations[timer.idx + 1])} · {powerText(nextTarget.power).value}
              {powerText(nextTarget.power).unit && ` ${powerText(nextTarget.power).unit}`} · kad. {nextSeg.cadence}
            </>
          ) : (
            'Dalej: koniec treningu'
          )}
        </p>
      </section>

      <nav className="t-controls" aria-label="Sterowanie timerem">
        <button type="button" className="t-btn" onClick={t.prev} aria-label="Wstecz: początek odcinka albo poprzedni odcinek">
          <Icon name="prev" filled />
        </button>
        <button type="button" className="t-btn t-btn--main" onClick={toggle}>
          <Icon name={t.running ? 'pause' : 'play'} filled={!t.running} />
          {t.running ? 'Pauza' : timer.started ? 'Wznów' : 'Start'}
        </button>
        <button type="button" className="t-btn" onClick={t.next} aria-label="Dalej: następny odcinek">
          <Icon name="next" filled />
        </button>
        <button type="button" className="t-btn t-btn--sub" onClick={() => t.adjust(-60)} aria-label="Skróć odcinek o minutę">
          −1 min
        </button>
        <button type="button" className="t-btn t-btn--sub" onClick={() => t.adjust(60)} aria-label="Wydłuż odcinek o minutę">
          +1 min
        </button>
        <button
          type="button"
          className="t-btn t-btn--sub"
          aria-pressed={settings.timer.sound}
          aria-label={settings.timer.sound ? 'Wyłącz dźwięk' : 'Włącz dźwięk'}
          onClick={() => void save({ timer: { ...settings.timer, sound: !settings.timer.sound } })}
        >
          <Icon name={settings.timer.sound ? 'soundOn' : 'soundOff'} />
        </button>
        {hasVoice && (
          <button
            type="button"
            className="t-btn t-btn--sub"
            aria-pressed={settings.timer.voice}
            aria-label={settings.timer.voice ? 'Wyłącz głos zapowiadający odcinki' : 'Włącz głos zapowiadający odcinki'}
            onClick={() => void save({ timer: { ...settings.timer, voice: !settings.timer.voice } })}
          >
            <Icon name="voice" />
          </button>
        )}
        <button type="button" className="t-btn t-btn--sub t-btn--end" data-armed={endArmed || undefined} onClick={onEnd}>
          {endArmed ? 'Na pewno?' : 'Zakończ'}
        </button>
      </nav>
    </div>
  );
}

function MetricTile(props: {
  metric: MetricId;
  target: SegmentTarget;
  primary?: boolean;
  pinned?: boolean;
  onPromote?: () => void;
  onUnpin?: () => void;
}) {
  const { metric, target, primary, pinned, onPromote, onUnpin } = props;
  const { value, unit } = metricValue(metric, target);
  const body = (
    <>
      <span className="t-mlabel">
        {METRIC_LABEL[metric]}
        {primary && pinned && <span className="t-pin">przypięte</span>}
      </span>
      <span className="t-mvalue">
        <b className="num" style={{ '--chars': chars(value) } as CSSProperties}>
          {value}
        </b>
        {unit && <small>{unit}</small>}
      </span>
    </>
  );
  if (primary) {
    return pinned ? (
      <button type="button" className="t-tile t-tile--primary" onClick={onUnpin} aria-label={`${METRIC_LABEL[metric]} ${value} ${unit}. Dotknij, żeby wrócić do automatycznego wyboru`}>
        {body}
      </button>
    ) : (
      <div className="t-tile t-tile--primary">{body}</div>
    );
  }
  return (
    <button type="button" className="t-tile" onClick={onPromote} aria-label={`${METRIC_LABEL[metric]} ${value} ${unit}. Dotknij, żeby powiększyć`}>
      {body}
    </button>
  );
}
