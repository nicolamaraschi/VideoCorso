import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, RefreshCcw } from 'lucide-react';
import { adminService } from '../services/adminService';
import type { StudentDetail } from '../types';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatters';
import { getErrorMessage } from '../utils/errors';

export const AdminStudentDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!studentId) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getStudentDetail(studentId);
      setDetail(response);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load student detail'));
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleResendInvite = async () => {
    if (!studentId) {
      return;
    }
    try {
      setSendingInvite(true);
      await adminService.resendInvite(studentId);
      alert('Invito reinviato con una nuova password temporanea.');
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to resend invite'));
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return <Loading fullScreen text="Loading student detail..." />;
  }

  if (error || !detail) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error || 'Student not found'} onRetry={loadDetail} />
      </div>
    );
  }

  const { student, purchases, accessible_courses, progress_by_course } = detail;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/admin/students" className="text-sm text-primary-600 hover:text-primary-700">
            Torna agli studenti
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{student.full_name}</h1>
          <p className="text-gray-600">{student.email}</p>
        </div>
        <Button onClick={handleResendInvite} loading={sendingInvite} variant="secondary">
          <Mail className="w-4 h-4 mr-2" />
          Reinvia invito
        </Button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Accesso account</p>
          <p className="text-xl font-semibold text-gray-900">{student.global_access ? 'Globale' : 'Per corso'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Corsi sbloccati</p>
          <p className="text-xl font-semibold text-gray-900">{student.accessible_courses_count}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Tempo di visione</p>
          <p className="text-xl font-semibold text-gray-900">{student.total_watch_time}s</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avanzamento medio</p>
          <p className="text-xl font-semibold text-gray-900">{student.completion_percentage}%</p>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCcw className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Accessi attivi</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {accessible_courses.map((course) => (
            <span key={course.course_id} className="inline-flex px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
              {course.title}
            </span>
          ))}
          {accessible_courses.length === 0 && (
            <p className="text-gray-500">Nessun corso sbloccato.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Storico acquisti</h2>
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div key={purchase.purchase_id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-gray-200 rounded-lg p-4">
              <div>
                <p className="font-medium text-gray-900">{purchase.course_title || purchase.course_id}</p>
                <p className="text-sm text-gray-500">{formatDate(purchase.purchase_date)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700">
                  € {Number(purchase.amount).toFixed(2)}
                </div>
                <Link to={`/admin/purchases/${purchase.purchase_id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  Apri dettaglio
                </Link>
              </div>
            </div>
          ))}
          {purchases.length === 0 && (
            <p className="text-gray-500">Nessun acquisto registrato.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Progressi per corso</h2>
        <div className="space-y-4">
          {progress_by_course.map((item) => (
            <div key={item.course_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">
                    {item.has_access ? 'Accesso attivo' : 'Non sbloccato'}
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-700">{Math.round(item.percentage)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full">
                <div className="h-full bg-primary-600 rounded-full" style={{ width: `${item.percentage}%` }} />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {item.completed_lessons}/{item.total_lessons} lezioni completate
                {item.last_watched ? ` • Ultima attivita ${formatDate(item.last_watched)}` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
