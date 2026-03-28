import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign } from 'lucide-react';
import { adminService } from '../services/adminService';
import type { AdminStats } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { StatsCards } from '../components/admin/StatsCards';
import { formatDate, formatCurrency } from '../utils/formatters';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading fullScreen text="Loading statistics..." />;
  }

  if (error || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage
          variant="card"
          message={error || 'Failed to load statistics'}
          onRetry={loadStats}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Most Viewed Lessons */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Most Viewed Lessons
          </h2>
          <div className="space-y-3">
            {stats.most_viewed_lessons.map((lesson, index) => (
              <div
                key={lesson.lesson_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-400">
                    {index + 1}
                  </span>
                  <span className="font-medium text-gray-900">{lesson.title}</span>
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {lesson.views} views
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Recent Purchases
          </h2>
          <div className="space-y-3">
            {stats.recent_purchases.map((purchase) => (
              <div
                key={purchase.purchase_id}
                className="flex items-center justify-between p-3 border-b border-gray-200 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{purchase.user_email}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(purchase.purchase_date)}
                  </p>
                </div>
                <span className="font-semibold text-green-600">
                  {formatCurrency(purchase.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Access Chart (SVG Implementation) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Daily Active Users (Last 7 Days)
        </h2>

        <div className="w-full h-64">
          <svg width="100%" height="100%" viewBox="0 0 800 200">
            {stats.daily_access_chart.map((day, index) => {
              const maxUsers = Math.max(
                ...stats.daily_access_chart.map((d) => d.active_users),
                1 // Avoid division by zero
              );
              // Dimensions
              const barWidth = 60;
              const gap = (800 - (barWidth * 7)) / 6;
              const x = index * (barWidth + gap);

              const chartHeight = 150;
              const barHeight = (day.active_users / maxUsers) * chartHeight;
              const y = chartHeight - barHeight;

              const dateLabel = new Date(day.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <g key={day.date}>
                  {/* Bar */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 5)}
                    fill="#2563eb"
                    rx="4"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <title>{day.active_users} users on {dateLabel}</title>
                  </rect>

                  {/* Value Label (only if > 0) */}
                  {day.active_users > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 10}
                      textAnchor="middle"
                      fill="#374151"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {day.active_users}
                    </text>
                  )}

                  {/* Date Label (axis) */}
                  <text
                    x={x + barWidth / 2}
                    y={180}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="12"
                  >
                    {dateLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
