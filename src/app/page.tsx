'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import LoginView from '@/components/auth/LoginView';
import RegisterView from '@/components/auth/RegisterView';
import OverviewTab from '@/components/dashboard/OverviewTab';
import VulnerabilitiesTab from '@/components/dashboard/VulnerabilitiesTab';
import AttackSurfaceTab from '@/components/dashboard/AttackSurfaceTab';
import AboutTab from '@/components/dashboard/AboutTab';
import ScannerTab from '@/components/dashboard/ScannerTab';
import SettingsTab from '@/components/dashboard/SettingsTab';
import NotificationCenter from '@/components/dashboard/NotificationCenter';
import { Search, Shield, LayoutDashboard, Layers, Network, ScanLine, Settings, LogOut, Menu, X, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardRefreshBridge } from '@/hooks/dashboardQueries';

type TabId = 'overview' | 'vulnerabilities' | 'surface' | 'scanner' | 'settings' | 'about';

const NAV_ITEMS = [
  { id: 'overview',        label: 'Overview',        icon: LayoutDashboard, desc: 'Security posture summary' },
  { id: 'vulnerabilities', label: 'Vulnerabilities',  icon: Layers,          desc: 'Manage and remediate flaws' },
  { id: 'surface',         label: 'Attack Surface',   icon: Network,         desc: 'What is externally observable' },
  { id: 'scanner',         label: 'Scanner',          icon: ScanLine,        desc: 'Perimeter security scan' },
  { id: 'settings',        label: 'Settings',         icon: Settings,        desc: 'Account & security config' },
  { id: 'about',           label: 'About',            icon: Info,            desc: 'Project scope and team' },
] as const;

