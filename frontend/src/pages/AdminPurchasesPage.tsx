import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../services/adminService';
import type { Course, PurchaseRecord } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../utils/errors';

const statusStyles: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
  disputed: 'bg-fuchsia-100 text-fuchsia-700',
  cancelled: 'bg-gray-200 text-gray-700',
  needs_review: 'bg-sky-100 text-sky-700',
};

export const AdminPurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    course_id: '',
    email: '',
    origin: '',
  });

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [purchaseItems, courseItems] = await Promise.all([
        adminService.getPurchases({
          status: filters.status || undefined,
          course_id: filters.course_id || undefined,
          email: filters.email || undefined,
          origin: filters.origin || undefined,
        }),
        adminService.getCourses(),
      ]);
      setPurchases(purchaseItems);
      setCourses(courseItems);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load purchases'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  if (loading) {
    return <Loading fullScreen text="Loading purchases..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error} onRetry={loadPurchases} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Purchases</h1>
        <p className="text-gray-600">Storico ordini con stato locale, stato Stripe, accesso sbloccato e origine acquisto.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Tutti gli stati</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="disputed">Disputed</option>
            <option value="needs_review">Needs review</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filters.course_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, course_id: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Tutti i corsi</option>
            {courses.map((course) => (
              <option key={course.course_id} value={course.course_id}>{course.title}</option>
            ))}
          </select>

          <select
            value={filters.origin}
            onChange={(event) => setFilters((prev) => ({ ...prev, origin: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Tutte le origini</option>
            <option value="public_checkout">Checkout pubblico</option>
            <option value="admin_manual">Assegnazione manuale</option>
            <option value="coupon_100">Coupon 100%</option>
            <option value="gift">Gift</option>
          </select>

          <input
            type="text"
            placeholder="Filtra per email"
            value={filters.email}
            onChange={(event) => setFilters((prev) => ({ ...prev, email: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />

          <Button variant="secondary" onClick={() => void loadPurchases()}>
            Applica filtri
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stati</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accesso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origine</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dettaglio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchases.map((purchase) => (
                <tr key={purchase.purchase_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{purchase.user_name || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{purchase.customer_email || purchase.user_email || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{purchase.course_title || purchase.course_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(purchase.purchase_date || purchase.created_at || '')}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex w-fit px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[purchase.local_status || purchase.status] || statusStyles.needs_review}`}>
                        {purchase.local_status || purchase.status}
                      </span>
                      <span className="text-xs text-gray-500">Stripe: {purchase.stripe_status || 'n/d'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {purchase.access_unlocked && !purchase.access_revoked ? 'Sbloccato' : 'Non attivo'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{purchase.purchase_origin || 'public_checkout'}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(Number(purchase.amount_gross ?? purchase.amount ?? 0))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/admin/purchases/${purchase.purchase_id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                      Apri
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {purchases.length === 0 && (
            <div className="text-center py-12 text-gray-500">No purchases found</div>
          )}
        </div>
      </div>
    </div>
  );
};
