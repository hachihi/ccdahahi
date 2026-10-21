import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 transition ${
            t.type === 'error'
              ? 'bg-rose-900/90 border-rose-700 text-white'
              : t.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-700 text-white'
              : 'bg-slate-900/90 border-slate-700 text-white'
          }`}
        >
          {t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
          ) : t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
          )}

          <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
            {t.text}
          </div>

          <button
            onClick={() => onDismiss(t.id)}
            className="text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
