import { Eye, EyeOff, FlaskConical, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../components/ToastProvider';
import { useAppDispatch } from '../hooks';
import { authenticate } from '../services/authService';
import { login } from '../store';
import { getMissingFields, showMissingFieldsToast } from '../utils/requiredFields';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const missing = getMissingFields([
      { label: 'Email', value: email },
      { label: 'Password', value: password }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;
    setIsSubmitting(true);
    try {
      const session = await authenticate(email.trim(), password);
      dispatch(login(session));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-4 py-10 text-[#333333]">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFF0E8]" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#FFF7F2]" />
      <section className="relative w-full max-w-md rounded-2xl border border-[#F2D8CC] bg-white p-7 shadow-[0_12px_40px_rgba(255,90,31,0.10)] sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#FF5A1F] text-white shadow-[0_6px_14px_rgba(255,90,31,0.25)]">
            <FlaskConical size={22} />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#FF5A1F]">Omsons R&amp;D</p>
            <h1 className="text-2xl font-bold text-[#333333]">Welcome back</h1>
            <p className="mt-1 text-sm text-[#737373]">Sign in with your Admin or Staff account</p>
          </div>
        </div>

        <form className="space-y-5" noValidate onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#333333]">Email</span>
            <input className="field" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#333333]">Password</span>
            <div className="relative">
              <input className="field pr-12" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
              <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-[#FF5A1F]" title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}

          <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#FF5A1F] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E84D16] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
            <LogIn size={18} />
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
