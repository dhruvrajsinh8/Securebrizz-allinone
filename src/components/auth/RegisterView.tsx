'use client';

import React, { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, User, Mail, Lock, Building, Eye, EyeOff } from 'lucide-react';

interface RegisterViewProps {
  onSwitchToLogin: () => void;
}

export default function RegisterView({ onSwitchToLogin }: RegisterViewProps) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!agreeToTerms) {
      toast.error('Please accept the terms to continue.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await register({ name, email, password, confirmPassword, company, agreeToTerms });
      if (res.success) {
        toast.success('Account created!', {
          description: 'A verification link has been sent to your email address.',
        });
      } else {
        toast.error(res.error || 'Registration failed. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#efe1c4] px-4 py-12 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(107, 127, 58,0.06)_0%,transparent_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm z-10 space-y-4"
      >
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-600/15 border border-green-600/20 mb-3">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-[#2a2013] tracking-tight">Create Account</h1>
          <p className="text-xs text-[#937d57] mt-1">Set up your SecureBiz workspace</p>
        </div>

        {/* Register card */}
        <div className="bg-[#fffbf3] border border-[#e3d2a9] rounded-2xl p-6 shadow-xl shadow-black/30">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b572f]">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                <input
                  type="text"
                  placeholder="Alex Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b572f]">Work Email</label>
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b572f]">Company (optional)</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                <input
                  type="text"
                  placeholder="Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b572f]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#937d57] hover:text-[#6b572f] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b572f]">Confirm</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#937d57]" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg text-sm text-[#2a2013] placeholder-[#a6906a] focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="w-3.5 h-3.5 mt-0.5 rounded border-[#e3d2a9] bg-[#efe1c4] accent-blue-500 cursor-pointer shrink-0"
              />
              <label htmlFor="terms" className="text-xs text-[#937d57] cursor-pointer leading-snug">
                I agree to the{' '}
                <span className="text-green-400">Terms of Service</span>{' '}
                and{' '}
                <span className="text-green-400">Privacy Policy</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-[#937d57]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-green-400 hover:text-green-300 font-medium transition-colors cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
