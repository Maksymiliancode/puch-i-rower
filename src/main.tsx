import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import { App } from './App';
import { SettingsProvider } from './app/settings';
import { db, ensureSeeded, requestPersistence } from './data/db';
import { defaultSettings } from './data/defaults';

const root = createRoot(document.getElementById('root')!);

async function boot() {
  try {
    await ensureSeeded();
    void requestPersistence();
    const settings = (await db.settings.get('main')) ?? defaultSettings();
    root.render(
      <StrictMode>
        <SettingsProvider initial={settings}>
          <App />
        </SettingsProvider>
      </StrictMode>,
    );
  } catch (e) {
    console.error(e);
    root.render(
      <main className="page">
        <h1 className="page-title">Nie udało się otworzyć bazy danych</h1>
        <p>Zamknij aplikację całkiem i otwórz ponownie. Jeśli to nie pomoże, sprawdź, czy w Safari nie jest włączony tryb prywatny.</p>
      </main>,
    );
  }
}

void boot();
