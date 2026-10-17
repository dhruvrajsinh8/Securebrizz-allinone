'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import type { Vulnerability } from '@/types/vulnerability';
import { Filter, User, ExternalLink, X, Check, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useVulnerabilities, useDebouncedValue, QUERY_KEYS, type VulnerabilityPage } from '@/hooks/dashboardQueries';

interface VulnerabilitiesTabProps {
  searchQuery?: string;
}

export default function VulnerabilitiesTab({ searchQuery = '' }: VulnerabilitiesTabProps) {
  const queryClient = useQueryClient();
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [editStatus, setEditStatus] = useState<Vulnerability['status']>('open');
  const [editAssignee, setEditAssignee] = useState('');
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState(100);

  // The server does the filtering, so debounce typing rather than firing a
  // query per keystroke.
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const { data, isPending: loading, isFetching } = useVulnerabilities({
    search: debouncedSearch,
    severities: selectedSeverities,
    statuses: selectedStatuses,
    limit,
  });

  const vulns = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

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
      // Every cached filter combination holds its own page, so patch them all.
      queryClient.setQueriesData<VulnerabilityPage>({ queryKey: QUERY_KEYS.vulnerabilities }, (prev) =>
        prev ? { ...prev, items: prev.items.map((v) => (v.id === json.data.id ? json.data : v)) } : prev);
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

  const filtered = vulns;

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
        <h2 className="text-base font-bold text-[#2a2013]">Vulnerability Management</h2>
        <p className="text-xs text-[#937d57] mt-0.5">
          Showing {filtered.length} of {total} matching {total === 1 ? 'vulnerability' : 'vulnerabilities'}
          {searchQuery && <span className="ml-1">· filtered by <span className="text-green-400">&ldquo;{searchQuery}&rdquo;</span></span>}
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#a6906a]" />
          <span className="text-xs text-[#937d57] font-medium">Severity:</span>
          {['critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => toggleFilter(selectedSeverities, sev, setSelectedSeverities)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border font-semibold capitalize transition-all cursor-pointer',
                selectedSeverities.includes(sev)
                  ? getBadge(sev)
                  : 'bg-transparent text-[#937d57] border-[#e3d2a9] hover:border-[#cbae72]'
              )}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#937d57] font-medium">Status:</span>
          {['open', 'in_progress', 'resolved'].map((status) => (
            <button
              key={status}
              onClick={() => toggleFilter(selectedStatuses, status, setSelectedStatuses)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border font-semibold capitalize transition-all cursor-pointer',
                selectedStatuses.includes(status)
                  ? getStatusBadge(status)
                  : 'bg-transparent text-[#937d57] border-[#e3d2a9] hover:border-[#cbae72]'
              )}
            >
              {statusLabel[status]}
            </button>
          ))}
        </div>

        {(selectedSeverities.length > 0 || selectedStatuses.length > 0) && (
          <button
            onClick={() => { setSelectedSeverities([]); setSelectedStatuses([]); }}
            className="text-xs text-[#937d57] hover:text-red-400 underline cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#937d57]"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Loading…</span></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center gap-2">
              <AlertCircle className="w-8 h-8 text-[#e3d2a9]" />
              <p className="text-sm font-medium text-[#2a2013]">{total === 0 && !debouncedSearch && selectedSeverities.length === 0 && selectedStatuses.length === 0 ? 'No findings yet' : 'No vulnerabilities found'}</p>
              <p className="text-xs text-[#937d57]">{total === 0 && !debouncedSearch && selectedSeverities.length === 0 && selectedStatuses.length === 0 ? 'Run a scan to populate this list with real findings.' : 'Try adjusting your search or filter criteria.'}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e3d2a9] text-xs text-[#937d57] uppercase font-semibold tracking-wide">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">ID / CVE</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Asset</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3d2a9]/60 text-xs">
                {filtered.map((vuln) => (
                  <tr
                    key={vuln.id}
                    onClick={() => handleOpenDrawer(vuln)}
                    className="table-row-hover cursor-pointer group transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase', getBadge(vuln.severity))}>
                        {vuln.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#937d57]">
                      <span className="text-[#6b572f]">{vuln.id}</span>
                      {vuln.cveId && <span className="block text-xs text-green-400 mt-0.5">{vuln.cveId}</span>}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#2a2013] max-w-xs truncate">{vuln.title}</td>
                    <td className="py-3 px-4 font-mono text-[#937d57] max-w-xs truncate">{vuln.affectedAsset}</td>
                    <td className="py-3 px-4">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadge(vuln.status))}>
                        {statusLabel[vuln.status] ?? vuln.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#937d57]">
                      {vuln.assignee ? (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-green-400/60" />
                          {vuln.assignee}
                        </span>
                      ) : (
                        <span className="text-[#e3d2a9] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight className="w-3.5 h-3.5 text-[#e3d2a9] group-hover:text-[#937d57] transition-colors ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hasMore && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-[#e3d2a9]">
              <p className="text-xs text-[#937d57]">
                Showing the first {filtered.length} of {total}
              </p>
              <button
                onClick={() => setLimit((current) => current + 100)}
                disabled={isFetching}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#7f9548]/30 text-[#47601f] hover:bg-[#7f9548]/10 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isFetching ? 'Loading…' : 'Load more'}
              </button>
            </div>
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
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#fffbf3] border-l border-[#e3d2a9] z-50 flex flex-col shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-[#e3d2a9]">
                <div className="space-y-1.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase', getBadge(selectedVuln.severity))}>
                      {selectedVuln.severity}
                    </span>
                    {selectedVuln.cvssScore && (
                      <span className="text-xs text-[#937d57] font-mono">CVSS {selectedVuln.cvssScore}</span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-[#2a2013] leading-snug">{selectedVuln.title}</h2>
                  <div className="flex items-center gap-3 text-xs font-mono text-[#937d57]">
                    <span>{selectedVuln.id}</span>
                    {selectedVuln.cveId && <span className="text-green-400">{selectedVuln.cveId}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVuln(null)}
                  className="p-1.5 rounded-lg text-[#937d57] hover:text-[#2a2013] hover:bg-[#efe1c4] transition-all cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Edit controls */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-[#fffbf3] border border-[#e3d2a9] rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#937d57] uppercase tracking-wider">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Vulnerability['status'])}
                      className="w-full bg-[#efe1c4] border border-[#e3d2a9] rounded-lg px-3 py-2 text-xs text-[#2a2013] cursor-pointer focus:border-green-500/50 focus:outline-none transition-colors"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#937d57] uppercase tracking-wider">Assignee</label>
                    <input
                      type="text"
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      placeholder="Unassigned"
                      className="w-full bg-[#efe1c4] border border-[#e3d2a9] rounded-lg px-3 py-2 text-xs text-[#2a2013] placeholder-[#a6906a] focus:border-green-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Description */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#937d57] uppercase tracking-wider">Description</h3>
                  <p className="text-xs text-[#6b572f] leading-relaxed bg-[#fffbf3] p-4 rounded-xl border border-[#e3d2a9]">
                    {selectedVuln.description}
                  </p>
                </section>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-b border-[#e3d2a9] py-4">
                  {[
                    { label: 'Affected Asset', value: selectedVuln.affectedAsset },
                    { label: 'Category', value: selectedVuln.category },
                    { label: 'Effort', value: selectedVuln.effort },
                    { label: 'Discovered', value: new Date(selectedVuln.discoveredAt).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="block text-xs font-semibold text-[#a6906a] uppercase tracking-wider">{label}</span>
                      <span className="block text-xs text-[#6b572f] mt-0.5 break-words">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Business Impact */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#937d57] uppercase tracking-wider">Business Impact</h3>
                  <p className="text-xs text-[#6b572f] leading-relaxed">{selectedVuln.impact}</p>
                </section>

                {/* Remediation */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-[#937d57] uppercase tracking-wider">Recommended Fix</h3>
                  <div className="flex gap-3 p-4 bg-green-500/5 border border-green-500/15 rounded-xl">
                    <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-[#6b572f] leading-relaxed">{selectedVuln.recommendation}</p>
                  </div>
                </section>

                {/* References */}
                {selectedVuln.references.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#937d57] uppercase tracking-wider">References</h3>
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
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e3d2a9] bg-[#efe1c4]/50">
                <button
                  onClick={() => setSelectedVuln(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#937d57] hover:text-[#2a2013] border border-[#e3d2a9] hover:border-[#cbae72] rounded-lg transition-all cursor-pointer"
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


