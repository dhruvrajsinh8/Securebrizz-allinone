'use client';

import React from 'react';
import { Download, History, ScanLine } from 'lucide-react';
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
          <h1 className="text-base font-semibold text-[#f5f5f5]">Scanner</h1>
          <p className="text-xs text-[#71717a] mt-0.5">Passive assessment of TLS, HTTP headers, cookies, DNS and page content.</p>
        </div>
        {showReport && (
          <button onClick={() => exportScanReportPDF(result)} className="h-9 px-3.5 inline-flex items-center gap-2 rounded-md border border-[#242424] bg-[#0d0d0d] hover:border-[#333333] text-xs font-medium text-[#d4d4d8] transition-colors cursor-pointer shrink-0">
            <Download className="h-3.5 w-3.5" /> Export report
          </button>
        )}
      </div>

      <ScanLauncher />

      {showReport ? <ScanReport result={result} /> : phase === 'idle' ? (
        <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg py-14 flex flex-col items-center text-center gap-2">
          <ScanLine className="h-6 w-6 text-[#52525b]" />
          <p className="text-sm font-medium text-[#d4d4d8]">No scans yet</p>
          <p className="text-xs text-[#71717a] max-w-sm leading-relaxed">Enter a domain above to run the first scan. Results are stored so you can compare them over time.</p>
        </div>
      ) : null}

      {history.length > 0 && (
        <div className="border border-[#242424] bg-[#0d0d0d] rounded-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#242424]">
            <History className="h-3.5 w-3.5 text-[#52525b]" />
            <h2 className="text-xs font-semibold text-[#f5f5f5]">Scan history</h2>
            <span className="text-[10px] text-[#52525b] tabular">{history.length}</span>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {history.map((entry) => (
              <button key={entry.id} onClick={() => void runScan(entry.url)} title={`Re-scan ${entry.url}`} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#111111] transition-colors cursor-pointer">
                <span className="text-xs font-bold tabular w-8 shrink-0" style={{ color: scoreColor(entry.overallScore) }}>{entry.overallScore}</span>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 w-8 text-center', gradeBadge(entry.grade ?? undefined))}>{entry.grade ?? '—'}</span>
                <span className="font-mono text-[11px] text-[#a1a1aa] truncate flex-1">{entry.url}</span>
                <span className="text-[10px] text-[#52525b] tabular shrink-0 hidden sm:block">{entry.findingCount} findings</span>
                <span className="text-[10px] text-[#52525b] tabular shrink-0">{new Date(entry.scanDate).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
