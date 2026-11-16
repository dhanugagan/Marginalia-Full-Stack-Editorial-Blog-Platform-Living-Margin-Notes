import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res =
        mode === 'login'
          ? await api.auth.login({ email, password })
          : await api.auth.register({ name, username, email, password, bio });
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoFill = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.auth.login({
        email: 'clara@marginalia.press',
        password: 'marginalia2026',
      });
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#FBF9F5] dark:bg-[#1A1816] border border-[#E4DDD0] dark:border-[#2E2924] p-7 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#E4DDD0] dark:border-[#2E2924]">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#78716C] dark:text-[#A8A29E]">
              Marginalia Press
            </p>
            <h2
              id="auth-modal-title"
              className="font-serif-display text-2xl font-medium text-[#181614] dark:text-[#F5F0E8] mt-1"
            >
              {mode === 'login' ? 'Sign in to publish' : 'Create contributor account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-2 rounded-lg text-[#78716C] hover:text-[#181614] dark:hover:text-[#F5F0E8] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 mt-5 rounded-lg bg-[#EFEAE0] dark:bg-[#24211D]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'login'
                ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8] shadow-xs'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'register'
                ? 'bg-[#FBF9F5] dark:bg-[#141210] text-[#181614] dark:text-[#F5F0E8] shadow-xs'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181614] dark:hover:text-[#F5F0E8]'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3D1] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Elena Rostova"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3D1] mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="erostova"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3D1] mb-1.5">
              {mode === 'login' ? 'Email or Username' : 'Email Address'}
            </label>
            <input
              type={mode === 'login' ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="clara@marginalia.press"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3D1] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#78716C] hover:text-[#181614] dark:hover:text-[#F5F0E8] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-[#44403C] dark:text-[#D6D3D1] mb-1.5">
                Editorial Bio (optional)
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Software architect writing on calm systems"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-[#121110] border border-[#D6CEBE] dark:border-[#332E29] text-[#181614] dark:text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2.5"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-[#181614] dark:bg-[#F5F0E8] text-[#FBF9F5] dark:text-[#181614] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {submitting
              ? 'Authenticating...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-5 pt-4 border-t border-[#E4DDD0] dark:border-[#2E2924]">
            <button
              type="button"
              disabled={submitting}
              onClick={handleDemoFill}
              className="w-full py-2 px-4 text-xs font-medium rounded-lg border border-[#D6CEBE] dark:border-[#332E29] text-[#44403C] dark:text-[#D6D3D1] hover:bg-[#EFEAE0] dark:hover:bg-[#262320] transition-colors cursor-pointer"
            >
              Sign in as Demo Editor (Clara Vance)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
