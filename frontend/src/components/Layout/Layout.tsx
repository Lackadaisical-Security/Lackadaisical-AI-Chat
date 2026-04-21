import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { QuickThemeToggle } from '../ui/ThemeSwitcher';
import { Settings, Code2 } from 'lucide-react';

const navLinks = [
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/ide', label: 'IDE', icon: <Code2 className="w-5 h-5" /> },
  { to: '/journal', label: 'Journal', icon: '📔' },
  { to: '/plugins', label: 'Plugins', icon: '🧩' },
  { to: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const Layout: React.FC = () => {
  const location = useLocation();
  
  return (
    <div className="flex min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--color-card)] border-r border-[var(--color-border)] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[var(--color-primary)]">
              Lackadaisical AI
            </h1>
            <QuickThemeToggle />
          </div>
          <p className="text-sm text-[var(--color-textMuted)] mt-1">
            Your AI Companion
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium
                  transition-[var(--animation-transition)]
                  hover:bg-[var(--color-backgroundSecondary)] hover:text-[var(--color-primary)]
                  ${location.pathname.startsWith(link.to) 
                    ? 'bg-[var(--color-primary)] text-white shadow-md' 
                    : 'text-[var(--color-textSecondary)]'
                  }`}
              >
                <span className="flex-shrink-0">
                  {typeof link.icon === 'string' ? (
                    <span className="text-lg">{link.icon}</span>
                  ) : (
                    link.icon
                  )}
                </span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-textMuted)] text-center">
            <div className="mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full inline-block mr-2"></div>
              AI Connected
            </div>
            <div>v2.0.0-alpha</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
