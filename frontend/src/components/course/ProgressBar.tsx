import React from 'react';
import { CheckCircle } from 'lucide-react';
import { formatPercentage } from '../../utils/formatters';

interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  showLabel = true,
  size = 'md',
  variant = 'default',
}) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const isComplete = percentage === 100;

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const barColor =
    variant === 'success' || isComplete
      ? 'bg-green-600'
      : 'bg-primary-600';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Progress
            </span>
            {isComplete && (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {current} / {total} ({formatPercentage(percentage)})
          </span>
        </div>
      )}

      <div className={`w-full ${heightStyles[size]} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`${heightStyles[size]} ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
