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

      {/* Daily Access Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Daily Active Users (Last 7 Days)
        </h2>
        <div className="h-64 flex items-end justify-between gap-2">
          {stats.daily_access_chart.map((day) => {
            const maxUsers = Math.max(
              ...stats.daily_access_chart.map((d) => d.unique_users)
            );
            const height = (day.unique_users / maxUsers) * 100;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-primary-600 rounded-t-lg hover:bg-primary-700 transition-colors relative group" style={{ height: `${height}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded">
                    {day.unique_users} users
                  </div>
                </div>
                <span className="text-xs text-gray-600 mt-2">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
