import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type NoticeKind = 'success' | 'error';

type Notice = {
  id: number;
  kind: NoticeKind;
  title: string;
  message: string;
};

type AdminOperationContextValue = {
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
};

const AdminOperationContext = createContext<AdminOperationContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminOperationBanner = (): AdminOperationContextValue => {
  const context = useContext(AdminOperationContext);
  if (!context) {
    throw new Error('useAdminOperationBanner deve essere usato dentro AdminOperationBannerProvider');
  }
  return context;
};

export const AdminOperationBannerProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setNotice(null);
  }, []);

  const show = useCallback((kind: NoticeKind, title: string, message: string) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    const id = Date.now();
    setNotice({ id, kind, title, message });
    timeoutRef.current = window.setTimeout(() => {
      setNotice((current) => current?.id === id ? null : current);
      timeoutRef.current = null;
    }, kind === 'success' ? 6000 : 9000);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  return (
    <AdminOperationContext.Provider value={{
      showSuccess: (title, message) => show('success', title, message),
      showError: (title, message) => show('error', title, message),
    }}>
      {children}
      {notice && (
        <div className="pointer-events-none fixed inset-x-4 top-20 z-[90] mx-auto max-w-xl" aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}>
          <div
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#e6aebe] bg-[#fff0f5] px-4 py-3.5 text-[#733b4d] shadow-xl shadow-[#7c3a4d]/15"
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            {notice.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{notice.title}</p>
              <p className="mt-0.5 text-sm leading-5 text-[#8d5365]">{notice.message}</p>
            </div>
            <button type="button" onClick={dismiss} className="-mr-1 -mt-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[#8d5365] hover:bg-[#f8dce5]" aria-label="Chiudi messaggio">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AdminOperationContext.Provider>
  );
};
