import { href, type Route } from '../app/route';
import { Icon, type IconName } from './Icon';

const TABS: { name: Route['name']; label: string; to: string; icon: IconName; also?: Route['name'][] }[] = [
  { name: 'today', label: 'Dziś', to: href.today, icon: 'today' },
  { name: 'plan', label: 'Plan', to: href.plan(), icon: 'calendar' },
  { name: 'catalog', label: 'Treningi', to: href.catalog(), icon: 'list', also: ['strength'] },
  { name: 'settings', label: 'Ustawienia', to: href.settings, icon: 'settings' },
];

export function TabBar({ current }: { current: Route['name'] }) {
  return (
    <nav className="tabbar" aria-label="Główne">
      {TABS.map((t) => (
        <a key={t.name} href={t.to} aria-current={current === t.name || t.also?.includes(current) ? 'page' : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}
