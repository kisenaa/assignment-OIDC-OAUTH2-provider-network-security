import { Link } from 'react-router';

import { sidebarItems } from './constants';

type SettingsSidebarProps = {
  activeTab: string;
};

const SettingsSidebar = ({ activeTab }: SettingsSidebarProps) => {
  return (
    <aside className="h-fit rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
      <p className="px-2 pb-3 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
        Manage Account
      </p>
      <nav className="space-y-1.5">
        {sidebarItems.map(item => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              to={item.href}
              className={[
                'flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                activeTab === item.tab
                  ? 'bg-slate-900 text-amber-100'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900',
              ].join(' ')}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        Keycloak & Ory Hydra Assignment
      </div>
    </aside>
  );
};

export default SettingsSidebar;