export default function HomeRoot() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [globalSearch, setGlobalSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [initialResetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('reset_token');
  });

  // Scans and vulnerability edits announce themselves with window events;
  // this turns them into cache invalidation for the dashboard queries.
  useDashboardRefreshBridge();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      toast.success('Email address verified successfully!', {
        description: 'Your account is now verified.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
    const verifyError = params.get('verify_error');
    if (verifyError) {
      toast.error('Verification failed', {
        description: decodeURIComponent(verifyError),
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleTabChange = useCallback((id: TabId) => {
    setActiveTab(id);
    setMobileOpen(false);
    setGlobalSearch('');
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#efe1c4] font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#e3d2a9] border-t-[#7f9548] rounded-full animate-spin" />
          <p className="text-xs text-[#937d57] font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Auth Views ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return authView === 'login' ? (
      <LoginView
        onSwitchToRegister={() => setAuthView('register')}
        initialResetToken={initialResetToken}
      />
    ) : (
      <RegisterView onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  // ── Active tab renderer ───────────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case 'vulnerabilities': return <VulnerabilitiesTab searchQuery={globalSearch} />;
      case 'surface':         return <AttackSurfaceTab searchQuery={globalSearch} />;
      case 'about':           return <AboutTab />;
      case 'scanner':         return <ScannerTab />;
      case 'settings':        return <SettingsTab />;
      default:                return <OverviewTab onOpenScanner={() => handleTabChange('scanner')} />;
    }
  };

  const searchableTab = activeTab === 'vulnerabilities' || activeTab === 'surface';
  const currentItem = NAV_ITEMS.find((n) => n.id === activeTab);

  // ── Sidebar (shared between desktop + mobile) ─────────────────────────────
  // A JSX value, not a nested component: defining a component inside the render
  // body creates a new type every render, which remounts the whole subtree.
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e3d2a9]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#7f9548]/15 border border-[#7f9548]/20">
          <Shield className="w-4 h-4 text-[#47601f]" />
        </div>
        <div>
          <span className="text-sm font-bold text-[#2a2013] tracking-tight">SecureBiz</span>
          <span className="block text-xs text-[#937d57] leading-none mt-0.5">Security Dashboard</span>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-5 pb-1.5">
        <p className="text-xs font-semibold text-[#a6906a] uppercase tracking-widest">Navigation</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id as TabId)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all duration-150 cursor-pointer focus:outline-none group',
                isActive ? 'sidebar-active' : 'text-[#937d57] hover:text-[#2a2013] hover:bg-[#efe1c4]'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-[#47601f]' : 'text-[#a6906a] group-hover:text-[#6b572f]')} />
              <span className="text-xs font-medium">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-[#47601f] opacity-60" />}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="mt-auto border-t border-[#e3d2a9] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#efe1c4] border border-[#e3d2a9] flex items-center justify-center text-xs font-bold text-[#47601f] shrink-0 uppercase">
            {user?.name?.charAt(0) ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#2a2013] truncate leading-tight">{user?.name}</p>
            <p className="text-xs text-[#937d57] capitalize mt-0.5">{user?.role} · {user?.plan}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-[#937d57] hover:text-[#8a3122] hover:bg-[#a8402e]/8 border border-transparent hover:border-[#a8402e]/15 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  // ── Dashboard Layout ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#efe1c4] text-[#2a2013] font-sans overflow-hidden">
      {/* Keyboard and screen-reader users can jump past the navigation. Visible
          only once focused, so it does not disturb the visual design. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[#fffbf3] focus:text-[#2a2013] focus:border focus:border-[#7f9548] focus:shadow-lg text-sm font-semibold"
      >
        Skip to main content
      </a>
      <aside className="hidden md:flex flex-col w-60 bg-[#fffbf3] border-r border-[#e3d2a9] shrink-0">
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-64 bg-[#fffbf3] border-r border-[#e3d2a9] z-50 md:hidden"
            >
              <div className="absolute top-3 right-3">
                <button onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className="p-1.5 rounded-lg text-[#937d57] hover:text-[#2a2013] hover:bg-[#efe1c4] transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between h-14 px-5 border-b border-[#e3d2a9] bg-[#fffbf3] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileOpen} className="p-1.5 rounded-lg text-[#937d57] hover:text-[#2a2013] hover:bg-[#efe1c4] md:hidden transition-colors cursor-pointer">
              <Menu className="w-4.5 h-4.5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#a6906a] hidden sm:block">Dashboard</span>
              <span className="text-xs text-[#e3d2a9] hidden sm:block">/</span>
              <span className="text-xs font-semibold text-[#2a2013]">{currentItem?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {searchableTab && (
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a6906a]" />
                <input
                  type="text"
                  placeholder={activeTab === 'vulnerabilities' ? 'Search vulnerabilities...' : 'Search hosts...'}
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-52 pl-8 pr-3 py-1.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-xs text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-[#7f9548]/50 focus:ring-1 focus:ring-[#7f9548]/15 transition-all"
                />
                {globalSearch && (
                  <button onClick={() => setGlobalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a6906a] hover:text-[#6b572f] cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <NotificationCenter />

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#e3d2a9]">
              <div className="w-7 h-7 rounded-full bg-[#efe1c4] border border-[#e3d2a9] flex items-center justify-center text-xs font-bold text-[#47601f] uppercase">
                {user?.name?.charAt(0) ?? 'U'}
              </div>
              <span className="text-xs text-[#937d57] max-w-[100px] truncate">{user?.name}</span>
            </div>
          </div>
        </header>

        {searchableTab && (
          <div className="sm:hidden px-4 py-2 bg-[#fffbf3] border-b border-[#e3d2a9]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a6906a]" />
              <input
                type="text"
                placeholder={activeTab === 'vulnerabilities' ? 'Search vulnerabilities...' : 'Search hosts...'}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-xs text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-[#7f9548]/50 transition-all"
              />
            </div>
          </div>
        )}

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto bg-[#efe1c4]">
          <div className="max-w-7xl mx-auto p-5 md:p-6">{renderTab()}</div>
        </main>
      </div>
    </div>
  );
}
