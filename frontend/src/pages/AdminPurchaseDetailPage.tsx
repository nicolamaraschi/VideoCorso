import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, RefreshCcw, ShieldCheck, ShieldX } from 'lucide-react';
import { adminService } from '../services/adminService';
import type { PurchaseDetail } from '../types';
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

export const AdminPurchaseDetailPage: React.FC = () => {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!purchaseId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getPurchaseDetail(purchaseId);
      setDetail(response);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load purchase detail'));
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const runAction = async (action: 'resync' | 'unlock' | 'revoke' | 'verify') => {
    if (!purchaseId) {
      return;
    }

    try {
      setActionLoading(action);
      if (action === 'resync') {
        await adminService.resyncPurchase(purchaseId);
      }
      if (action === 'unlock') {
        await adminService.forceUnlockPurchase(purchaseId);
      }
      if (action === 'revoke') {
        await adminService.revokePurchase(purchaseId);
      }
      if (action === 'verify') {
        await adminService.markPurchaseVerified(purchaseId);
      }
      await loadDetail();
    } catch (err) {
      alert(getErrorMessage(err, 'Purchase action failed'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <Loading fullScreen text="Loading purchase detail..." />;
  }

  if (error || !detail) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error || 'Purchase not found'} onRetry={loadDetail} />
      </div>
    );
  }

  const { purchase, timeline } = detail;
  const localStatus = purchase.local_status || purchase.status;
  const amount = Number(purchase.amount_gross ?? purchase.amount ?? 0);
  const currency = (purchase.currency || 'EUR').toUpperCase();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/admin/purchases" className="text-sm text-primary-600 hover:text-primary-700">
            Torna agli acquisti
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{purchase.course_title || purchase.course_id}</h1>
          <p className="text-gray-600">{purchase.customer_email || purchase.user_email || 'Email non disponibile'}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" loading={actionLoading === 'resync'} onClick={() => void runAction('resync')}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Risincronizza Stripe
          </Button>
          <Button variant="primary" loading={actionLoading === 'unlock'} onClick={() => void runAction('unlock')}>
            <ShieldCheck className="w-4 h-4 mr-2" />
            Forza sblocco
          </Button>
          <Button variant="danger" loading={actionLoading === 'revoke'} onClick={() => void runAction('revoke')}>
            <ShieldX className="w-4 h-4 mr-2" />
            Revoca accesso
          </Button>
          <Button variant="ghost" loading={actionLoading === 'verify'} onClick={() => void runAction('verify')}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Segna verificato
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Stato locale</p>
          <span className={`inline-flex px-3 py-1 mt-2 rounded-full text-sm font-medium ${statusStyles[localStatus] || statusStyles.needs_review}`}>
            {localStatus}
          </span>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Stato Stripe</p>
          <p className="text-xl font-semibold text-gray-900 mt-2">{purchase.stripe_status || 'n/d'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Importo</p>
          <p className="text-xl font-semibold text-gray-900 mt-2">
            {currency === 'EUR' ? formatCurrency(amount) : `${amount.toFixed(2)} ${currency}`}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Accesso</p>
          <p className="text-xl font-semibold text-gray-900 mt-2">
            {purchase.access_unlocked && !purchase.access_revoked ? 'Sbloccato' : 'Non attivo'}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-semibold text-gray-900">Dettaglio ordine</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Cliente</p>
              <p className="font-medium text-gray-900">{purchase.user_name || 'Cliente'}</p>
              <p className="text-gray-600">{purchase.customer_email || purchase.user_email || 'n/d'}</p>
            </div>
            <div>
              <p className="text-gray-500">Origine acquisto</p>
              <p className="font-medium text-gray-900">{purchase.purchase_origin || 'public_checkout'}</p>
            </div>
            <div>
              <p className="text-gray-500">Pagamento</p>
              <p className="font-medium text-gray-900">{formatDateTime(purchase.purchase_date || purchase.created_at || '')}</p>
            </div>
            <div>
              <p className="text-gray-500">Webhook</p>
              <p className="font-medium text-gray-900">{purchase.webhook_status || 'n/d'}</p>
              {purchase.webhook_received_at && (
                <p className="text-gray-600">{formatDateTime(purchase.webhook_received_at)}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500">Coupon</p>
              <p className="font-medium text-gray-900">{purchase.coupon_code || 'Nessuno'}</p>
            </div>
            <div>
              <p className="text-gray-500">Verificato admin</p>
              <p className="font-medium text-gray-900">{purchase.verified_by_admin ? 'Si' : 'No'}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Stripe session id</p>
              <p className="font-mono text-gray-900 break-all">{purchase.stripe_session_id || 'n/d'}</p>
            </div>
            <div>
              <p className="text-gray-500">Payment intent</p>
              <p className="font-mono text-gray-900 break-all">{purchase.stripe_payment_intent_id || 'n/d'}</p>
            </div>
            <div>
              <p className="text-gray-500">Charge id</p>
              <p className="font-mono text-gray-900 break-all">{purchase.stripe_charge_id || 'n/d'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-semibold text-gray-900">Refund e accesso</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Refund status</p>
              <p className="font-medium text-gray-900">{purchase.refund_status || 'not_refunded'}</p>
            </div>
            <div>
              <p className="text-gray-500">Tipo rimborso</p>
              <p className="font-medium text-gray-900">{purchase.refund_type || 'n/d'}</p>
            </div>
            <div>
              <p className="text-gray-500">Importo rimborsato</p>
              <p className="font-medium text-gray-900">
                {currency === 'EUR'
                  ? formatCurrency(Number(purchase.refunded_amount || 0))
                  : `${Number(purchase.refunded_amount || 0).toFixed(2)} ${currency}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Contestazione</p>
              <p className="font-medium text-gray-900">{purchase.is_disputed ? 'Si' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-500">Accesso revocato</p>
              <p className="font-medium text-gray-900">{purchase.access_revoked ? 'Si' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-500">Motivo revoca</p>
              <p className="font-medium text-gray-900">{purchase.access_revocation_reason || 'n/d'}</p>
            </div>
          </div>

          {purchase.coupon_snapshot && (
            <div className="border-t border-gray-200 pt-4 text-sm">
              <p className="text-gray-500 mb-2">Snapshot coupon</p>
              <div className="rounded-lg bg-gray-50 p-4 space-y-1">
                <p className="text-gray-900">Codice: {purchase.coupon_snapshot.code || purchase.coupon_code}</p>
                <p className="text-gray-900">Tipo: {purchase.coupon_snapshot.discount_type || 'n/d'}</p>
                <p className="text-gray-900">Valore: {purchase.coupon_snapshot.discount_value ?? 'n/d'}</p>
                <p className="text-gray-900">Free access: {purchase.coupon_snapshot.is_free_access ? 'Si' : 'No'}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Timeline operativa</h2>
        <div className="space-y-3">
          {timeline.map((item) => (
            <div key={`${item.label}-${item.at}`} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3">
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-600">{formatDateTime(item.at)}</p>
            </div>
          ))}
          {timeline.length === 0 && (
            <p className="text-gray-500">Nessun evento timeline disponibile per questo acquisto.</p>
          )}
        </div>
      </section>
    </div>
  );
};
