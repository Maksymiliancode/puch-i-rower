import { parseRoute, useHash } from './app/route';
import { TabBar } from './components/TabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Catalog } from './screens/Catalog';
import { SettingsScreen } from './screens/SettingsScreen';
import { TimerScreen } from './screens/timer/Timer';
import { Today } from './screens/Today';

export function App() {
  const route = parseRoute(useHash());

  if (route.name === 'timer') return <TimerScreen workoutId={route.workoutId} />;

  return (
    <div className="shell">
      {route.name === 'today' && <Today />}
      {route.name === 'catalog' && <Catalog focus={route.focus} />}
      {route.name === 'settings' && <SettingsScreen />}
      <UpdatePrompt />
      <TabBar current={route.name} />
    </div>
  );
}
