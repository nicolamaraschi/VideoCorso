import React from 'react';
import { AlertCircle, XCircle } from 'lucide-react';
import { Button } from './Button';

interface ErrorMessageProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  variant?: 'inline' | 'card';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = 'Error',
  onRetry,
  variant = 'inline',
}) => {
  if (variant === 'card') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-200">
        <XCircle className="w-12 h-12 text-red-600 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">{title}</h3>
        <p className="text-red-700 text-center mb-4">{message}</p>
        {onRetry && (
          <Button variant="danger" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-red-900 mb-1">{title}</h4>
        <p className="text-sm text-red-700">{message}</p>
        {onRetry && (
          <Button variant="danger" size="sm" onClick={onRetry} className="mt-3">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
};
