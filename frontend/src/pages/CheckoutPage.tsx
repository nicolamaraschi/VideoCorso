import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Award, CheckCircle, Shield, Video } from 'lucide-react';
import { useAuthContext } from '../components/auth/useAuthContext';
import { paymentService } from '../services/paymentService';
import { courseService } from '../services/courseService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import type { CourseListItem } from '../types';
import { getErrorMessage } from '../utils/errors';

const guaranteeImageUrl = 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/ceYe4VnMXLjh1ENSEbH0/media/6514585ac9753e719aa60206.png';

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

  const courseId = searchParams.get('courseId');

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

      const selectedRef = selectedCourse?.public_slug || selectedCourse?.course_id;
      if (selectedCourse && selectedRef !== courseId) {
        setSearchParams({ courseId: selectedRef }, { replace: true });
      }

      if (!selectedCourse) {
        setError('Nessun corso disponibile per il checkout.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load checkout course.'));
    } finally {
      setLoading(false);
    }
  }, [courseId, setSearchParams]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const handleCheckout = async () => {
    if (!course) {
      return;
    }

    const checkoutEmail = user?.email || emailInput.trim();
    if (!checkoutEmail) {
      setError('Per favore inserisci il tuo indirizzo email per procedere.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const checkoutResponse = await paymentService.createCheckoutSession({
        course_id: course.course_id,
        success_url: `${window.location.origin}/login?payment=success`,
        cancel_url: `${window.location.origin}/checkout?courseId=${course.public_slug || course.course_id}&payment=cancelled`,
        email: checkoutEmail,
        coupon_code: couponCode.trim() || undefined,
      });

      if (checkoutResponse.is_free_access) {
        navigate(`/courses/${course.public_slug || course.course_id}?payment=success&purchaseId=${checkoutResponse.purchase_id || ''}`);
        return;
      }

      window.location.href = checkoutResponse.checkout_url;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create checkout session.'));
      setSubmitting(false);
    }
  };

  const selectedCourseIndex = useMemo(
    () => catalog.findIndex((item) => item.course_id === course?.course_id),
    [catalog, course]
  );

  const handleSelectCourse = (nextCourse: CourseListItem) => {
    setCourse(nextCourse);
    setSearchParams({ courseId: nextCourse.public_slug || nextCourse.course_id });
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

  const benefits = [
    { icon: Video, text: 'Accesso lifetime al corso selezionato' },
    { icon: Award, text: 'Contenuti premium disponibili subito dopo il pagamento' },
    { icon: CheckCircle, text: 'Progress tracking e ripresa automatica delle lezioni' },
  ];

  return (
    <div className="min-h-screen bg-primary-50/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <section className="bg-white rounded-2xl shadow-soft p-8 border border-primary-100">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-2">Scegli la tua Masterclass</h1>
              <p className="text-gray-500">
                Seleziona il percorso formativo più adatto alle tue esigenze.
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {catalog.length} {catalog.length === 1 ? 'corso disponibile' : 'corsi disponibili'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

                  <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-3">{item.short_description || item.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      {item.discounted_price && Number(item.discounted_price) < Number(item.price) && (
                        <span className="block text-sm text-gray-400 line-through">€ {Number(item.price).toFixed(2)}</span>
                      )}
                      <span className="text-2xl font-bold text-gray-900">
                        € {Number(item.discounted_price ?? item.price).toFixed(2)}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary-700' : 'text-gray-500'}`}>
                      {selectedCourseIndex === index ? 'Pronto al checkout' : 'Seleziona'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="bg-white rounded-2xl shadow-soft p-8 border border-primary-100">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">
            Riepilogo Ordine
          </h2>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800">{course.title}</h3>
            <p className="text-gray-600">{course.short_description || course.description}</p>
          </div>

          <ul className="space-y-4 mb-8">
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

          <div className="mt-8 p-6 bg-primary-50/50 rounded-xl border border-primary-100">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-primary-600" />
              <h4 className="font-semibold text-gray-900">Garanzia 14 Giorni</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Il tuo acquisto è protetto. Se il corso non rispetta le tue aspettative, puoi richiedere assistenza o un rimborso completo entro 14 giorni.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-8 border border-primary-100 h-fit">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Pagamento Sicuro</h2>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-gray-600">
              <span>Corso selezionato</span>
              <span>{course.title}</span>
            </div>
            
            {!user && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo Email *</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
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
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Inserisci coupon se disponibile"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
              />
            </div>
            <div className="flex justify-between text-2xl font-bold text-gray-900 pt-3 border-t">
              <span>Totale</span>
              <span>€ {Number(course.discounted_price ?? course.price).toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="my-4">
              <ErrorMessage 
                title="Errore pagamento" 
                message={error.includes('500') ? 'Il servizio di pagamento è momentaneamente non disponibile a causa di un problema tecnico. Ti preghiamo di riprovare più tardi.' : error} 
                onRetry={handleCheckout} 
              />
            </div>
          )}

          {submitting ? (
            <Loading text="Stiamo reindirizzando al pagamento sicuro..." />
          ) : (
            <>
              <Button onClick={handleCheckout} variant="primary" fullWidth size="lg" className="transform hover:scale-105">
                {Number(course.discounted_price ?? course.price) === 0 && !couponCode 
                  ? 'Accedi Gratis' 
                  : `Paga € ${Number(course.discounted_price ?? course.price).toFixed(2)}`}
              </Button>
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
