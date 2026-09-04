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
  if (!dateString) {
    return 'N/D';
  }
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/D';
  }
  return format(parsed, 'MMM dd, yyyy');
};

export const formatDateTime = (dateString: string): string => {
  if (!dateString) {
    return 'N/D';
  }
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/D';
  }
  return format(parsed, 'MMM dd, yyyy HH:mm');
};

export const formatRelativeTime = (dateString: string): string => {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
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
      return 'text-emerald-700 bg-emerald-100 border border-emerald-200';
    case 'revoked':
    case 'refunded':
      return 'text-rose-700 bg-rose-100 border border-rose-200';
    case 'expired':
      return 'text-amber-700 bg-amber-100 border border-amber-200';
    case 'cancelled':
    case 'inactive':
    default:
      return 'text-gray-600 bg-gray-100 border border-gray-200';
  }
};

export const formatSubscriptionStatus = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Attivo';
    case 'revoked':
    case 'refunded':
      return 'Rimborsato / Revocato';
    case 'expired':
      return 'Scaduto';
    case 'cancelled':
      return 'Annullato';
    case 'inactive':
      return 'Nessun corso';
    default:
      return status;
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
