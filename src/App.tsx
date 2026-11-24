import { parseRoute, useHash } from './app/route';
import { TabBar } from './components/TabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Catalog } from './screens/Catalog';
import { PlanScreen } from './screens/plan/PlanScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StrengthScreen } from './screens/strength/StrengthScreen';
import { TimerScreen } from './screens/timer/Timer';
import { Today } from './screens/Today';

export function App() {
  const route = parseRoute(useHash());

  if (route.name === 'timer') return <TimerScreen workoutId={route.workoutId} />;

  return (
    <div className="shell">
      {route.name === 'today' && <Today />}
      {route.name === 'plan' && <PlanScreen focus={route.date} />}
      {route.name === 'catalog' && <Catalog focus={route.focus} />}
      {route.name === 'strength' && <StrengthScreen key={route.variant} variant={route.variant} />}
      {route.name === 'settings' && <SettingsScreen />}
      <UpdatePrompt />
      <TabBar current={route.name} />
    </div>
  );
}
