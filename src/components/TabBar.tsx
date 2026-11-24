import { href, type Route } from '../app/route';
import { Icon, type IconName } from './Icon';

const TABS: { name: Route['name']; label: string; to: string; icon: IconName }[] = [
  { name: 'today', label: 'Dziś', to: href.today, icon: 'today' },
  { name: 'catalog', label: 'Treningi', to: href.catalog(), icon: 'list' },
  { name: 'settings', label: 'Ustawienia', to: href.settings, icon: 'settings' },
];

export function TabBar({ current }: { current: Route['name'] }) {
  return (
    <nav className="tabbar" aria-label="Główne">
      {TABS.map((t) => (
        <a key={t.name} href={t.to} aria-current={current === t.name ? 'page' : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}
