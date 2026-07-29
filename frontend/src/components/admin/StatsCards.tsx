import React from 'react';
import type { AdminStats } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface StatsCardsProps {
  stats: AdminStats;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Studenti totali',
      value: stats.total_students,
      subtitle: `${stats.active_students} con accesso al corso`,
    },
    {
      title: 'Incassi ultimi 30 giorni',
      value: formatCurrency(stats.revenue_last_30_days ?? stats.total_revenue ?? 0),
      subtitle: `${stats.new_purchases_month} ordini registrati`,
    },
    {
      title: 'Studenti attivi',
      value: stats.active_students_last_7_days ?? 0,
      subtitle: 'Hanno seguito almeno una lezione negli ultimi 7 giorni',
    },
    {
      title: 'Completamento medio',
      value: formatPercentage(stats.average_completion_rate, 1),
      subtitle: 'Avanzamento medio nelle lezioni seguite',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {cards.map((card, index) => {
        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow"
          >
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
