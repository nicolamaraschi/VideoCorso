import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, TicketPercent } from 'lucide-react';
import { adminService } from '../services/adminService';
import type { Coupon, CouponRequest, Course } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../utils/errors';

const emptyCouponForm: CouponRequest = {
  code: '',
  course_scope: [],
  discount_type: 'percent',
  discount_value: 10,
  starts_at: null,
  expires_at: null,
  max_redemptions: null,
  allowed_user_emails: [],
  is_active: true,
  is_free_access: false,
};

const toDatetimeInput = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const AdminCouponsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState<CouponRequest>(emptyCouponForm);
  const [saving, setSaving] = useState(false);
  const [testForm, setTestForm] = useState({ code: '', course_id: '', email: '' });
  const [testResult, setTestResult] = useState<{ valid: boolean; reason: string; final_total?: number } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [couponItems, courseItems] = await Promise.all([
        adminService.getCoupons(),
        adminService.getCourses(),
      ]);
      setCoupons(couponItems);
      setCourses(courseItems);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load coupons'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const courseOptions = useMemo(
    () => courses.map((course) => ({ value: course.course_id, label: course.title })),
    [courses]
  );

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCouponForm(emptyCouponForm);
    setShowModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      course_scope: coupon.course_scope,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      starts_at: coupon.starts_at || null,
      expires_at: coupon.expires_at || null,
      max_redemptions: coupon.max_redemptions ?? null,
      allowed_user_emails: coupon.allowed_user_emails,
      is_active: coupon.is_active,
      is_free_access: coupon.is_free_access,
    });
    setShowModal(true);
  };

  const toggleCourseScope = (courseId: string) => {
    setCouponForm((prev) => ({
      ...prev,
      course_scope: prev.course_scope.includes(courseId)
        ? prev.course_scope.filter((item) => item !== courseId)
        : [...prev.course_scope, courseId],
    }));
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code.trim()) {
      alert('Il codice coupon è obbligatorio.');
      return;
    }

    try {
      setSaving(true);
      const payload: CouponRequest = {
        ...couponForm,
        code: couponForm.code.trim().toUpperCase(),
        allowed_user_emails: couponForm.allowed_user_emails.filter(Boolean),
      };

      if (editingCoupon) {
        await adminService.updateCoupon(editingCoupon.coupon_id, payload);
      } else {
        await adminService.createCoupon(payload);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to save coupon'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestCoupon = async () => {
    if (!testForm.code.trim()) {
      alert('Inserisci un coupon da testare.');
      return;
    }

    try {
      setTesting(true);
      const result = await adminService.testCoupon({
        code: testForm.code.trim(),
        course_id: testForm.course_id || undefined,
        email: testForm.email || undefined,
      });
      setTestResult(result);
    } catch (err) {
      alert(getErrorMessage(err, 'Coupon test failed'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <Loading fullScreen text="Loading coupons..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Coupon</h1>
          <p className="text-gray-600">Codici promo course-scoped con validazione, scadenza, limiti uso e free access.</p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo coupon
        </Button>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test rapido coupon</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Codice coupon"
            value={testForm.code}
            onChange={(event) => setTestForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={testForm.course_id}
            onChange={(event) => setTestForm((prev) => ({ ...prev, course_id: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Seleziona corso</option>
            {courseOptions.map((course) => (
              <option key={course.value} value={course.value}>{course.label}</option>
            ))}
          </select>
          <input
            type="email"
            placeholder="Email cliente opzionale"
            value={testForm.email}
            onChange={(event) => setTestForm((prev) => ({ ...prev, email: event.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <Button variant="secondary" loading={testing} onClick={handleTestCoupon}>
            Verifica coupon
          </Button>
        </div>

        {testResult && (
          <div className={`mt-4 rounded-lg border px-4 py-3 ${testResult.valid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`font-medium ${testResult.valid ? 'text-emerald-800' : 'text-red-800'}`}>
              {testResult.valid ? 'Coupon valido' : 'Coupon non valido'}
            </p>
            <p className={`text-sm mt-1 ${testResult.valid ? 'text-emerald-700' : 'text-red-700'}`}>{testResult.reason}</p>
            {typeof testResult.final_total === 'number' && (
              <p className="text-sm text-gray-700 mt-1">Totale finale: € {Number(testResult.final_total).toFixed(2)}</p>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sconto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {coupons.map((coupon) => (
                <tr key={coupon.coupon_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
                        <TicketPercent className="w-5 h-5 text-primary-700" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{coupon.code}</div>
                        <div className="text-xs text-gray-500">Creato {formatDateTime(coupon.created_at)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {coupon.is_free_access
                      ? '100% / accesso gratuito'
                      : coupon.discount_type === 'percent'
                        ? `${Number(coupon.discount_value)}%`
                        : `€ ${Number(coupon.discount_value).toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {coupon.course_scope.length > 0 ? `${coupon.course_scope.length} corsi` : 'Tutti i corsi'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {coupon.current_redemptions}/{coupon.max_redemptions ?? '∞'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${coupon.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                        {coupon.is_active ? 'Attivo' : 'Disattivo'}
                      </span>
                      {coupon.expires_at && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                          Scade {formatDateTime(coupon.expires_at)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(coupon)} className="p-2 text-gray-600 hover:text-primary-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {coupons.length === 0 && (
            <div className="text-center py-12 text-gray-500">Nessun coupon configurato.</div>
          )}
        </div>
      </section>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCoupon ? 'Modifica coupon' : 'Nuovo coupon'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Codice</label>
              <input
                type="text"
                value={couponForm.code}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo sconto</label>
              <select
                value={couponForm.discount_type}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, discount_type: event.target.value as CouponRequest['discount_type'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="percent">Percentuale</option>
                <option value="fixed">Importo fisso</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Valore sconto</label>
              <input
                type="number"
                min="0"
                value={couponForm.discount_value}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, discount_value: Number(event.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max redemption</label>
              <input
                type="number"
                min="0"
                value={couponForm.max_redemptions ?? ''}
                onChange={(event) => setCouponForm((prev) => ({
                  ...prev,
                  max_redemptions: event.target.value ? Number(event.target.value) : null,
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Inizio validita</label>
              <input
                type="datetime-local"
                value={toDatetimeInput(couponForm.starts_at)}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, starts_at: event.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scadenza</label>
              <input
                type="datetime-local"
                value={toDatetimeInput(couponForm.expires_at)}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, expires_at: event.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scope corsi</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
              {courseOptions.map((course) => (
                <label key={course.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={couponForm.course_scope.includes(course.value)}
                    onChange={() => toggleCourseScope(course.value)}
                  />
                  <span>{course.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Se lasci vuoto, il coupon resta valido per tutti i corsi acquistabili.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email autorizzate</label>
            <textarea
              value={couponForm.allowed_user_emails.join('\n')}
              onChange={(event) => setCouponForm((prev) => ({
                ...prev,
                allowed_user_emails: event.target.value
                  .split('\n')
                  .map((item) => item.trim().toLowerCase())
                  .filter(Boolean),
              }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Una email per riga"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={couponForm.is_active}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Attivo
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={couponForm.is_free_access}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, is_free_access: event.target.checked }))}
              />
              Free access
            </label>
          </div>

          <Button onClick={handleSaveCoupon} variant="primary" fullWidth loading={saving}>
            {editingCoupon ? 'Salva coupon' : 'Crea coupon'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
