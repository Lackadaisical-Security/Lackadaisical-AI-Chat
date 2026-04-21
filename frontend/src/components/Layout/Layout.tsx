import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { QuickThemeToggle } from '../ui/ThemeSwitcher';
import { Settings, Code2, Globe, History, User } from 'lucide-react';
import api from '../../services/api';

const navLinks = [
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/sessions', label: 'Sessions', icon: <History className="w-5 h-5" /> },
  { to: '/ide', label: 'IDE', icon: <Code2 className="w-5 h-5" /> },
  { to: '/emulator', label: 'Emulator', icon: <Globe className="w-5 h-5" /> },
  { to: '/journal', label: 'Journal', icon: '📔' },
  { to: '/plugins', label: 'Plugins', icon: '🧩' },
  { to: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const Layout: React.FC = () => {
  const location = useLocation();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Try to load user profile if authenticated
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.getProfile().then(res => {
        if (res.success && res.data?.user) {
          setUserName(res.data.user.name);
        }
      }).catch(() => { /* not logged in */ });
    }

    // Listen for storage changes (login/logout from other components)
    const handleStorage = () => {
      const t = localStorage.getItem('auth_token');
      if (!t) {
        setUserName(null);
      } else {
        api.getProfile().then(res => {
          if (res.success && res.data?.user) {
            setUserName(res.data.user.name);
          }
        }).catch(() => setUserName(null));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
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
            {userName && (
              <div className="mb-2 flex items-center justify-center gap-1.5">
                <User className="w-3 h-3" />
                <span className="font-medium text-[var(--color-text)]">{userName}</span>
              </div>
            )}
            <div className="mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full inline-block mr-2"></div>
              AI Connected
            </div>
            <div>v2.0.0-rc1</div>
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
