import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../services/adminService';
import type { AdminStats } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { StatsCards } from '../components/admin/StatsCards';
import { formatCurrency, formatDate, formatPercentage } from '../utils/formatters';
import { getErrorMessage } from '../utils/errors';

const purchaseStatusLabels: Record<string, string> = {
  paid: 'Pagato', pending: 'In attesa', failed: 'Non riuscito', refunded: 'Rimborsato',
  disputed: 'Contestato', cancelled: 'Annullato', needs_review: 'Da verificare',
};

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      setStats(await adminService.getStats());
      setLastUpdated(new Date());
    } catch (err) {
      setError(getErrorMessage(err, 'Impossibile caricare la panoramica'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
    const refreshTimer = window.setInterval(() => void loadStats(), 60_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  if (loading) return <Loading fullScreen text="Aggiornamento della panoramica..." />;
  if (error || !stats) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"><ErrorMessage variant="card" message={error || 'Panoramica non disponibile'} onRetry={loadStats} /></div>;
  }

  // The deployed API may be updated independently from the interface. Defaults keep
  // the dashboard usable while older responses are still being served.
  const dashboardStats: AdminStats = {
    ...stats,
    revenue_last_30_days: stats.revenue_last_30_days ?? stats.total_revenue ?? 0,
    active_students_last_7_days: stats.active_students_last_7_days ?? 0,
    attention_items: stats.attention_items ?? [],
    course_health: stats.course_health ?? [],
    recent_purchases: stats.recent_purchases ?? [],
    daily_access_chart: stats.daily_access_chart ?? [],
  };
  const hasOperationalMonitoring = Array.isArray(stats.attention_items);
  const chartMaximum = Math.max(...dashboardStats.daily_access_chart.map((day) => day.active_users), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-700">Panoramica operativa</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Come stanno andando i corsi</h1>
          <p className="mt-2 text-gray-600">Controlla prima ciò che richiede un intervento, poi segui l’andamento di studenti e vendite.</p>
        </div>
        <div className="self-start text-right">
          {lastUpdated && <p className="mb-1 text-xs text-gray-500">Aggiornata alle {lastUpdated.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>}
          <button type="button" onClick={() => void loadStats()} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Aggiorna dati</button>
        </div>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Da controllare</h2>
            <p className="mt-1 text-sm text-gray-600">Situazioni che possono bloccare una cliente o richiedere una verifica.</p>
          </div>
          <Link to="/admin/purchases" className="text-sm font-medium text-primary-700 hover:text-primary-800">Vedi tutti gli acquisti</Link>
        </div>
        {!hasOperationalMonitoring ? (
          <div className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">L’analisi automatica di pagamenti e accessi sarà disponibile non appena si aggiorna il servizio dati.</div>
        ) : dashboardStats.attention_items.length === 0 ? (
          <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Tutto sotto controllo: non ci sono pagamenti o accessi che richiedono attenzione.</div>
        ) : (
          <div className="mt-5 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {dashboardStats.attention_items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-semibold ${item.severity === 'urgent' ? 'text-red-700' : 'text-amber-800'}`}>{item.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                </div>
                <Link className="shrink-0 text-sm font-medium text-primary-700 hover:text-primary-800" to={item.action_url}>{item.action_label}</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <StatsCards stats={dashboardStats} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-gray-900">Andamento dei corsi</h2><p className="mt-1 text-sm text-gray-600">Studenti iscritti, attivi e avanzamento per ogni corso.</p></div>
            <Link to="/admin/course" className="text-sm font-medium text-primary-700 hover:text-primary-800">Gestisci corsi</Link>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-3 font-medium">Corso</th><th className="pb-3 font-medium">Iscritti</th><th className="pb-3 font-medium">Attivi 7 gg</th><th className="pb-3 font-medium">Completamento</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {dashboardStats.course_health.map((course) => <tr key={course.course_id}><td className="py-3 font-medium text-gray-900">{course.title}</td><td className="py-3 text-gray-700">{course.enrolled_students}</td><td className="py-3 text-gray-700">{course.active_students_last_7_days}</td><td className="py-3 text-gray-700">{formatPercentage(course.average_completion_rate, 0)}</td></tr>)}
              </tbody>
            </table>
            {dashboardStats.course_health.length === 0 && <p className="py-5 text-sm text-gray-500">I dettagli per corso saranno disponibili al prossimo aggiornamento dei dati.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-gray-900">Ultimi acquisti</h2><p className="mt-1 text-sm text-gray-600">Gli ultimi ordini registrati, con il loro stato.</p></div><Link to="/admin/purchases" className="text-sm font-medium text-primary-700 hover:text-primary-800">Vedi tutti</Link></div>
          <div className="mt-5 divide-y divide-gray-100">
            {dashboardStats.recent_purchases.map((purchase) => <Link key={purchase.purchase_id} to={`/admin/purchases/${purchase.purchase_id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-gray-50"><div><p className="font-medium text-gray-900">{purchase.user_email || 'Email non disponibile'}</p><p className="mt-1 text-sm text-gray-500">{formatDate(purchase.purchase_date)} · {purchaseStatusLabels[purchase.status || ''] || 'Da verificare'}</p></div><span className="shrink-0 font-semibold text-gray-900">{formatCurrency(purchase.amount)}</span></Link>)}
            {dashboardStats.recent_purchases.length === 0 && <p className="py-5 text-sm text-gray-500">Non ci sono ancora acquisti.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-gray-900">Partecipazione negli ultimi 7 giorni</h2>
        <p className="mt-1 text-sm text-gray-600">Numero di studenti che hanno seguito almeno una lezione ogni giorno.</p>
        <div className="mt-6 grid grid-cols-7 items-end gap-2 sm:gap-4 h-44">
          {dashboardStats.daily_access_chart.map((day) => {
            const height = Math.max((day.active_users / chartMaximum) * 100, day.active_users ? 10 : 2);
            const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
            return <div key={day.date} className="flex h-full flex-col justify-end text-center"><span className="mb-2 text-sm font-semibold text-gray-800">{day.active_users || ''}</span><div className="rounded-t-md bg-primary-600" style={{ height: `${height}%` }} /><span className="mt-2 text-xs text-gray-500">{label}</span></div>;
          })}
        </div>
      </section>
    </div>
  );
};
