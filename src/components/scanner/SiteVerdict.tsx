'use client';

/**
 * The one question a non-technical visitor actually has: "is this the real
 * site, or something faking it?" This sits above everything else in the
 * report, in plain language, before any jargon-heavy findings.
 *
 * It is designed to read like a verdict a person would trust: a clear label,
 * a safety meter they can glance at, one concrete thing to do next, and — only
 * if they want it — the reasoning behind the call.
 */

import React, { useState } from 'react';
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, ChevronDown, Info,
  CheckCircle2, AlertTriangle, XCircle, Lock, Eye,
} from 'lucide-react';
import type { PhishingAssessment } from '@/types/scanner';
import { cn } from '@/lib/utils';

type Verdict = PhishingAssessment['verdict'];

const PRESENTATION: Record<Verdict, {
  icon: typeof ShieldCheck;
  label: string;
  meterLabel: string;
  action: string;
  bg: string;
  panel: string;
  border: string;
  ink: string;
  meterTrack: string;
  meterFill: string;
  seal: string;
}> = {
  looks_original: {
    icon: ShieldCheck,
    label: 'Looks like the real site',
    meterLabel: 'Safe to continue',
    action: 'No fakery detected. Still, only enter passwords or payment details if you typed the address yourself and see the padlock.',
    bg: '#eef2dd',
    panel: '#f6f8ea',
    border: 'rgba(107, 127, 58, 0.35)',
    ink: '#3f5618',
    meterTrack: 'rgba(107, 127, 58, 0.18)',
    meterFill: '#6b7f3a',
    seal: 'rgba(107, 127, 58, 0.16)',
  },
  uncertain: {
    icon: ShieldQuestion,
    label: 'Worth a closer look',
    meterLabel: 'Be careful',
    action: 'A few things here are unusual. Double-check the web address letter by letter before you sign in or share anything.',
    bg: '#f6ebd3',
    panel: '#fbf3e2',
    border: 'rgba(154, 114, 26, 0.38)',
    ink: '#7a4a1a',
    meterTrack: 'rgba(154, 114, 26, 0.18)',
    meterFill: '#c08a2e',
    seal: 'rgba(154, 114, 26, 0.16)',
  },
  likely_spoofed: {
    icon: ShieldAlert,
    label: 'Likely a fake or spoofed site',
    meterLabel: 'Do not trust this site',
    action: 'This looks like an impersonation of a real brand. Do not enter passwords, card numbers, or codes. Close the tab and reach the real site by typing its address.',
    bg: '#f5ddd0',
    panel: '#fae7dc',
    border: 'rgba(168, 64, 46, 0.42)',
    ink: '#7a2a1c',
    meterTrack: 'rgba(168, 64, 46, 0.2)',
    meterFill: '#a8402e',
    seal: 'rgba(168, 64, 46, 0.16)',
  },
};

const SIGNAL_ICON = {
  good: CheckCircle2,
  warning: AlertTriangle,
  bad: XCircle,
} as const;

const SIGNAL_COLOR = {
  good: '#5a7030',
  warning: '#9a6a1a',
  bad: '#a8402e',
} as const;

export default function SiteVerdict({ phishing, hostname }: { phishing?: PhishingAssessment; hostname: string }) {
  const [showWhy, setShowWhy] = useState(false);
  if (!phishing) return null;

  const style = PRESENTATION[phishing.verdict];
  const Icon = style.icon;

  // Meter reads as "how safe", left (risky) → right (safe).
  const safety = Math.max(4, Math.min(100, 100 - phishing.riskScore));
  const negativeSignals = phishing.signals.filter((s) => s.risk !== 'good');
  const signalCount = phishing.signals.length;

  return (
    <div
      className="rounded-2xl border p-5 sm:p-7 shadow-[0_2px_16px_rgba(42,32,19,0.06)]"
      style={{ background: style.bg, borderColor: style.border }}
    >
      {/* Header: seal + verdict + headline */}
      <div className="flex items-start gap-4 sm:gap-5">
        <div
          className="shrink-0 h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] rounded-2xl flex items-center justify-center"
          style={{ background: style.seal }}
        >
          <Icon className="h-8 w-8 sm:h-9 sm:w-9" style={{ color: style.ink }} strokeWidth={2.1} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: style.ink, opacity: 0.7 }}>
            Site check
          </p>
          <p className="font-display text-2xl sm:text-[1.75rem] leading-tight mt-0.5" style={{ color: style.ink }}>
            {style.label}
          </p>
          <p className="text-base mt-2 leading-relaxed text-[#2a2013]">{phishing.headline}</p>
        </div>
      </div>

      {/* Safety meter */}
      <div className="mt-5 sm:mt-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">Trust level</span>
          <span className="text-sm font-semibold" style={{ color: style.ink }}>{style.meterLabel}</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: style.meterTrack }}>
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${safety}%`, background: style.meterFill }}
          />
        </div>
      </div>

      {/* What to do — the actionable line */}
      <div
        className="mt-5 rounded-xl border p-4 flex gap-3"
        style={{ background: style.panel, borderColor: style.border }}
      >
        <div className="shrink-0 mt-0.5" style={{ color: style.ink }}>
          {phishing.verdict === 'looks_original'
            ? <Lock className="h-5 w-5" strokeWidth={2} />
            : <Eye className="h-5 w-5" strokeWidth={2} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2a2013]">What you should do</p>
          <p className="text-sm mt-1 leading-relaxed text-[#4a3b1f]">{style.action}</p>
          <p className="text-sm mt-2 text-[#6b572f]">
            You checked <span className="font-mono font-medium text-[#2a2013] break-all">{hostname}</span>
          </p>
        </div>
      </div>

      {/* Why — collapsible reasoning */}
      <button
        onClick={() => setShowWhy((v) => !v)}
        aria-expanded={showWhy}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-70"
        style={{ color: style.ink }}
      >
        Why do we think this?
        {signalCount > 0 && (
          <span
            className="ml-0.5 text-xs font-bold rounded-full px-2 py-0.5"
            style={{ background: style.seal, color: style.ink }}
          >
            {negativeSignals.length > 0 ? `${negativeSignals.length} flag${negativeSignals.length === 1 ? '' : 's'}` : 'all clear'}
          </span>
        )}
        <ChevronDown className={cn('h-4 w-4 transition-transform', showWhy && 'rotate-180')} />
      </button>

      {showWhy && (
        <div className="mt-3 space-y-2 border-t pt-4" style={{ borderColor: style.border }}>
          {phishing.signals.map((signal, index) => {
            const SignalIcon = SIGNAL_ICON[signal.risk];
            return (
              <div key={index} className="flex gap-3">
                <SignalIcon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: SIGNAL_COLOR[signal.risk] }} strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2a2013]">{signal.label}</p>
                  <p className="text-sm text-[#4a3b1f] mt-0.5 leading-relaxed">{signal.detail}</p>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 items-start pt-3 mt-1 border-t" style={{ borderColor: style.border }}>
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#937d57]" />
            <p className="text-xs text-[#7c6842] leading-relaxed">{phishing.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
