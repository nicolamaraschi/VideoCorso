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

const statusLabels: Record<string, string> = {
  paid: 'Pagato', pending: 'In attesa', failed: 'Non riuscito', refunded: 'Rimborsato',
  disputed: 'Contestato', cancelled: 'Annullato', needs_review: 'Da verificare',
};

const originLabels: Record<string, string> = {
  public_checkout: 'Checkout pubblico', admin_manual: 'Assegnazione manuale', coupon_100: 'Coupon 100%', gift: 'Regalo',
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
      setError(getErrorMessage(err, 'Impossibile caricare gli acquisti'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  if (loading) {
    return <Loading fullScreen text="Caricamento acquisti..." />;
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Acquisti</h1>
        <p className="text-gray-600">Storico ordini con stato locale, stato Stripe, accesso sbloccato e origine acquisto.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Tutti gli stati</option>
            <option value="paid">Pagato</option>
            <option value="pending">In attesa</option>
            <option value="failed">Non riuscito</option>
            <option value="refunded">Rimborsato</option>
            <option value="disputed">Contestato</option>
            <option value="needs_review">Da verificare</option>
            <option value="cancelled">Annullato</option>
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
            <option value="gift">Regalo</option>
          </select>

          <input
            type="text"
            placeholder="Filtra per email"
            value={filters.email}
            onChange={(event) => setFilters((prev) => ({ ...prev, email: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />

          <Button className="w-full md:w-auto" variant="secondary" onClick={() => void loadPurchases()}>
            Applica filtri
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="space-y-3 p-3 sm:hidden">
          {purchases.map((purchase) => {
            const localStatus = purchase.local_status || purchase.status;
            const email = purchase.customer_email || purchase.user_email || 'Non disponibile';
            return (
              <article key={purchase.purchase_id} className="rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold text-gray-900">{purchase.user_name || 'Cliente'}</h2>
                    <p className="mt-1 break-all text-sm text-gray-500">{email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[localStatus] || statusStyles.needs_review}`}>
                    {statusLabels[localStatus] || localStatus || 'Da verificare'}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Corso</dt><dd className="mt-1 break-words text-gray-800">{purchase.course_title || purchase.course_id}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Importo</dt><dd className="mt-1 font-semibold text-gray-900">{formatCurrency(Number(purchase.amount_gross ?? purchase.amount ?? 0))}</dd></div>
                  <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Accesso</dt><dd className="mt-1 text-gray-800">{purchase.access_unlocked && !purchase.access_revoked ? 'Sbloccato' : 'Non attivo'}</dd></div>
                  <div className="col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Data</dt><dd className="mt-1 text-gray-800">{formatDateTime(purchase.purchase_date || purchase.created_at || '')}</dd></div>
                </dl>
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <Link to={`/admin/purchases/${purchase.purchase_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:text-primary-800">Apri dettaglio pagamento</Link>
                </div>
              </article>
            );
          })}
          {purchases.length === 0 && <div className="py-12 text-center text-gray-500">Nessun acquisto trovato</div>}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[960px]">
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
                    <div className="font-medium text-gray-900">{purchase.user_name || 'Cliente'}</div>
                    <div className="text-sm text-gray-500">{purchase.customer_email || purchase.user_email || 'Non disponibile'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{purchase.course_title || purchase.course_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(purchase.purchase_date || purchase.created_at || '')}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex w-fit px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[purchase.local_status || purchase.status] || statusStyles.needs_review}`}>
                        {statusLabels[purchase.local_status || purchase.status] || purchase.local_status || purchase.status}
                      </span>
                      <span className="text-xs text-gray-500">Stripe: {statusLabels[purchase.stripe_status || ''] || purchase.stripe_status || 'Non disponibile'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {purchase.access_unlocked && !purchase.access_revoked ? 'Sbloccato' : 'Non attivo'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{originLabels[purchase.purchase_origin || ''] || 'Checkout pubblico'}</td>
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
            <div className="text-center py-12 text-gray-500">Nessun acquisto trovato</div>
          )}
        </div>
      </div>
    </div>
  );
};
