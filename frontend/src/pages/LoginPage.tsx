import { useEffect, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Navigate, useSearchParams } from 'react-router-dom';
import { GOOGLE_LOGIN_URL } from '../api';
import { FullPageSpinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  invalid_state: 'Your sign-in session expired. Please try again.',
};

const inputClass =
  'h-11 w-full rounded-lg border-0 bg-ink-50 px-4 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function LoginPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();

  useEffect(() => {
    const error = params.get('error');
    if (error) toast.error(ERRORS[error] ?? 'Sign-in failed. Please try again.');
  }, [params]);

  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to="/scheduled" replace />;

  // The assignment requires real Google OAuth; email/password is shown to match the design only.
  const onEmailLogin = (e: FormEvent) => {
    e.preventDefault();
    toast('Email sign-in is not enabled. Please continue with Google.', { icon: 'ℹ️' });
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px] rounded-xl border border-ink-100 px-10 pb-10 pt-9">
        <h1 className="mb-6 text-center text-[28px] font-bold text-ink-900">Login</h1>

        <a
          href={GOOGLE_LOGIN_URL}
          className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg bg-brand-50 text-sm text-ink-900 transition-colors hover:bg-brand-100"
        >
          <GoogleLogo /> Login with Google
        </a>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-400">
          <span className="h-px flex-1 bg-ink-100" />
          or sign up through email
          <span className="h-px flex-1 bg-ink-100" />
        </div>

        <form onSubmit={onEmailLogin} className="flex flex-col gap-3">
          <input type="email" placeholder="Email ID" autoComplete="email" className={inputClass} />
          <input type="password" placeholder="Password" autoComplete="current-password" className={inputClass} />
          <button
            type="submit"
            className="mt-3 h-10 rounded-lg bg-brand-500 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
