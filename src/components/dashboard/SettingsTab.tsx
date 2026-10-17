'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/AuthProvider';
import type { Session } from '@/types/auth';
import {
  User,
  Shield,
  Key,
  Smartphone,
  Monitor,
  SmartphoneIcon,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function SettingsTab() {
  const { user, updateUser } = useAuth();
  
  // Profile settings
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileCompany, setProfileCompany] = useState(user?.company || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [resendingVerification, setResendingVerification] = useState(false);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Two-Factor Authentication state
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.twoFactorEnabled || false);

  // Sessions list state
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((json) => { if (json.success) setSessions(json.data); })
      .catch(() => undefined);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName || !profileEmail) {
      toast.error('Name and Email are required.');
      return;
    }
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, company: profileCompany }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error ?? 'Update failed.'); return; }
      updateUser(json.user);
      toast.success('Profile updated successfully.');
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  const handleToggle2FA = async () => {
    const nextState = !is2FAEnabled;
    setIs2FAEnabled(nextState);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactorEnabled: nextState }),
      });
      const json = await res.json();
      if (json.success) updateUser(json.user);
    } catch { /* optimistic UI already updated */ }
    toast.success(nextState ? 'Two-Factor Authentication enabled.' : 'Two-Factor Authentication disabled.');
  };

  const handlePasswordStrengthCheck = (val: string) => {
    setNewPassword(val);
    if (!val) {
      setPasswordStrength(0);
      return;
    }
    let strength = 1;
    if (val.length >= 8) strength++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;
    setPasswordStrength(strength);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error ?? 'Password update failed.'); return; }
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStrength(0);
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? 'Could not send verification email.');
      } else {
        toast.success('Verification email sent! Check your inbox.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResendingVerification(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const previous = sessions;
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) { setSessions(previous); toast.error(json.error ?? 'Could not revoke session.'); return; }
      toast.success('Session revoked.', { description: 'The associated device has been logged out.' });
    } catch {
      setSessions(previous);
      toast.error('Network error. Please try again.');
    }
  };

  const getSessionIcon = (device: string) => {
    if (device.toLowerCase().includes('iphone') || device.toLowerCase().includes('phone') || device.toLowerCase().includes('android')) {
      return <SmartphoneIcon className="h-5 w-5 text-[#6b7f3a]" />;
    }
    return <Monitor className="h-5 w-5 text-[#6b7f3a]" />;
  };

  const getStrengthBarColor = (strength: number) => {
    switch (strength) {
      case 1:
        return 'strength-weak';
      case 2:
        return 'strength-fair';
      case 3:
        return 'strength-good';
      case 4:
        return 'strength-strong';
      default:
        return 'bg-[#efe1c4]';
    }
  };

  const getStrengthText = (strength: number) => {
    switch (strength) {
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-[#2a2013]">Control Settings</h2>
        <p className="text-xs text-[#6b572f] mt-1">
          Manage station profile details, system passphrases, 2FA guard rails, and active sessions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Profile config */}
        <Card variant="cyber">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <User className="h-4.5 w-4.5 text-[#6b7f3a]" /> Profile Configuration
            </CardTitle>
            <CardDescription>Update your analyst credentials and organization details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">
                  Handler Name
                </label>
                <Input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="bg-[#fffbf3] border-[#e3d2a9] focus:border-[#6b7f3a] text-[#2a2013] text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">
                  Corporate Org
                </label>
                <Input
                  type="text"
                  value={profileCompany}
                  onChange={(e) => setProfileCompany(e.target.value)}
                  className="bg-[#fffbf3] border-[#e3d2a9] focus:border-[#6b7f3a] text-[#2a2013] text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">
                    Linked Email
                  </label>
                  {user?.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#47601f] bg-[#7f9548]/15 px-2 py-0.5 rounded border border-[#7f9548]/30">
                      <CheckCircle2 className="w-3 h-3 text-[#47601f]" /> Verified
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7a4a1a] bg-[#f6ebd3] px-2 py-0.5 rounded border border-[#9a721a]/30">
                        <AlertTriangle className="w-3 h-3 text-[#9a721a]" /> Unverified
                      </span>
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendingVerification}
                        className="text-[11px] text-[#47601f] hover:underline font-medium cursor-pointer disabled:opacity-50"
                      >
                        {resendingVerification ? 'Sending...' : 'Resend'}
                      </button>
                    </div>
                  )}
                </div>
                <Input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="bg-[#fffbf3] border-[#e3d2a9] focus:border-[#6b7f3a] text-[#2a2013] text-xs h-9"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="default"
                size="sm"
                className="w-full text-2xs uppercase tracking-wider font-semibold shadow-[0_0_10px_rgba(107, 127, 58,0.1)] cursor-pointer"
              >
                Commit Profile Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card variant="cyber">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Key className="h-4.5 w-4.5 text-[#6b7f3a]" /> Change Passphrase
            </CardTitle>
            <CardDescription>Keep access keys secure by rotating passwords regularly</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">
                  Current Access Pass
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-[#fffbf3] border-[#e3d2a9] focus:border-[#6b7f3a] text-[#2a2013] text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">
                  New Passphrase Key
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => handlePasswordStrengthCheck(e.target.value)}
                  className="bg-[#fffbf3] border-[#e3d2a9] focus:border-[#6b7f3a] text-[#2a2013] text-xs h-9"
                  required
                />
                {newPassword && (
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-[#6b572f]">
                      <span>Strength: {getStrengthText(passwordStrength)}</span>
                    </div>
                    {/* Strength bars */}
                    <div className="grid grid-cols-4 gap-1 h-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-full rounded-sm transition-all duration-300",
                            passwordStrength >= i ? getStrengthBarColor(passwordStrength) : "bg-[#efe1c4]"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6b572f]">
                  Confirm Passphrase Key
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[#fffbf3] border-[#e3d2a9] focus:border-[#6b7f3a] text-[#2a2013] text-xs h-9"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full text-2xs uppercase tracking-wider font-semibold cursor-pointer"
              >
                Rotate Passphrase Key
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Two-Factor Authentication */}
        <Card variant="cyber" className="flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Smartphone className="h-4.5 w-4.5 text-[#7f9548]" /> Multi-Factor Verification
              </CardTitle>
              <CardDescription>Enable 2FA prompts to secure account connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between bg-[#fffbf3] border border-[#e3d2a9]/50 p-4 rounded-lg">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#2a2013]">
                    TOTP Google / Duo Authentication
                  </h4>
                  <p className="text-sm text-[#6b572f] max-w-xs leading-relaxed">
                    Access sessions must pass token confirmations on registered auth hardware.
                  </p>
                </div>
                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggle2FA}
                  role="switch"
                  aria-checked={is2FAEnabled}
                  aria-label="Two-factor authentication"
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                    is2FAEnabled ? "bg-[#7f9548]" : "bg-[#efe1c4]"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      is2FAEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </CardContent>
          </div>
          <CardFooter className="pt-0 pb-6 text-3xs text-[#6b572f] border-t border-[#e3d2a9]/25 pt-4">
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-[#7f9548]" /> Profile is currently guarded in compliance with Enterprise policies.
            </span>
          </CardFooter>
        </Card>

        {/* Active sessions revoking */}
        <Card variant="cyber">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Shield className="h-4.5 w-4.5 text-[#a8402e]" /> Active Terminal Sessions
            </CardTitle>
            <CardDescription>Inspect and manage active device access handles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pr-1 max-h-[220px] overflow-y-auto divide-y divide-[#e3d2a9]/35">
            {sessions.map((session) => (
              <div key={session.id} className="flex justify-between items-center py-3 first:pt-0 group">
                <div className="flex gap-3 items-center">
                  <div className="p-2 bg-[#efe1c4] border border-[#e3d2a9] rounded-lg">
                    {getSessionIcon(session.device)}
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#2a2013]">{session.device}</span>
                      {session.isCurrent && (
                        <span className="text-xs uppercase tracking-wider bg-[#7f9548]/15 border border-[#7f9548]/35 text-[#7f9548] font-bold px-1.5 py-0.2 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6b572f]">
                      {session.browser} • {session.location} • {session.ip}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="p-1.5 rounded-lg text-[#6b572f] hover:text-[#a8402e] hover:bg-[#a8402e]/15 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Terminate session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
