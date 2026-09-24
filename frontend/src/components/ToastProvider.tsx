import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'error';
type Toast = { id: string; tone: ToastTone; title: string; message?: string };
type ToastContextValue = { showToast: (toast: Omit<Toast, 'id'>) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(() => ({
    showToast(toast) {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 3200);
    }
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[80] grid w-[min(360px,calc(100vw-2rem))] gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-lg border bg-white p-4 shadow-2xl ${toast.tone === 'success' ? 'border-emerald-200' : 'border-rose-200'}`}>
            <div className="flex items-start gap-3">
              {toast.tone === 'success' ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={20} /> : <XCircle className="mt-0.5 text-rose-600" size={20} />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-sm text-slate-600">{toast.message}</p> : null}
              </div>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
