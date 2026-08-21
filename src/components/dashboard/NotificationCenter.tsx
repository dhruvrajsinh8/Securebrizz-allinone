'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/types/common';
import { Bell, Check, Trash2, ShieldAlert, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success) setNotifications(json.data);
    } catch { /* keep previous view */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      case 'critical': return <ShieldAlert className="h-5 w-5 text-[#f87171]" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-[#dc2626]" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-[#22c55e]" />;
      default: return <Info className="h-5 w-5 text-[#71717a]" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="relative font-sans">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn('relative p-2 rounded-lg text-[#a1a1aa] hover:text-[#f5f5f5] hover:bg-[#161616] transition-all cursor-pointer border border-transparent focus:outline-none', isOpen && 'bg-[#161616] text-[#f5f5f5] border-[#242424]')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#dc2626] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#dc2626]"></span>
          </span>
        )}
      </button>

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-88 bg-[#0d0d0d]/95 border border-[#242424] rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#242424] bg-[#0a0a0a]/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#f5f5f5]">Notifications</span>
                {unreadCount > 0 && <span className="px-2 py-0.5 text-3xs font-semibold bg-[#dc2626]/25 text-[#f87171] border border-[#dc2626]/50 rounded-full">{unreadCount} New</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <>
                    <button onClick={() => void handleMarkAllRead()} title="Mark all as read" className="p-1 rounded text-[#a1a1aa] hover:text-[#f5f5f5] hover:bg-[#161616] transition-all cursor-pointer"><Check className="h-4 w-4" /></button>
                    <button onClick={() => void handleClearAll()} title="Clear all" className="p-1 rounded text-[#a1a1aa] hover:text-[#dc2626] hover:bg-[#dc2626]/10 transition-all cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto divide-y divide-[#242424]/50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="p-3 bg-[#161616]/50 border border-[#242424] rounded-full text-[#a1a1aa] mb-2"><Bell className="h-6 w-6 opacity-40" /></div>
                  <p className="text-sm font-medium text-[#f5f5f5]">No notifications</p>
                </div>
              ) : notifications.map((notif) => (
                <div key={notif.id} onClick={() => void handleMarkAsRead(notif.id)} className={cn('flex gap-3 p-4 hover:bg-[#161616]/40 transition-colors cursor-pointer relative group', !notif.read && 'bg-[#16a34a]/5')}>
                  {!notif.read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#16a34a] rounded-r" />}
                  <div className="mt-0.5 flex-shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-xs font-semibold text-[#f5f5f5] truncate', !notif.read && 'font-bold')}>{notif.title}</p>
                      <span className="text-[10px] text-[#a1a1aa] flex-shrink-0">{formatTime(notif.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed line-clamp-2">{notif.message}</p>
                  </div>
                  <button onClick={(e) => void handleDelete(notif.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-[#a1a1aa] hover:text-[#dc2626] transition-opacity cursor-pointer self-start" title="Dismiss">
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
