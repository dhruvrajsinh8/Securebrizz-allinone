'use client';

import React from 'react';
import { Download, History, ScanLine, AlertTriangle } from 'lucide-react';
import ScanLauncher from '@/components/scanner/ScanLauncher';
import ScanReport from '@/components/scanner/ScanReport';
import { useScan } from '@/providers/ScanProvider';
import { exportScanReportPDF } from '@/lib/pdfExport';
import { cn } from '@/lib/utils';
import { gradeBadge, scoreColor } from '@/lib/severity';

export default function ScannerTab() {
  const { result, history, phase, runScan } = useScan();
  const showReport = result && result.scanResultStatus === 'completed';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-[#2a2013]">Scanner</h1>
          <p className="text-xs text-[#937d57] mt-0.5">Passive assessment of TLS, HTTP headers, cookies, DNS and page content.</p>
        </div>
        {showReport && (
          <button onClick={() => exportScanReportPDF(result)} className="h-9 px-3.5 inline-flex items-center gap-2 rounded-md border border-[#e3d2a9] bg-[#fffbf3] hover:border-[#cbae72] text-xs font-medium text-[#4a3b1f] transition-colors cursor-pointer shrink-0">
            <Download className="h-3.5 w-3.5" /> Export report
          </button>
        )}
      </div>

      <ScanLauncher />

      {showReport ? (
        <ScanReport result={result} />
      ) : result && result.scanResultStatus !== 'completed' ? (
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#a8402e]/10 rounded-lg text-[#a8402e] shrink-0 mt-0.5">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#2a2013]">
                Scan did not complete ({result.scanResultStatus?.replace('_', ' ') ?? 'error'})
              </h2>
              <p className="text-xs text-[#6b572f] mt-1 leading-relaxed">
                {result.errorMessage || 'Target could not be reached or validated.'}
              </p>
            </div>
          </div>
          {result.checks && result.checks.length > 0 && (
            <div className="pt-3 border-t border-[#e3d2a9] space-y-2">
              <h3 className="text-xs font-semibold text-[#2a2013] uppercase tracking-wider">Executed Diagnostics</h3>
              <div className="space-y-1">
                {result.checks.map((chk) => (
                  <div key={chk.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-[#efe1c4]/60 border border-[#e3d2a9]">
                    <span className="font-medium text-[#2a2013]">{chk.label}</span>
                    <span className="font-mono text-[#6b572f] text-[11px] truncate max-w-xs">{chk.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : phase === 'idle' ? (
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg py-14 flex flex-col items-center text-center gap-2">
          <ScanLine className="h-6 w-6 text-[#a6906a]" />
          <p className="text-sm font-medium text-[#4a3b1f]">No scans yet</p>
          <p className="text-xs text-[#937d57] max-w-sm leading-relaxed">Enter a domain above to run the first scan. Results are stored so you can compare them over time.</p>
        </div>
      ) : null}

      {history.length > 0 && (
        <div className="border border-[#e3d2a9] bg-[#fffbf3] rounded-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e3d2a9]">
            <History className="h-3.5 w-3.5 text-[#a6906a]" />
            <h2 className="text-xs font-semibold text-[#2a2013]">Scan history</h2>
            <span className="text-xs text-[#a6906a] tabular">{history.length}</span>
          </div>
          <div className="divide-y divide-[#e9dab8]">
            {history.map((entry) => (
              <button key={entry.id} onClick={() => void runScan(entry.url)} title={`Re-scan ${entry.url}`} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#fffbf3] transition-colors cursor-pointer">
                <span className="text-xs font-bold tabular w-8 shrink-0" style={{ color: scoreColor(entry.overallScore) }}>{entry.overallScore}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded font-bold shrink-0 w-8 text-center', gradeBadge(entry.grade ?? undefined))}>{entry.grade ?? '—'}</span>
                <span className="font-mono text-sm text-[#6b572f] truncate flex-1">{entry.url}</span>
                <span className="text-xs text-[#a6906a] tabular shrink-0 hidden sm:block">{entry.findingCount} findings</span>
                <span className="text-xs text-[#a6906a] tabular shrink-0">{new Date(entry.scanDate).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
