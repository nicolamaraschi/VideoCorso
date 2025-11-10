import React from 'react';
import { Users, DollarSign, Video, TrendingUp, Clock } from 'lucide-react';
import { AdminStats } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface StatsCardsProps {
  stats: AdminStats;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Total Students',
      value: stats.total_students,
      subtitle: `${stats.active_students} active`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.total_revenue),
      subtitle: `${stats.new_purchases_month} purchases this month`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Video Views',
      value: stats.total_video_views,
      subtitle: 'Total video views',
      icon: Video,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Completion Rate',
      value: formatPercentage(stats.average_completion_rate, 1),
      subtitle: 'Average course completion',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {card.value}
            </h3>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {card.title}
            </p>
            <p className="text-xs text-gray-500">{card.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
};
