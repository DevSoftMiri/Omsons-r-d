import { Eye, EyeOff, FlaskConical, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAppDispatch } from '../hooks';
import { authenticate } from '../services/authService';
import { login } from '../store';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
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
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-ink">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-white">
            <FlaskConical size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Omsons R&D Login</h1>
            <p className="text-sm text-slate-500">Sign in with your Admin or Staff account</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Email</span>
            <input className="field" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Password</span>
            <div className="relative">
              <input className="field pr-12" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
              <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-ink" title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}

          <button className="primary-button w-full justify-center" type="submit" disabled={isSubmitting}>
            <LogIn size={18} />
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
