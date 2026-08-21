'use client';

import React, { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onSwitchToRegister: () => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'alex@securebiz.io', password: 'demo1234', role: 'Full Access' },
  { label: 'Analyst', email: 'sarah@securebiz.io', password: 'demo1234', role: 'Read & Edit' },
];

export default function LoginView({ onSwitchToRegister }: LoginViewProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsLoading(true);
    try {
      const res = await login({ email: demoEmail, password: demoPassword, rememberMe: true });
      if (!res.success) {
        toast.error('Demo login failed. Please try again.');
      }
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000] px-4 py-12 font-sans">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34, 197, 94,0.06)_0%,transparent_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm z-10 space-y-4"
      >
        {/* Brand mark */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-600/15 border border-green-600/20 mb-3">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-[#f5f5f5] tracking-tight">SecureBiz</h1>
          <p className="text-xs text-[#71717a] mt-1">Sign in to your security dashboard</p>
        </div>

        {/* Login card */}
        <div className="bg-[#0d0d0d] border border-[#242424] rounded-2xl p-6 shadow-xl shadow-black/30">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#a1a1aa]">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#000000] border border-[#242424] rounded-lg text-sm text-[#f5f5f5] placeholder-[#52525b] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#a1a1aa]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#000000] border border-[#242424] rounded-lg text-sm text-[#f5f5f5] placeholder-[#52525b] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors cursor-pointer"
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
                className="w-3.5 h-3.5 rounded border-[#242424] bg-[#000000] accent-blue-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-[#71717a] cursor-pointer">
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

          <div className="mt-4 text-center text-xs text-[#71717a]">
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
        <div className="bg-[#0d0d0d] border border-[#242424] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-[#71717a] uppercase tracking-wider mb-3">
            Quick Demo Access
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => handleDemoLogin(account.email, account.password)}
                disabled={isLoading}
                className="flex flex-col items-start gap-0.5 p-3 bg-[#000000] border border-[#242424] hover:border-green-500/40 hover:bg-[#0d1526] rounded-lg transition-all text-left cursor-pointer disabled:opacity-50 group"
              >
                <span className="text-xs font-semibold text-[#f5f5f5] group-hover:text-green-300 transition-colors">
                  {account.label}
                </span>
                <span className="text-[10px] text-[#71717a]">{account.role}</span>
                <span className="text-[10px] font-mono text-[#3b4f6b] truncate w-full">{account.email}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#52525b] mt-2 text-center">
            Click a demo account to sign in instantly
          </p>
        </div>
      </motion.div>
    </div>
  );
}
