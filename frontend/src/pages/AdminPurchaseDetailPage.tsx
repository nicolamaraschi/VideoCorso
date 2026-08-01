import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../services/adminService';
import type { PurchaseDetail } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
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

const paymentStatusLabels: Record<string, string> = {
  paid: 'Pagato', succeeded: 'Pagamento riuscito', pending: 'In attesa', open: 'In attesa',
  unpaid: 'Non pagato', failed: 'Non riuscito', refunded: 'Rimborsato', disputed: 'Contestato',
  not_refunded: 'Nessun rimborso', received: 'Ricevuto', not_received: 'Non ricevuto',
};

const localStatusLabels: Record<string, string> = {
  paid: 'Pagato', pending: 'In attesa', failed: 'Non riuscito', refunded: 'Rimborsato',
  disputed: 'Contestato', cancelled: 'Annullato', needs_review: 'Da verificare',
};

const readableStatus = (status?: string | null) => paymentStatusLabels[status || ''] || status || 'Non disponibile';

export const AdminPurchaseDetailPage: React.FC = () => {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCorrectEmailOpen, setIsCorrectEmailOpen] = useState(false);
  const [correctedEmail, setCorrectedEmail] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundConfirmed, setRefundConfirmed] = useState(false);

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
      setError(getErrorMessage(err, 'Impossibile caricare il dettaglio dell’acquisto'));
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const runAction = async (action: 'resync' | 'unlock' | 'revoke' | 'verify' | 'delete-test') => {
    if (!purchaseId) {
      return;
    }

    const confirmations = {
      unlock: 'Concedere accesso manuale al corso? Usalo soltanto dopo aver verificato il caso: l’accesso può essere attivato anche senza una conferma di pagamento.',
      revoke: 'Revocare subito l’accesso al corso? Lo studente non potrà più vedere le lezioni.',
      'delete-test': 'Eliminare definitivamente questo ordine Stripe di test? L’accesso associato verrà rimosso.',
    } as const;
    if ((action === 'unlock' || action === 'revoke' || action === 'delete-test') && !window.confirm(confirmations[action])) {
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
      if (action === 'delete-test') {
        await adminService.deleteStripeTestPurchase(purchaseId);
        navigate('/admin/purchases');
        return;
      }
      await loadDetail();
    } catch (err) {
      alert(getErrorMessage(err, 'Azione sull’acquisto non riuscita'));
    } finally {
      setActionLoading(null);
    }
  };

  const openCorrectEmail = () => {
    setCorrectedEmail('');
    setCorrectionReason('');
    setEmailConfirmed(false);
    setIsCorrectEmailOpen(true);
  };

  const correctEmail = async () => {
    if (!purchaseId || !detail || !emailConfirmed) {
      return;
    }
    try {
      setActionLoading('correct-email');
      const response = await adminService.correctPurchaseEmail(purchaseId, {
        email: correctedEmail,
        full_name: detail.purchase.user_name,
        reason: correctionReason,
      });
      setIsCorrectEmailOpen(false);
      await loadDetail();
      alert(response.message || 'Email dell’acquisto corretta.');
    } catch (err) {
      alert(getErrorMessage(err, 'Impossibile correggere l’email dell’acquisto'));
    } finally {
      setActionLoading(null);
    }
  };

  const openRefund = (maximumAmount: number) => {
    setRefundAmount(maximumAmount.toFixed(2));
    setRefundReason('');
    setRefundConfirmed(false);
    setIsRefundOpen(true);
  };

  const refundPurchase = async () => {
    if (!purchaseId || !refundConfirmed) return;
    try {
      setActionLoading('refund');
      await adminService.refundPurchase(purchaseId, {
        amount: Number(refundAmount),
        reason: refundReason,
      });
      setIsRefundOpen(false);
      await loadDetail();
      alert('Rimborso emesso. Lo stato dell’ordine e l’accesso al corso sono stati aggiornati.');
    } catch (err) {
      alert(getErrorMessage(err, 'Impossibile emettere il rimborso'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <Loading fullScreen text="Caricamento dettaglio acquisto..." />;
  }

  if (error || !detail) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error || 'Acquisto non trovato'} onRetry={loadDetail} />
      </div>
    );
  }

  const { purchase, timeline, customer_view: customerView } = detail;
  const localStatus = purchase.local_status || purchase.status;
  const amount = Number(purchase.amount_gross ?? purchase.amount ?? 0);
  const currency = (purchase.currency || 'EUR').toUpperCase();
  const hasAccess = Boolean(purchase.access_unlocked && !purchase.access_revoked);
  const paymentIsFinal = localStatus === 'paid' && Number(purchase.refunded_amount || 0) <= 0 && !purchase.is_disputed;
  const canManuallyGrant = !hasAccess && !['refunded', 'disputed'].includes(localStatus);
  const canRevoke = hasAccess;
  const refundedAmount = Number(purchase.refunded_amount || 0);
  const remainingRefundAmount = Math.max(amount - refundedAmount, 0);
  const canRefund = Boolean(purchase.stripe_payment_intent_id && !purchase.is_disputed && remainingRefundAmount > 0 && ['paid', 'refunded'].includes(localStatus));
  const statusSummary = purchase.access_revoked
    ? 'Accesso revocato'
    : hasAccess && purchase.manual_access_override
      ? 'Accesso concesso manualmente'
      : hasAccess && paymentIsFinal
        ? 'Accesso attivo'
        : hasAccess
          ? 'Accesso attivo da verificare'
          : 'Accesso non attivo';
  const statusExplanation = purchase.access_revoked
    ? 'La cliente non può accedere al corso.'
    : hasAccess && purchase.manual_access_override
      ? 'L’accesso è stato concesso dall’amministrazione e resta attivo finché non viene revocato.'
      : hasAccess && paymentIsFinal
        ? 'Il pagamento e l’accesso al corso sono allineati.'
        : hasAccess
          ? 'Controlla i dati Stripe prima di considerare l’ordine concluso.'
          : 'La cliente non può ancora accedere al corso.';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Link to="/admin/purchases" className="text-sm text-primary-600 hover:text-primary-700">
            Torna agli acquisti
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{purchase.course_title || purchase.course_id}</h1>
          <p className="text-gray-600">{purchase.customer_email || purchase.user_email || 'Email non disponibile'}</p>
        </div>

        <div className="w-full md:w-auto rounded-lg border border-gray-200 bg-white p-4 md:max-w-md">
          <p className="text-sm font-semibold text-gray-900">Prima azione consigliata</p>
          <p className="mt-1 text-sm text-gray-600">Aggiorna i dati da Stripe prima di modificare manualmente l’accesso.</p>
          <Button className="mt-3" variant="secondary" loading={actionLoading === 'resync'} onClick={() => void runAction('resync')}>
            Aggiorna dati da Stripe
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Stato ordine</p>
          <span className={`inline-flex px-3 py-1 mt-2 rounded-full text-sm font-medium ${statusStyles[localStatus] || statusStyles.needs_review}`}>
            {localStatusLabels[localStatus] || localStatus}
          </span>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Stato Stripe</p>
          <p className="text-xl font-semibold text-gray-900 mt-2">{readableStatus(purchase.stripe_status)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Importo</p>
          <p className="text-xl font-semibold text-gray-900 mt-2">
            {currency === 'EUR' ? formatCurrency(amount) : `${amount.toFixed(2)} ${currency}`}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Accesso al corso</p>
          <p className="text-xl font-semibold text-gray-900 mt-2">{statusSummary}</p>
        </div>
      </section>

      <section className={`rounded-lg border p-5 ${paymentIsFinal && hasAccess ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <h2 className="font-semibold text-gray-900">Verifica rapida</h2>
        <p className="mt-1 text-sm text-gray-700">{statusExplanation}</p>
        {!purchase.verified_by_admin ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">Dopo aver controllato pagamento, importo e cliente, registra la verifica.</p>
            <Button variant="primary" loading={actionLoading === 'verify'} onClick={() => void runAction('verify')}>Conferma controllo dati</Button>
          </div>
        ) : <p className="mt-3 text-sm font-medium text-emerald-800">Controllo amministrativo completato.</p>}
      </section>

      <section className="rounded-lg border border-primary-200 bg-primary-50 p-5">
        <h2 className="font-semibold text-gray-900">Vista della cliente</h2>
        <p className="mt-1 text-sm text-gray-700">Questo è lo stato che determina cosa la cliente trova entrando con la sua email, non solo lo stato del pagamento su Stripe.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-500">Account</p>
            <p className="mt-1 font-semibold text-gray-900">{customerView?.account_ready ? 'Pronto per l’accesso' : 'In attivazione'}</p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-500">Corso nel suo catalogo</p>
            <p className="mt-1 font-semibold text-gray-900">{customerView?.course_access_active ? 'Visibile e sbloccato' : customerView?.course_access_reason === 'account_provisioning' ? 'In attesa di attivazione account' : 'Non visibile / non sbloccato'}</p>
          </div>
        </div>
        {customerView?.student_id && (
          <Link to={`/admin/students/${customerView.student_id}`} className="mt-4 inline-block text-sm font-medium text-primary-700 hover:text-primary-800">
            Apri il profilo della cliente e verifica i corsi visibili
          </Link>
        )}
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
              <p className="font-medium text-gray-900">{readableStatus(purchase.webhook_status)}</p>
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
              <p className="font-medium text-gray-900">{purchase.verified_by_admin ? 'Sì' : 'Non ancora'}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-3 text-sm">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-amber-950">Email errata o irraggiungibile?</p>
                  <p className="mt-1 text-amber-800">Correggi l’email dell’acquisto per spostare questo accesso sull’account giusto.</p>
                </div>
                <Button variant="secondary" onClick={openCorrectEmail}>
                  Correggi email
                </Button>
              </div>
            </div>
            <div>
              <p className="text-gray-500">ID sessione Stripe</p>
              <p className="font-mono text-gray-900 break-all">{purchase.stripe_session_id || 'n/d'}</p>
            </div>
            <div>
              <p className="text-gray-500">Intento di pagamento</p>
              <p className="font-mono text-gray-900 break-all">{purchase.stripe_payment_intent_id || 'n/d'}</p>
            </div>
            <div>
              <p className="text-gray-500">ID addebito</p>
              <p className="font-mono text-gray-900 break-all">{purchase.stripe_charge_id || 'n/d'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-xl font-semibold text-gray-900">Rimborsi e accesso</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Stato rimborso</p>
              <p className="font-medium text-gray-900">{readableStatus(purchase.refund_status)}</p>
            </div>
            <div>
              <p className="text-gray-500">Tipo rimborso</p>
              <p className="font-medium text-gray-900">{purchase.refund_type === 'full' ? 'Totale' : purchase.refund_type === 'partial' ? 'Parziale' : 'Non disponibile'}</p>
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
              <p className="font-medium text-gray-900">{purchase.is_disputed ? 'Sì' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-500">Accesso revocato</p>
              <p className="font-medium text-gray-900">{purchase.access_revoked ? 'Sì' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-500">Motivo revoca</p>
              <p className="font-medium text-gray-900">{purchase.access_revocation_reason || 'n/d'}</p>
            </div>
          </div>

          {purchase.coupon_snapshot && (
            <div className="border-t border-gray-200 pt-4 text-sm">
              <p className="text-gray-500 mb-2">Dati coupon al momento dell’acquisto</p>
              <div className="rounded-lg bg-gray-50 p-4 space-y-1">
                <p className="text-gray-900">Codice: {purchase.coupon_snapshot.code || purchase.coupon_code}</p>
                <p className="text-gray-900">Tipo: {purchase.coupon_snapshot.discount_type || 'n/d'}</p>
                <p className="text-gray-900">Valore: {purchase.coupon_snapshot.discount_value ?? 'n/d'}</p>
                <p className="text-gray-900">Accesso gratuito: {purchase.coupon_snapshot.is_free_access ? 'Sì' : 'No'}</p>
              </div>
            </div>
          )}
          {(purchase.email_correction_history?.length ?? 0) > 0 && (
            <div className="border-t border-gray-200 pt-4 text-sm">
              <p className="text-gray-500 mb-2">Correzioni email</p>
              <div className="space-y-2">
                {purchase.email_correction_history?.map((correction) => (
                  <div key={`${correction.corrected_at}-${correction.to_email}`} className="rounded-lg bg-gray-50 p-3">
                    <p className="font-medium text-gray-900 break-all">{correction.from_email || '—'} → {correction.to_email}</p>
                    <p className="mt-1 text-gray-600">{formatDateTime(correction.corrected_at)} · {correction.corrected_by}</p>
                    {correction.reason && <p className="mt-1 text-gray-600">Nota: {correction.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-900">Gestione manuale</h2>
        <p className="mt-1 text-sm text-gray-600">Usa queste azioni solo per gestire un’eccezione già verificata.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {canManuallyGrant && <Button variant="primary" loading={actionLoading === 'unlock'} onClick={() => void runAction('unlock')}>{purchase.access_revoked ? 'Ripristina accesso al corso' : 'Concedi accesso manuale'}</Button>}
          {canRevoke && <Button variant="danger" loading={actionLoading === 'revoke'} onClick={() => void runAction('revoke')}>Revoca accesso al corso</Button>}
          {canRefund && <Button variant="danger" loading={actionLoading === 'refund'} onClick={() => openRefund(remainingRefundAmount)}>Emetti rimborso</Button>}
          {purchase.is_stripe_test_purchase && <Button variant="danger" loading={actionLoading === 'delete-test'} onClick={() => void runAction('delete-test')}>Elimina ordine di test</Button>}
        </div>
        {!canManuallyGrant && !canRevoke && !purchase.is_stripe_test_purchase && <p className="mt-4 text-sm text-gray-500">Nessuna modifica manuale disponibile per questo ordine.</p>}
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

      <Modal
        isOpen={isRefundOpen}
        onClose={() => setIsRefundOpen(false)}
        title="Emetti rimborso"
        size="md"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Azione con effetto sul pagamento</p>
            <p className="mt-1">Il rimborso viene inviato subito a Stripe. L’accesso al corso verrà revocato quando il rimborso viene registrato.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p>Importo originario: <span className="font-semibold">{currency === 'EUR' ? formatCurrency(amount) : `${amount.toFixed(2)} ${currency}`}</span></p>
            {refundedAmount > 0 && <p className="mt-1">Già rimborsato: <span className="font-semibold">{currency === 'EUR' ? formatCurrency(refundedAmount) : `${refundedAmount.toFixed(2)} ${currency}`}</span></p>}
            <p className="mt-1">Massimo rimborsabile: <span className="font-semibold">{currency === 'EUR' ? formatCurrency(remainingRefundAmount) : `${remainingRefundAmount.toFixed(2)} ${currency}`}</span></p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Importo da rimborsare</span>
            <input type="number" min="0.01" max={remainingRefundAmount} step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <span className="mt-1 block text-xs text-gray-500">Lascia l’importo massimo per un rimborso totale; inserisci un valore inferiore per un rimborso parziale.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Nota interna <span className="font-normal text-gray-500">(facoltativa)</span></span>
            <textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} rows={2} placeholder="Es. rimborso concordato con la cliente" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </label>
          <label className="flex gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
            <input type="checkbox" checked={refundConfirmed} onChange={(event) => setRefundConfirmed(event.target.checked)} className="mt-0.5" />
            <span>Confermo di aver verificato ordine, importo e richiesta della cliente.</span>
          </label>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setIsRefundOpen(false)}>Annulla</Button><Button variant="danger" loading={actionLoading === 'refund'} disabled={!refundConfirmed || !refundAmount || Number(refundAmount) <= 0 || Number(refundAmount) > remainingRefundAmount} onClick={() => void refundPurchase()}>Conferma rimborso</Button></div>
        </div>
      </Modal>

      <Modal
        isOpen={isCorrectEmailOpen}
        onClose={() => setIsCorrectEmailOpen(false)}
        title="Correggi email acquisto"
        size="md"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Prima di confermare</p>
            <p className="mt-1">Verifica che la richiesta provenga davvero dalla persona che ha effettuato l’acquisto. Il pagamento non viene modificato né rimborsato.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Email attualmente associata</p>
            <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 break-all">{purchase.customer_email || purchase.user_email || 'Non disponibile'}</p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Nuova email di accesso</span>
            <input
              type="email"
              value={correctedEmail}
              onChange={(event) => setCorrectedEmail(event.target.value)}
              placeholder="nome@esempio.it"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <span className="mt-1 block text-xs text-gray-500">Se l’account non esiste, verrà creato e le credenziali verranno inviate a questo indirizzo. Se esiste già, l’accesso viene associato a quell’account senza modificarne la password.</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Nota interna <span className="font-normal text-gray-500">(facoltativa)</span></span>
            <textarea
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              rows={2}
              placeholder="Es. refuso confermato dalla cliente"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <label className="flex gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
            <input type="checkbox" checked={emailConfirmed} onChange={(event) => setEmailConfirmed(event.target.checked)} className="mt-0.5" />
            <span>Ho verificato l’identità della cliente e l’indirizzo email corretto.</span>
          </label>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsCorrectEmailOpen(false)}>Annulla</Button>
            <Button
              variant="primary"
              loading={actionLoading === 'correct-email'}
              disabled={!emailConfirmed || !correctedEmail.trim()}
              onClick={() => void correctEmail()}
            >
              Conferma correzione
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
