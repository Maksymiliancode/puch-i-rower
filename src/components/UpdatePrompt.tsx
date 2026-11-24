import { useRegisterSW } from 'virtual:pwa-register/react';

/** Nowa wersja aplikacji: pytamy, zamiast przeładowywać w trakcie treningu. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {needRefresh ? (
        <>
          <span>Jest nowa wersja aplikacji.</span>
          <button type="button" className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
            Odśwież
          </button>
          <button type="button" className="btn" onClick={() => setNeedRefresh(false)}>
            Później
          </button>
        </>
      ) : (
        <>
          <span>Aplikacja działa teraz bez internetu.</span>
          <button type="button" className="btn" onClick={() => setOfflineReady(false)}>
            OK
          </button>
        </>
      )}
    </div>
  );
}
