'use client';

import React, { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface LoginViewProps {
  onSwitchToRegister: () => void;
  initialResetToken?: string | null;
}

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'alex@securebiz.io', password: 'demo1234', role: 'Full Access' },
  { label: 'Analyst', email: 'sarah@securebiz.io', password: 'demo1234', role: 'Read & Edit' },
];

export default function LoginView({ onSwitchToRegister, initialResetToken }: LoginViewProps) {
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'forgot' | 'reset'>(() => (initialResetToken ? 'reset' : 'login'));

  // Normal login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password state
  const [resetToken, setResetToken] = useState(() => initialResetToken ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await login({ email, password, rememberMe });
      if (!res.success) {
        toast.error(res.error || 'Login failed. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsLoading(true);
    try {
      const res = await login({ email: demoEmail, password: demoPass, rememberMe: false });
      if (!res.success) {
        toast.error(res.error || 'Demo login failed.');
      }
    } catch {
      toast.error('Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your work email.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok && !data.success) {
        toast.error(data.error || 'Could not send reset instructions.');
      } else {
        setForgotSent(true);
        toast.success('Reset email sent! Check your inbox.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      toast.error('Reset token is required.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Password reset failed.');
      } else {
        toast.success('Password updated successfully! Please sign in.');
        setAuthMode('login');
        setPassword('');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#efe1c4] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#7f9548]/15 border border-[#7f9548]/20 mb-2">
            <Shield className="w-6 h-6 text-[#47601f]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2a2013] tracking-tight">SecureBiz</h1>
          <p className="text-xs text-[#937d57]">Passive Web Security & Threat Surface Dashboard</p>
        </div>

        {/* ── MODE: FORGOT PASSWORD ── */}
        {authMode === 'forgot' && (
          <div className="bg-[#fffbf3] border border-[#e3d2a9] rounded-2xl p-6 shadow-xl shadow-black/30 space-y-4">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setForgotSent(false); }}
              className="inline-flex items-center gap-1.5 text-xs text-[#6b572f] hover:text-[#2a2013] font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>

            <div>
              <h2 className="text-base font-bold text-[#2a2013]">Forgot your password?</h2>
              <p className="text-xs text-[#937d57] mt-1">
                Enter your registered work email and we&apos;ll send you instructions to reset it.
              </p>
            </div>

            {forgotSent ? (
              <div className="p-4 bg-[#eef2dd] border border-[#6b7f3a]/30 rounded-lg space-y-2 text-center">
                <CheckCircle2 className="w-6 h-6 text-[#47601f] mx-auto" />
                <p className="text-xs font-semibold text-[#3f5618]">Instructions Sent</p>
                <p className="text-xs text-[#6b572f]">
                  If an account exists for <strong className="text-[#2a2013]">{forgotEmail}</strong>, you will receive a reset link shortly.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode('reset')}
                    className="text-xs text-[#47601f] hover:underline font-medium"
                  >
                    Have your token? Reset now →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#6b572f]">Work Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? 'Sending instructions...' : 'Send Reset Instructions'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── MODE: RESET PASSWORD ── */}
        {authMode === 'reset' && (
          <div className="bg-[#fffbf3] border border-[#e3d2a9] rounded-2xl p-6 shadow-xl shadow-black/30 space-y-4">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className="inline-flex items-center gap-1.5 text-xs text-[#6b572f] hover:text-[#2a2013] font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>

            <div>
              <h2 className="text-base font-bold text-[#2a2013]">Choose a new password</h2>
              <p className="text-xs text-[#937d57] mt-1">
                Enter your reset token and your new chosen password.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b572f]">Reset Token</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                  <input
                    type="text"
                    placeholder="Paste reset token here"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm font-mono text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b572f]">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#937d57] hover:text-[#6b572f] transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b572f]">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* ── MODE: STANDARD SIGN IN ── */}
        {authMode === 'login' && (
          <>
            <div className="bg-[#fffbf3] border border-[#e3d2a9] rounded-2xl p-6 shadow-xl shadow-black/30">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#6b572f]">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#6b572f]">Password</label>
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-xs text-[#7f9548] hover:text-[#47601f] transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#937d57] hover:text-[#6b572f] transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#e3d2a9] bg-[#efe1c4] accent-blue-500 cursor-pointer"
                  />
                  <label htmlFor="remember" className="text-xs text-[#937d57] cursor-pointer">
                    Keep me signed in
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-[#937d57]">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="text-green-400 hover:text-green-300 font-medium transition-colors cursor-pointer"
                >
                  Create account
                </button>
              </div>
            </div>

            {/* Demo accounts */}
            <div className="bg-[#fffbf3] border border-[#e3d2a9] rounded-xl p-4">
              <p className="text-sm font-semibold text-[#937d57] uppercase tracking-wider mb-3">
                Quick Demo Access
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handleDemoLogin(account.email, account.password)}
                    disabled={isLoading}
                    className="flex flex-col items-start gap-0.5 p-3 bg-[#efe1c4] border border-[#e3d2a9] hover:border-green-500/40 hover:bg-[#efe1c4] rounded-lg transition-all text-left cursor-pointer disabled:opacity-50 group"
                  >
                    <span className="text-xs font-semibold text-[#2a2013] group-hover:text-green-300 transition-colors">
                      {account.label}
                    </span>
                    <span className="text-xs text-[#937d57]">{account.role}</span>
                    <span className="text-xs font-mono text-[#937d57] truncate w-full">{account.email}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#a6906a] mt-2 text-center">
                Click a demo account to sign in instantly
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
