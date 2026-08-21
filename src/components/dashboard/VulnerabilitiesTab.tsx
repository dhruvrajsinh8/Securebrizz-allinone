'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import type { Vulnerability } from '@/types/vulnerability';
import { Filter, User, ExternalLink, X, Check, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VulnerabilitiesTabProps {
  searchQuery?: string;
}

export default function VulnerabilitiesTab({ searchQuery = '' }: VulnerabilitiesTabProps) {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [editStatus, setEditStatus] = useState<Vulnerability['status']>('open');
  const [editAssignee, setEditAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vulnerabilities');
      const json = await res.json();
      if (json.success) setVulns(json.data);
    } catch { /* keep previous view */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener('scanner_updated', handler);
    return () => window.removeEventListener('scanner_updated', handler);
  }, [load]);

  const handleOpenDrawer = (vuln: Vulnerability) => {
    setSelectedVuln(vuln);
    setEditStatus(vuln.status);
    setEditAssignee(vuln.assignee || '');
  };

  const handleSave = async () => {
    if (!selectedVuln) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vulnerabilities/${selectedVuln.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, assignee: editAssignee || null }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error ?? 'Update failed.'); return; }
      setVulns((prev) => prev.map((v) => (v.id === json.data.id ? json.data : v)));
      window.dispatchEvent(new Event('vulnerabilities_updated'));
      toast.success('Vulnerability updated successfully.');
      setSelectedVuln(null);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const filtered = vulns.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      v.title.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      (v.cveId ?? '').toLowerCase().includes(q) ||
      v.affectedAsset.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q);
    const matchSev = selectedSeverities.length === 0 || selectedSeverities.includes(v.severity);
    const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(v.status);
    return matchSearch && matchSev && matchStatus;
  });

  const getBadge = (severity: string) => {
    const map: Record<string, string> = {
      critical: 'badge-critical',
      high: 'badge-high',
      medium: 'badge-medium',
      low: 'badge-low',
    };
    return map[severity] ?? 'badge-info';
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-red-500/10 text-red-400 border border-red-500/20',
      in_progress: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
      resolved: 'bg-green-500/10 text-green-400 border border-green-500/20',
    };
    return map[status] ?? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  };

  const statusLabel: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[#f5f5f5]">Vulnerability Management</h2>
        <p className="text-xs text-[#71717a] mt-0.5">
          {filtered.length} of {vulns.length} vulnerabilities shown
          {searchQuery && <span className="ml-1">· filtered by <span className="text-green-400">"{searchQuery}"</span></span>}
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#52525b]" />
          <span className="text-xs text-[#71717a] font-medium">Severity:</span>
          {['critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => toggleFilter(selectedSeverities, sev, setSelectedSeverities)}
              className={cn(
                'px-2.5 py-1 text-[10px] rounded-md border font-semibold capitalize transition-all cursor-pointer',
                selectedSeverities.includes(sev)
                  ? getBadge(sev)
                  : 'bg-transparent text-[#71717a] border-[#242424] hover:border-[#333333]'
              )}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#71717a] font-medium">Status:</span>
          {['open', 'in_progress', 'resolved'].map((status) => (
            <button
              key={status}
              onClick={() => toggleFilter(selectedStatuses, status, setSelectedStatuses)}
              className={cn(
                'px-2.5 py-1 text-[10px] rounded-md border font-semibold capitalize transition-all cursor-pointer',
                selectedStatuses.includes(status)
                  ? getStatusBadge(status)
                  : 'bg-transparent text-[#71717a] border-[#242424] hover:border-[#333333]'
              )}
            >
              {statusLabel[status]}
            </button>
          ))}
        </div>

        {(selectedSeverities.length > 0 || selectedStatuses.length > 0) && (
          <button
            onClick={() => { setSelectedSeverities([]); setSelectedStatuses([]); }}
            className="text-[10px] text-[#71717a] hover:text-red-400 underline cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#71717a]"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Loading…</span></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center gap-2">
              <AlertCircle className="w-8 h-8 text-[#242424]" />
              <p className="text-sm font-medium text-[#f5f5f5]">{vulns.length === 0 ? 'No findings yet' : 'No vulnerabilities found'}</p>
              <p className="text-xs text-[#71717a]">{vulns.length === 0 ? 'Run a scan to populate this list with real findings.' : 'Try adjusting your search or filter criteria.'}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242424] text-[10px] text-[#71717a] uppercase font-semibold tracking-wide">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">ID / CVE</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]/60 text-xs">
                {filtered.map((vuln) => (
                  <tr
                    key={vuln.id}
                    onClick={() => handleOpenDrawer(vuln)}
                    className="table-row-hover cursor-pointer group transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', getBadge(vuln.severity))}>
                        {vuln.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#71717a]">
                      <span className="text-[#a1a1aa]">{vuln.id}</span>
                      {vuln.cveId && <span className="block text-[10px] text-green-400 mt-0.5">{vuln.cveId}</span>}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#f5f5f5] max-w-xs truncate">{vuln.title}</td>
                    <td className="py-3 px-4 font-mono text-[#71717a] max-w-xs truncate">{vuln.affectedAsset}</td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', getStatusBadge(vuln.status))}>
                        {statusLabel[vuln.status] ?? vuln.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#71717a]">
                      {vuln.assignee ? (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-green-400/60" />
                          {vuln.assignee}
                        </span>
                      ) : (
                        <span className="text-[#242424] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight className="w-3.5 h-3.5 text-[#242424] group-hover:text-[#71717a] transition-colors ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Drawer + dark backdrop */}
      <AnimatePresence>
        {selectedVuln && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVuln(null)}
              className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#0a0a0a] border-l border-[#242424] z-50 flex flex-col shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-[#242424]">
                <div className="space-y-1.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', getBadge(selectedVuln.severity))}>
                      {selectedVuln.severity}
                    </span>
                    {selectedVuln.cvssScore && (
                      <span className="text-[10px] text-[#71717a] font-mono">CVSS {selectedVuln.cvssScore}</span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-[#f5f5f5] leading-snug">{selectedVuln.title}</h2>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-[#71717a]">
                    <span>{selectedVuln.id}</span>
                    {selectedVuln.cveId && <span className="text-green-400">{selectedVuln.cveId}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVuln(null)}
                  className="p-1.5 rounded-lg text-[#71717a] hover:text-[#f5f5f5] hover:bg-[#161616] transition-all cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Edit controls */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#0d0d0d] border border-[#242424] rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Vulnerability['status'])}
                      className="w-full bg-[#000000] border border-[#242424] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] cursor-pointer focus:border-green-500/50 focus:outline-none transition-colors"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">Assignee</label>
                    <input
                      type="text"
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      placeholder="Unassigned"
                      className="w-full bg-[#000000] border border-[#242424] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] placeholder-[#52525b] focus:border-green-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Description */}
                <section className="space-y-2">
                  <h3 className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">Description</h3>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed bg-[#0d0d0d] p-4 rounded-xl border border-[#242424]">
                    {selectedVuln.description}
                  </p>
                </section>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-b border-[#242424] py-4">
                  {[
                    { label: 'Affected Asset', value: selectedVuln.affectedAsset },
                    { label: 'Category', value: selectedVuln.category },
                    { label: 'Effort', value: selectedVuln.effort },
                    { label: 'Discovered', value: new Date(selectedVuln.discoveredAt).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="block text-[10px] font-semibold text-[#52525b] uppercase tracking-wider">{label}</span>
                      <span className="block text-xs text-[#a1a1aa] mt-0.5 break-words">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Business Impact */}
                <section className="space-y-2">
                  <h3 className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">Business Impact</h3>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed">{selectedVuln.impact}</p>
                </section>

                {/* Remediation */}
                <section className="space-y-2">
                  <h3 className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">Recommended Fix</h3>
                  <div className="flex gap-3 p-4 bg-green-500/5 border border-green-500/15 rounded-xl">
                    <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">{selectedVuln.recommendation}</p>
                  </div>
                </section>

                {/* References */}
                {selectedVuln.references.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">References</h3>
                    <ul className="space-y-1.5">
                      {selectedVuln.references.map((ref, i) => (
                        <li key={i}>
                          <a href={ref} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-xs text-green-400 hover:text-green-300 hover:underline font-mono truncate transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            {ref}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* Drawer footer */}
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#242424] bg-[#000000]/50">
                <button
                  onClick={() => setSelectedVuln(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#71717a] hover:text-[#f5f5f5] border border-[#242424] hover:border-[#333333] rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


