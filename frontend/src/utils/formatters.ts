import { formatDistanceToNow, format, differenceInDays } from 'date-fns';

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM dd, yyyy');
};

export const formatDateTime = (dateString: string): string => {
  return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
};

export const formatRelativeTime = (dateString: string): string => {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100);
};

export const formatPercentage = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

export const getDaysRemaining = (endDate: string): number => {
  return differenceInDays(new Date(endDate), new Date());
};

export const formatWatchTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const getSubscriptionStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'text-green-600 bg-green-100';
    case 'expired':
      return 'text-red-600 bg-red-100';
    case 'cancelled':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
