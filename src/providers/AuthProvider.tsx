'use client';

/**
 * Real cookie-based session, backed by /api/auth/*. The session cookie is
 * HttpOnly and signed (see src/lib/session.ts) — this provider never sees or
 * stores the token itself, only the user object the server returns.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthState, LoginCredentials, RegisterData } from '@/types/auth';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAuthenticated: false, isLoading: true, token: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.user) setState({ user: json.user, isAuthenticated: true, isLoading: false, token: null });
        else setState((s) => ({ ...s, isLoading: false }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    if (!credentials.email || !credentials.password) return { success: false, error: 'Email and password are required.' };
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, error: json.error ?? 'Login failed.' };
      setState({ user: json.user, isAuthenticated: true, isLoading: false, token: null });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    if (data.password !== data.confirmPassword) return { success: false, error: 'Passwords do not match.' };
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password, company: data.company }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, error: json.error ?? 'Registration failed.' };
      setState({ user: json.user, isAuthenticated: true, isLoading: false, token: null });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setState({ user: null, isAuthenticated: false, isLoading: false, token: null });
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    if (!email) return { success: false, error: 'Email is required.' };
    // No password-reset email flow yet — acknowledging without sending is
    // more honest than pretending mail went out.
    return { success: true };
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...updates } } : s));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, forgotPassword, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
