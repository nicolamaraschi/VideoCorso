import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-2 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[calc(100dvh-1rem)] w-full ${sizeStyles[size]} flex-col overflow-hidden rounded-xl bg-white shadow-xl sm:max-h-[90vh]`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between gap-4 border-b p-4 sm:p-6">
            {title && <h3 className="min-w-0 text-lg font-semibold text-gray-900 sm:text-xl">{title}</h3>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="-mr-2 -my-2 min-h-11 min-w-11 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Chiudi finestra"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
};
