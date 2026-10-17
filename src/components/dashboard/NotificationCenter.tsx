'use client';

import React, { useState, useSyncExternalStore } from 'react';
import type { Notification } from '@/types/common';
import { Bell, Check, Trash2, ShieldAlert, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, QUERY_KEYS } from '@/hooks/dashboardQueries';

/**
 * "5m ago" depends on the current time, which the server and the client do not
 * agree on — reading the clock during render causes a hydration mismatch and
 * the labels then sit frozen at whatever the first render computed. Subscribing
 * to a minute-resolution clock keeps render pure and lets the labels tick.
 */
const MINUTE_MS = 60_000;

function subscribeToMinute(onChange: () => void) {
  const id = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(id);
}

const getMinuteSnapshot = () => Math.floor(Date.now() / MINUTE_MS);
/** No clock on the server: 0 means "not hydrated yet", so show an absolute date. */
const getServerMinuteSnapshot = () => 0;

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useNotifications();

  /** Writes straight to the cache so the existing optimistic updates still apply. */
  const setNotifications = (
    updater: Notification[] | ((prev: Notification[]) => Notification[]),
  ) =>
    queryClient.setQueryData<Notification[]>(QUERY_KEYS.notifications, (prev) =>
      typeof updater === 'function' ? updater(prev ?? []) : updater);

  const currentMinute = useSyncExternalStore(subscribeToMinute, getMinuteSnapshot, getServerMinuteSnapshot);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }); } catch { /* optimistic */ }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }).catch(() => undefined)));
  };

  const handleClearAll = async () => {
    const all = notifications;
    setNotifications([]);
    await Promise.all(all.map((n) => fetch(`/api/notifications/${n.id}`, { method: 'DELETE' }).catch(() => undefined)));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try { await fetch(`/api/notifications/${id}`, { method: 'DELETE' }); } catch { /* optimistic */ }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'critical': return <ShieldAlert className="h-5 w-5 text-[#8a3122]" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-[#a8402e]" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-[#7f9548]" />;
      default: return <Info className="h-5 w-5 text-[#937d57]" />;
    }
  };

  const formatTime = (isoString: string) => {
    const then = new Date(isoString).getTime();
    if (Number.isNaN(then)) return '';
    const absolute = new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    // Pre-hydration there is no clock to compare against.
    if (currentMinute === 0) return absolute;

    const diffMins = Math.floor((currentMinute * MINUTE_MS - then) / MINUTE_MS);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return absolute;
  };

  return (
    <div className="relative font-sans">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        className={cn('relative p-2 rounded-lg text-[#6b572f] hover:text-[#2a2013] hover:bg-[#efe1c4] transition-all cursor-pointer border border-transparent', isOpen && 'bg-[#efe1c4] text-[#2a2013] border-[#e3d2a9]')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a8402e] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#a8402e]"></span>
          </span>
        )}
      </button>

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-88 bg-[#fffbf3]/95 border border-[#e3d2a9] rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e3d2a9] bg-[#fffbf3]/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#2a2013]">Notifications</span>
                {unreadCount > 0 && <span className="px-2 py-0.5 text-3xs font-semibold bg-[#a8402e]/25 text-[#8a3122] border border-[#a8402e]/50 rounded-full">{unreadCount} New</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <>
                    <button onClick={() => void handleMarkAllRead()} title="Mark all as read" className="p-1 rounded text-[#6b572f] hover:text-[#2a2013] hover:bg-[#efe1c4] transition-all cursor-pointer"><Check className="h-4 w-4" /></button>
                    <button onClick={() => void handleClearAll()} title="Clear all" className="p-1 rounded text-[#6b572f] hover:text-[#a8402e] hover:bg-[#a8402e]/10 transition-all cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto divide-y divide-[#e3d2a9]/50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="p-3 bg-[#efe1c4]/50 border border-[#e3d2a9] rounded-full text-[#6b572f] mb-2"><Bell className="h-6 w-6 opacity-40" /></div>
                  <p className="text-sm font-medium text-[#2a2013]">No notifications</p>
                </div>
              ) : notifications.map((notif) => (
                <div key={notif.id} onClick={() => void handleMarkAsRead(notif.id)} className={cn('flex gap-3 p-4 hover:bg-[#efe1c4]/40 transition-colors cursor-pointer relative group', !notif.read && 'bg-[#6b7f3a]/5')}>
                  {!notif.read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#6b7f3a] rounded-r" />}
                  <div className="mt-0.5 flex-shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-xs font-semibold text-[#2a2013] truncate', !notif.read && 'font-bold')}>{notif.title}</p>
                      <span className="text-xs text-[#6b572f] flex-shrink-0">{formatTime(notif.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[#6b572f] mt-1 leading-relaxed line-clamp-2">{notif.message}</p>
                  </div>
                  <button onClick={(e) => void handleDelete(notif.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-[#6b572f] hover:text-[#a8402e] transition-opacity cursor-pointer self-start" title="Dismiss">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
