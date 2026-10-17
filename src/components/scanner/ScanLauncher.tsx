'use client';

import React from 'react';
import { Play, RefreshCw, AlertTriangle, ShieldOff, ShieldCheck, Zap } from 'lucide-react';
import { useScan } from '@/providers/ScanProvider';
import { cn } from '@/lib/utils';

interface ScanLauncherProps { compact?: boolean; }

export default function ScanLauncher({ compact = false }: ScanLauncherProps) {
  const {
    target,
    setTarget,
    runScan,
    phase,
    progress,
    stage,
    error,
    result,
    scanMode,
    setScanMode,
    hasHostPermission,
    setHasHostPermission,
  } = useScan();

  const scanning = phase === 'scanning';
  const blocked = result?.scanResultStatus === 'blocked';
  const failed = result?.scanResultStatus === 'invalid_domain' || result?.scanResultStatus === 'unreachable';
  const canSubmit = !scanning && target.trim().length > 0 && (scanMode === 'passive' || hasHostPermission);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (canSubmit) void runScan();
  };

  return (
    <div className={cn('border border-[#e3d2a9] bg-[#fffbf3] rounded-lg', compact ? 'p-4' : 'p-5')}>
      {/* Mode Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#2a2013]">
            {scanMode === 'active' ? 'Active Deep Security Scan' : 'Passive Security Scan'}
          </h2>
          <p className="text-xs text-[#937d57] mt-0.5">
            {scanMode === 'active'
              ? 'TCP port discovery, service detection, and OSV.dev CVE vulnerability matching.'
              : 'Headers, TLS, DNS, cookies, and page content. Safe for any public website.'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setScanMode('passive')}
            disabled={scanning}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed',
              scanMode === 'passive'
                ? 'bg-[#fffbf3] text-[#2a2013] shadow-sm font-semibold'
                : 'text-[#937d57] hover:text-[#4a3b1f]'
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#6b7f3a]" />
            <span>Passive</span>
          </button>
          <button
            type="button"
            onClick={() => setScanMode('active')}
            disabled={scanning}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed',
              scanMode === 'active'
                ? 'bg-[#fffbf3] text-[#2a2013] shadow-sm font-semibold'
                : 'text-[#937d57] hover:text-[#4a3b1f]'
            )}
          >
            <Zap className="h-3.5 w-3.5 text-[#c98a2c]" />
            <span>Active Deep</span>
          </button>
        </div>
      </div>

      {/* Host Permission Warning Box for Active Mode */}
      {scanMode === 'active' && (
        <div className="mb-4 p-3.5 rounded-md border border-[#e5a93c]/50 bg-[#fff9ea] text-[#5e3e14]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-[#b26f18] shrink-0 mt-0.5" />
            <div className="text-xs space-y-2 leading-relaxed flex-1">
              <div>
                <p className="font-semibold text-[#462d0d]">Explicit Host Authorization Required</p>
                <p className="text-[#725227] mt-0.5">
                  Active deep scans send direct TCP handshakes across common database, remote management, and web ports, and correlate technologies with public CVE advisories. Only scan infrastructure you own or have written permission to audit.
                </p>
              </div>
              <label className="flex items-center gap-2 pt-1 font-medium text-[#3b270a] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasHostPermission}
                  onChange={(e) => setHasHostPermission(e.target.checked)}
                  disabled={scanning}
                  className="rounded border-[#c98a2c] text-[#6b7f3a] focus:ring-[#6b7f3a] h-4 w-4 cursor-pointer"
                />
                <span>I confirm that I own or have authorization to audit this host</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="url"
          spellCheck={false}
          placeholder="example.com"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          disabled={scanning}
          className="flex-1 h-10 px-3 bg-[#efe1c4] border border-[#e3d2a9] rounded-md font-mono text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-[#7f9548]/60 focus:ring-1 focus:ring-[#7f9548]/20 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-md bg-[#6b7f3a] hover:bg-[#7f9548] disabled:bg-[#efe1c4] disabled:text-[#a6906a] text-black text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          {scanning ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scanning
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Run scan
            </>
          )}
        </button>
      </form>

      {/* Guidance info note */}
      <p className="mt-2.5 text-xs text-[#a6906a] leading-relaxed">
        {scanMode === 'active'
          ? 'Active audit probes top exposed ports (Redis, MongoDB, MySQL, Postgres, MSSQL, SSH, RDP, Telnet, SMB) and queries OSV.dev for known vulnerabilities. Scans take ~5-10 seconds.'
          : 'Passive only: the scanner requests the page as a browser would and reads public DNS and Certificate Transparency records. It sends no payloads and does no port scanning.'}
      </p>

      {/* Progress Indicator */}
      {scanning && (
        <div className="mt-4">
          <div className="h-1.5 w-full bg-[#efe1c4] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7f9548] transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#6b572f] font-mono">
            {stage}
            <span className="text-[#a6906a]"> · {progress}%</span>
          </p>
        </div>
      )}

      {/* Errors */}
      {!scanning && error && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-md border border-[#a8402e]/30 bg-[#a8402e]/8">
          <AlertTriangle className="h-4 w-4 text-[#8a3122] shrink-0 mt-0.5" />
          <p className="text-xs text-[#8a3122] leading-relaxed">{error}</p>
        </div>
      )}

      {!scanning && (blocked || failed) && result?.errorMessage && (
        <div
          className={cn(
            'mt-3 flex items-start gap-2 p-3 rounded-md border',
            blocked ? 'border-[#937d57]/30 bg-[#efe1c4]' : 'border-[#a8402e]/30 bg-[#a8402e]/8'
          )}
        >
          {blocked ? (
            <ShieldOff className="h-4 w-4 text-[#6b572f] shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[#8a3122] shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className={cn('text-xs font-semibold', blocked ? 'text-[#4a3b1f]' : 'text-[#8a3122]')}>
              {blocked
                ? 'Target refused'
                : result.scanResultStatus === 'invalid_domain'
                ? 'Domain could not be resolved'
                : 'Target unreachable'}
            </p>
            <p className="text-xs text-[#6b572f] leading-relaxed">{result.errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
