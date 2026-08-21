'use client';

import React from 'react';
import { Play, RefreshCw, AlertTriangle, ShieldOff } from 'lucide-react';
import { useScan } from '@/providers/ScanProvider';
import { cn } from '@/lib/utils';

interface ScanLauncherProps { compact?: boolean; }

export default function ScanLauncher({ compact = false }: ScanLauncherProps) {
  const { target, setTarget, runScan, phase, progress, stage, error, result } = useScan();
  const scanning = phase === 'scanning';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!scanning) void runScan();
  };

  const blocked = result?.scanResultStatus === 'blocked';
  const failed = result?.scanResultStatus === 'invalid_domain' || result?.scanResultStatus === 'unreachable';

  return (
    <div className={cn('border border-[#242424] bg-[#0d0d0d] rounded-lg', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Passive security scan</h2>
          <p className="text-xs text-[#71717a] mt-0.5">Headers, TLS, DNS, cookies and page content. No intrusive requests are sent.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text" inputMode="url" spellCheck={false} placeholder="example.com" value={target}
          onChange={(event) => setTarget(event.target.value)} disabled={scanning}
          className="flex-1 h-10 px-3 bg-[#000000] border border-[#242424] rounded-md font-mono text-sm text-[#f5f5f5] placeholder-[#52525b] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/20 transition-colors disabled:opacity-50"
        />
        <button
          type="submit" disabled={scanning || target.trim().length === 0}
          className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md bg-[#16a34a] hover:bg-[#22c55e] disabled:bg-[#161616] disabled:text-[#52525b] text-black text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          {scanning ? (<><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scanning</>) : (<><Play className="h-3.5 w-3.5" /> Run scan</>)}
        </button>
      </form>

      <p className="mt-2.5 text-[10px] text-[#52525b] leading-relaxed">
        Passive only: the scanner requests the page as a browser would and reads public DNS and
        Certificate Transparency records. It sends no payloads and does no port scanning. Scan sites
        you own or have permission to test, and report anything you find to their owner rather than
        publishing it.
      </p>

      {scanning && (
        <div className="mt-4">
          <div className="h-1 w-full bg-[#161616] rounded-full overflow-hidden">
            <div className="h-full bg-[#22c55e] transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#a1a1aa] font-mono">{stage}<span className="text-[#52525b]"> · {progress}%</span></p>
        </div>
      )}

      {!scanning && error && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-md border border-[#dc2626]/30 bg-[#dc2626]/8">
          <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0 mt-0.5" />
          <p className="text-xs text-[#f87171] leading-relaxed">{error}</p>
        </div>
      )}

      {!scanning && (blocked || failed) && result?.errorMessage && (
        <div className={cn('mt-3 flex items-start gap-2 p-3 rounded-md border', blocked ? 'border-[#71717a]/30 bg-[#161616]' : 'border-[#dc2626]/30 bg-[#dc2626]/8')}>
          {blocked ? <ShieldOff className="h-4 w-4 text-[#a1a1aa] shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0 mt-0.5" />}
          <div className="space-y-1">
            <p className={cn('text-xs font-semibold', blocked ? 'text-[#d4d4d8]' : 'text-[#f87171]')}>
              {blocked ? 'Target refused' : result.scanResultStatus === 'invalid_domain' ? 'Domain could not be resolved' : 'Target unreachable'}
            </p>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">{result.errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
