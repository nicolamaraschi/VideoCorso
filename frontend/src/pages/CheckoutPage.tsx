import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Award, Check, CheckCircle, RefreshCw, Shield, Sparkles, Video } from 'lucide-react';
import { useAuthContext } from '../components/auth/useAuthContext';
import { paymentService } from '../services/paymentService';
import { courseService } from '../services/courseService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import type { CourseListItem, CoursePackage, PaymentVerification, ShippingAddress } from '../types';
import { getErrorMessage } from '../utils/errors';

const emptyShippingAddress: ShippingAddress = {
  full_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postal_code: '',
  province: '',
  country: '',
  phone: '',
};

// This identifier is persisted with the order.  Update it only when the
// published terms/policy change, so a dispute can always be tied to the text
// accepted at the time of purchase.
const TERMS_VERSION = '2026-08-10';

export const CheckoutPage: React.FC = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<CourseListItem[]>([]);
  const [course, setCourse] = useState<CourseListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<CoursePackage | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(emptyShippingAddress);
  const [couponQuote, setCouponQuote] = useState<{ final_total: number; is_free_access: boolean } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [paymentVerification, setPaymentVerification] = useState<PaymentVerification | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentVerificationError, setPaymentVerificationError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [digitalContentConsent, setDigitalContentConsent] = useState(false);
  const checkoutRequestId = useRef('');

  const courseId = searchParams.get('courseId');
  const paymentReturn = searchParams.get('payment');
  const returnedSessionId = searchParams.get('session_id');

  const loadCourse = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const availableCourses = (await courseService.getCatalog()).filter((item) => item.is_purchasable !== false);
      setCatalog(availableCourses);

      const selectedCourse = availableCourses.find(
        (item) => item.course_id === courseId || item.public_slug === courseId
      ) || availableCourses[0] || null;
      setCourse(selectedCourse);
      setSelectedPackage(
        selectedCourse?.packages && selectedCourse.packages.length > 0
          ? selectedCourse.packages[0]
          : null
      );

      const selectedRef = selectedCourse?.public_slug || selectedCourse?.course_id;
      if (selectedCourse && selectedRef !== courseId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('courseId', selectedRef);
        setSearchParams(nextParams, { replace: true });
      }

      if (!selectedCourse) {
        setError('Nessun corso disponibile per il checkout.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load checkout course.'));
    } finally {
      setLoading(false);
    }
  }, [courseId, searchParams, setSearchParams]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  useEffect(() => {
    if (user?.email && !emailInput) {
      setEmailInput(user.email);
    }
  }, [user?.email, emailInput]);

  const verifyReturnedPayment = useCallback(async () => {
    if (paymentReturn !== 'success') return;
    if (!returnedSessionId) {
      setPaymentVerification(null);
      setPaymentVerificationError('Manca l’identificativo del pagamento: non possiamo confermare l’esito in sicurezza. Non effettuare un secondo pagamento; contatta l’assistenza.');
      return;
    }
    try {
      setCheckingPayment(true);
      setPaymentVerificationError(null);
      const response = await paymentService.verifyPayment(returnedSessionId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Non è stato possibile verificare il pagamento.');
      }
      setPaymentVerification(response.data);
    } catch (err) {
      setPaymentVerification(null);
      setPaymentVerificationError(getErrorMessage(err, 'Non è stato possibile verificare il pagamento.'));
    } finally {
      setCheckingPayment(false);
    }
  }, [paymentReturn, returnedSessionId]);

  useEffect(() => {
    void verifyReturnedPayment();
  }, [verifyReturnedPayment]);

  const handleCheckout = async () => {
    if (!course) {
      return;
    }
    if (hasPackages && !selectedPackage) {
      setError('Seleziona uno dei pacchetti disponibili per procedere.');
      return;
    }

    const checkoutEmail = user?.email || emailInput.trim();
    if (!checkoutEmail) {
      setError('Per favore inserisci il tuo indirizzo email per procedere.');
      return;
    }
    if (couponCode.trim() && !couponQuote) {
      setCouponMessage('Applica il coupon per verificare lo sconto prima di procedere.');
      return;
    }
    if (requiresShippingAddress) {
      const requiredFields: Array<keyof ShippingAddress> = ['full_name', 'address_line1', 'city', 'postal_code', 'country'];
      const missing = requiredFields.filter((field) => !shippingAddress[field]?.trim());
      if (missing.length > 0) {
        setError('Il pacchetto selezionato include un kit fisico: compila l’indirizzo di spedizione completo per procedere.');
        return;
      }
    }
    if (!termsAccepted || !digitalContentConsent) {
      setError('Per procedere devi accettare le condizioni di vendita e confermare l’accesso immediato al contenuto digitale.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const checkoutResponse = await paymentService.createCheckoutSession({
        checkout_request_id: checkoutRequestId.current || (checkoutRequestId.current = crypto.randomUUID()),
        course_id: course.course_id,
        success_url: `${window.location.origin}/checkout?courseId=${course.public_slug || course.course_id}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/checkout?courseId=${course.public_slug || course.course_id}&payment=cancelled`,
        email: checkoutEmail,
        coupon_code: couponCode.trim() || undefined,
        package_id: selectedPackage?.package_id,
        shipping_address: requiresShippingAddress ? shippingAddress : undefined,
        terms_accepted: termsAccepted,
        digital_content_consent: digitalContentConsent,
        terms_version: TERMS_VERSION,
      });

      if (checkoutResponse.is_free_access) {
        navigate('/login?payment=free');
        return;
      }

      window.location.href = checkoutResponse.checkout_url;
    } catch (err) {
      setError(getErrorMessage(err, 'Il servizio di pagamento è momentaneamente non disponibile a causa di un problema tecnico. Ti preghiamo di riprovare più tardi.'));
      setSubmitting(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!course || !couponCode.trim()) {
      setCouponQuote(null);
      setCouponMessage('Inserisci un codice coupon.');
      return;
    }
    const checkoutEmail = user?.email || emailInput.trim();
    if (!checkoutEmail) {
      setCouponMessage('Inserisci prima l’email: alcuni coupon sono riservati a specifici clienti.');
      return;
    }
    try {
      setCheckingCoupon(true);
      setCouponMessage(null);
      const quote = await paymentService.quoteCheckout({
        course_id: course.course_id,
        email: checkoutEmail,
        coupon_code: couponCode.trim(),
        package_id: selectedPackage?.package_id,
      });
      setCouponQuote({ final_total: quote.final_total, is_free_access: quote.is_free_access });
      setCouponMessage(quote.is_free_access ? 'Coupon applicato: accesso gratuito.' : 'Coupon applicato correttamente.');
    } catch (err) {
      setCouponQuote(null);
      setCouponMessage(getErrorMessage(err, 'Coupon non valido o non utilizzabile per questo acquisto.'));
    } finally {
      setCheckingCoupon(false);
    }
  };

  const hasPackages = !!(course?.packages && course.packages.length > 0);
  const baseTotal = hasPackages
    ? Number(selectedPackage?.discounted_price ?? selectedPackage?.price ?? 0)
    : Number(course?.discounted_price ?? course?.price ?? 0);
  const requiresShippingAddress = false;

  const handleSelectCourse = (nextCourse: CourseListItem) => {
    setCourse(nextCourse);
    setSelectedPackage(nextCourse.packages && nextCourse.packages.length > 0 ? nextCourse.packages[0] : null);
    setShippingAddress(emptyShippingAddress);
    setCouponQuote(null);
    setCouponMessage(null);
    checkoutRequestId.current = '';
    setSearchParams({ courseId: nextCourse.public_slug || nextCourse.course_id });
  };

  const handleSelectPackage = (pkg: CoursePackage) => {
    setSelectedPackage(pkg);
    setCouponQuote(null);
    setCouponMessage(null);
    checkoutRequestId.current = '';
  };

  if (loading) {
    return <Loading fullScreen text="Loading checkout..." />;
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <ErrorMessage variant="card" title="Checkout non disponibile" message={error || 'Corso non trovato'} onRetry={loadCourse} />
      </div>
    );
  }

  const clearPaymentReturn = () => {
    setPaymentVerification(null);
    setPaymentVerificationError(null);
    setSearchParams({ courseId: course.public_slug || course.course_id });
  };

  // A Stripe return is a terminal state of this checkout attempt.  Keeping a
  // payment button on this screen would invite duplicate charges while a
  // webhook/account provisioning is still being reconciled.
  if (paymentReturn === 'success') {
    const title = paymentVerification?.course_title || course.title;
    const isPaid = paymentVerification?.payment_state === 'paid';
    const isExpired = paymentVerification?.payment_state === 'expired';

    return (
      <div className="min-h-screen bg-primary-50/30 py-12 px-4 sm:px-6 lg:px-8">
        <section className="max-w-2xl mx-auto rounded-2xl border border-primary-100 bg-white p-5 text-center shadow-soft sm:p-8">
          {checkingPayment && <Loading text="Stiamo verificando il pagamento con Stripe..." />}
          {!checkingPayment && paymentVerificationError && (
            <>
              <AlertCircle className="w-12 h-12 mx-auto text-amber-600" />
              <h1 className="mt-4 text-2xl font-serif font-bold text-gray-900">Stiamo verificando il pagamento</h1>
              <p className="mt-3 text-gray-600">Non effettuare un secondo pagamento: non siamo ancora riusciti a leggere l’esito sicuro da Stripe. Aggiorna lo stato o contatta l’assistenza indicando l’email usata per l’acquisto.</p>
              <Button className="mt-6" variant="secondary" onClick={() => void verifyReturnedPayment()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna stato
              </Button>
            </>
          )}
          {!checkingPayment && !paymentVerificationError && paymentVerification && isPaid && (
            <div className="text-left sm:text-center">
              <div className="flex justify-center mb-2">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-serif font-bold text-gray-900">
                Pagamento Confermato 🎉
              </h1>
              <p className="mt-2 text-gray-600 text-base">
                Grazie per il tuo acquisto! Il tuo ordine per <strong>{title}</strong> è andato a buon fine.
              </p>

              <div className="my-6 rounded-2xl bg-primary-50/70 border border-primary-100 p-5 text-left text-sm text-gray-800 space-y-3">
                <h3 className="font-semibold text-primary-950 flex items-center gap-2">
                  <span>📬</span> Come accedere subito al tuo corso:
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>
                    Controlla la tua casella email (anche nella cartella <em>Spam / Promozioni</em>).
                  </li>
                  <li>
                    Troverai un'email con la tua <strong>password temporanea</strong> di primo accesso.
                  </li>
                  <li>
                    Clicca su <strong>Vai al Login</strong> qui sotto, inserisci la tua email e la password temporanea ricevuta.
                  </li>
                  <li>
                    Al primo accesso ti verrà chiesto di impostare la tua <strong>nuova password personale e definitiva</strong>.
                  </li>
                </ol>
                <div className="pt-2 border-t border-primary-200/60 text-xs text-primary-800 italic">
                  💡 Fatto questo, sarai subito dentro la tua area riservata con tutti i moduli e video sbloccati.
                </div>
              </div>

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button className="w-full sm:w-auto px-8 py-3.5 shadow-md" variant="primary" onClick={() => navigate('/login')}>
                  Vai al Login e Accedi al Corso
                </Button>
              </div>
            </div>
          )}
          {!checkingPayment && !paymentVerificationError && paymentVerification && !isPaid && (
            <>
              <AlertCircle className="w-12 h-12 mx-auto text-amber-600" />
              <h1 className="mt-4 text-2xl font-serif font-bold text-gray-900">{isExpired ? 'Pagamento annullato' : 'Pagamento non ancora completato'}</h1>
              <p className="mt-3 text-gray-600">Stripe non segnala un pagamento completato per <strong>{title}</strong>. Nessun accesso è stato attivato.</p>
              <Button className="mt-6" variant="primary" onClick={clearPaymentReturn}>Torna al pagamento</Button>
            </>
          )}
        </section>
      </div>
    );
  }

  const benefits = [
    { icon: Video, text: 'Accesso lifetime al corso selezionato' },
    { icon: Award, text: 'Contenuti premium disponibili subito dopo il pagamento' },
    { icon: CheckCircle, text: 'Progress tracking e ripresa automatica delle lezioni' },
  ];

  return (
    <div className="min-h-screen bg-primary-50/30 px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {paymentReturn === 'cancelled' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
            Il pagamento è stato annullato: Stripe non ha confermato alcun acquisto. Puoi riprovare quando vuoi.
          </div>
        )}
        {/* 1. Header & Course / Package Selection */}
        {hasPackages && (
          <section className="rounded-3xl border border-primary-100 bg-white p-5 sm:p-8 shadow-sm">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200/80 text-primary-800 text-xs font-semibold tracking-wide uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                <span>{course.title}</span>
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-gray-900 leading-tight">
                Scegli il tuo pacchetto
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-500 font-light">
                Tutti i pacchetti danno accesso allo stesso corso completo con 10 moduli e 54 video-lezioni: cambiano i servizi di tutoraggio e la pratica in presenza.
              </p>
            </div>

            {/* 3-Column Perfectly Symmetrical Grid on Tablet/iPad & Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
              {course.packages!.map((pkg) => {
                const isSelected = selectedPackage?.package_id === pkg.package_id;
                const pkgPrice = Number(pkg.discounted_price ?? pkg.price);
                const hasDiscount = pkg.discounted_price && Number(pkg.discounted_price) < Number(pkg.price);
                const isPlus = pkg.name.toLowerCase().includes('plus') || pkg.name.toLowerCase().includes('intermedio');
                const isBase = pkg.name.toLowerCase().includes('base');

                return (
                  <div
                    key={pkg.package_id}
                    onClick={() => handleSelectPackage(pkg)}
                    className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 sm:p-6 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-primary-600 bg-gradient-to-b from-primary-50/60 via-white to-primary-50/20 shadow-xl ring-2 ring-primary-500/20'
                        : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-md'
                    }`}
                  >
                    {/* Top Tier Structure */}
                    <div className="flex flex-col flex-1">
                      
                      {/* 1. Badge Row (Uniform Height across all cards) */}
                      <div className="h-7 mb-3 flex items-center justify-between">
                        {isBase && (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold uppercase tracking-wider">
                            Autonomia
                          </span>
                        )}
                        {isPlus && (
                          <span className="inline-flex px-3 py-1 rounded-full bg-primary-950 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
                            ★ Più Richiesto
                          </span>
                        )}
                        {!isBase && !isPlus && hasDiscount && (
                          <span className="inline-flex px-3 py-1 rounded-full bg-amber-400 text-gray-950 text-[11px] font-extrabold uppercase tracking-wider shadow-sm">
                            💎 Lancio -500€
                          </span>
                        )}
                        
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wider ml-auto">
                            Attivo
                          </span>
                        )}
                      </div>

                      {/* 2. Package Title */}
                      <h2 className="text-2xl font-serif font-bold text-gray-900 leading-tight mb-3">
                        {pkg.name}
                      </h2>

                      {/* 3. Normalized Price Box (Identical Height & Baseline on all 3 cards) */}
                      <div className="mb-5 p-4 rounded-xl bg-gray-50/90 border border-gray-100 min-h-[108px] flex flex-col justify-center">
                        {hasDiscount ? (
                          <span className="block text-xs font-semibold text-gray-400 line-through leading-tight">
                            € {Number(pkg.price).toFixed(2)}
                          </span>
                        ) : (
                          <span className="block text-xs text-transparent select-none leading-tight" aria-hidden="true">
                            € 0.00
                          </span>
                        )}
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-3xl font-serif font-bold text-gray-900 leading-none">
                            € {pkgPrice.toFixed(2)}
                          </span>
                        </div>
                        <span className="block text-[11px] text-gray-500 mt-1.5 leading-tight">
                          + IVA • rateizzabile con Klarna/Scalapay
                        </span>
                      </div>

                      {/* 4. Benefits Checklist (Aligned across all cards) */}
                      <div className="space-y-2.5 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-800">
                          Cosa include:
                        </p>
                        <ul className="space-y-2 text-xs sm:text-sm text-gray-700">
                          {pkg.benefits.map((benefit, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* 5. Symmetrical Bottom Action Button */}
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      {isSelected ? (
                        <div className="w-full h-11 rounded-xl bg-primary-950 text-white text-center text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Pacchetto Selezionato</span>
                        </div>
                      ) : (
                        <div className="w-full h-11 rounded-xl bg-gray-100 text-gray-700 text-center text-xs sm:text-sm font-semibold hover:bg-primary-100 hover:text-primary-900 transition-colors flex items-center justify-center">
                          Seleziona questo piano
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Multi-course catalog switcher (if more than 1 course available) */}
        {!hasPackages && catalog.length > 1 && (
          <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-soft sm:p-8">
            <h2 className="mb-4 text-2xl font-serif font-bold text-gray-900">Scegli la tua Masterclass</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {catalog.map((item, index) => {
                const isSelected = item.course_id === course?.course_id;
                return (
                  <button
                    key={item.course_id}
                    type="button"
                    onClick={() => handleSelectCourse(item)}
                    className={`text-left rounded-xl border p-5 transition-all ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50 shadow-md ring-1 ring-primary-400'
                        : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Corso {index + 1}
                      </span>
                      {isSelected && (
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-primary-600 text-white text-xs font-medium">
                          Selezionato
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">{item.short_description || item.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-12">
        <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-soft sm:p-8">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">
            Riepilogo Ordine
          </h2>

          {selectedPackage ? (
            <div className="mb-6 rounded-2xl bg-primary-50/70 border-2 border-primary-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex px-3 py-1 rounded-full bg-primary-950 text-white text-xs font-bold uppercase tracking-wider">
                  Piano Selezionato
                </span>
                {selectedPackage.discounted_price && Number(selectedPackage.discounted_price) < Number(selectedPackage.price) && (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 text-xs font-extrabold uppercase tracking-wide">
                    Offerta Lancio -500€
                  </span>
                )}
              </div>
              <h3 className="text-xl font-serif font-bold text-gray-900">
                {selectedPackage.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedPackage.description || course.title}
              </p>

              <div className="mt-4 pt-4 border-t border-primary-200/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-900 mb-3">
                  Cosa include il tuo piano:
                </h4>
                <ul className="space-y-2.5 text-sm text-gray-800">
                  {selectedPackage.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{benefit}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2.5 text-primary-900 font-medium">
                    <Video className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                    <span>Accesso illimitato e a vita ai 10 moduli on demand</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800">{course.title}</h3>
              <p className="text-gray-600">{course.short_description || course.description}</p>
              <ul className="space-y-4 my-6">
                {benefits.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-primary-600 flex-shrink-0" />
                      <span className="text-gray-700">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {requiresShippingAddress && (
            <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
              <h4 className="mb-4 font-semibold text-gray-900">Indirizzo di spedizione del kit</h4>
              <p className="mb-4 text-sm text-gray-600">
                Il pacchetto selezionato include un kit fisico: indicaci dove spedirlo.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="shipping-full-name" className="sr-only">Nome e cognome</label>
                  <input
                    id="shipping-full-name"
                    type="text"
                    value={shippingAddress.full_name}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Nome e cognome *"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="shipping-address-line1" className="sr-only">Indirizzo (via, numero)</label>
                  <input
                    id="shipping-address-line1"
                    type="text"
                    value={shippingAddress.address_line1}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, address_line1: e.target.value }))}
                    placeholder="Indirizzo (via, numero) *"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="shipping-address-line2" className="sr-only">Indirizzo riga 2 (opzionale)</label>
                  <input
                    id="shipping-address-line2"
                    type="text"
                    value={shippingAddress.address_line2 || ''}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, address_line2: e.target.value }))}
                    placeholder="Indirizzo riga 2 (opzionale)"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="shipping-city" className="sr-only">Città</label>
                  <input
                    id="shipping-city"
                    type="text"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Città *"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="shipping-postal-code" className="sr-only">CAP</label>
                  <input
                    id="shipping-postal-code"
                    type="text"
                    value={shippingAddress.postal_code}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, postal_code: e.target.value }))}
                    placeholder="CAP *"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="shipping-province" className="sr-only">Provincia</label>
                  <input
                    id="shipping-province"
                    type="text"
                    value={shippingAddress.province || ''}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, province: e.target.value }))}
                    placeholder="Provincia"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="shipping-country" className="sr-only">Nazione</label>
                  <input
                    id="shipping-country"
                    type="text"
                    value={shippingAddress.country}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="Nazione *"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="shipping-phone" className="sr-only">Telefono (opzionale)</label>
                  <input
                    id="shipping-phone"
                    type="tel"
                    value={shippingAddress.phone || ''}
                    onChange={(e) => setShippingAddress((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Telefono (opzionale)"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-primary-100 bg-primary-50/50 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-primary-600" />
              <h4 className="font-semibold text-gray-900">Garanzia 14 Giorni</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Il tuo acquisto è protetto. Se il corso non rispetta le tue aspettative, puoi richiedere assistenza o un rimborso completo entro 14 giorni.
            </p>
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-primary-100 bg-white p-5 shadow-soft sm:p-8">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Pagamento Sicuro</h2>

          <div className="space-y-4 mb-6">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2.5 text-sm">
              <div className="flex justify-between items-center text-gray-600">
                <span>Corso:</span>
                <span className="font-semibold text-gray-900 text-right">{course.title}</span>
              </div>
              {selectedPackage && (
                <div className="flex justify-between items-center text-gray-600 pt-2 border-t border-gray-200/60">
                  <span>Pacchetto:</span>
                  <span className="font-bold text-primary-950 bg-primary-100/70 px-2.5 py-0.5 rounded-md text-right">
                    {selectedPackage.name}
                  </span>
                </div>
              )}
              {selectedPackage && selectedPackage.discounted_price && Number(selectedPackage.discounted_price) < Number(selectedPackage.price) && (
                <div className="flex justify-between items-center text-gray-500 pt-1">
                  <span>Prezzo di listino:</span>
                  <span className="line-through">€ {Number(selectedPackage.price).toFixed(2)}</span>
                </div>
              )}
              {selectedPackage && selectedPackage.discounted_price && Number(selectedPackage.discounted_price) < Number(selectedPackage.price) && (
                <div className="flex justify-between items-center text-emerald-700 font-medium">
                  <span>Sconto Lancio:</span>
                  <span>- € {(Number(selectedPackage.price) - Number(selectedPackage.discounted_price)).toFixed(2)}</span>
                </div>
              )}
            </div>
            
            {!user && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo Email *</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setCouponQuote(null);
                    checkoutRequestId.current = '';
                  }}
                  placeholder="tua@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coupon o codice promo</label>
              <input
                type="text"
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value.toUpperCase());
                  setCouponQuote(null);
                  setCouponMessage(null);
                  checkoutRequestId.current = '';
                }}
                placeholder="Inserisci coupon se disponibile"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
              />
              <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button className="w-full sm:w-auto" type="button" size="sm" variant="secondary" loading={checkingCoupon} onClick={handleApplyCoupon}>
                  Applica coupon
                </Button>
                {couponMessage && (
                  <span className={`text-sm ${couponQuote ? 'text-emerald-700' : 'text-red-600'}`}>{couponMessage}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-baseline text-2xl font-bold text-gray-900 pt-3 border-t">
              <div>
                <span>Totale</span>
                {selectedPackage && (
                  <span className="block text-xs font-normal text-gray-500">+ IVA inclusa ove applicabile</span>
                )}
              </div>
              <div className="text-right">
                {couponQuote && checkoutTotal < baseTotal && (
                  <span className="mr-2 text-base font-normal text-gray-400 line-through">€ {baseTotal.toFixed(2)}</span>
                )}
                <span className="text-primary-950 font-serif font-bold text-3xl">€ {checkoutTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="my-4">
              <ErrorMessage 
                title="Errore pagamento" 
                message={error} 
                onRetry={handleCheckout} 
              />
            </div>
          )}

          {submitting ? (
            <Loading text="Stiamo reindirizzando al pagamento sicuro..." />
          ) : (
            <>
              <Button onClick={handleCheckout} variant="primary" fullWidth size="lg" className="transform hover:scale-[1.02] shadow-lg py-4 text-base font-semibold">
                {checkoutTotal === 0
                  ? 'Accedi Gratis' 
                  : selectedPackage
                    ? `Paga € ${checkoutTotal.toFixed(2)} • ${selectedPackage.name}`
                    : `Paga € ${checkoutTotal.toFixed(2)}`}
              </Button>
              <div className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm text-gray-700">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    Ho letto e accetto i termini di vendita e la politica rimborsi (versione {TERMS_VERSION}).
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={digitalContentConsent}
                    onChange={(event) => setDigitalContentConsent(event.target.checked)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    Chiedo l’accesso immediato al contenuto digitale e riconosco le conseguenze sul diritto di recesso previste dalla legge.
                  </span>
                </label>
              </div>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Pagamento sicuro gestito da Stripe</span>
              </div>
              <div className="mt-4 text-center">
                <Link to={`/courses/${course.public_slug || course.course_id}`} className="text-sm text-primary-600 hover:text-primary-700">
                  Torna ai dettagli del corso
                </Link>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
