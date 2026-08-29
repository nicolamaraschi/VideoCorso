import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, RefreshCcw } from 'lucide-react';
import { adminService } from '../services/adminService';
import type { StudentDetail, Course } from '../types';
import { Loading } from '../components/common/Loading';
import { Modal } from '../components/common/Modal';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatters';
import { getErrorMessage } from '../utils/errors';
import { useAdminOperationBanner } from '../components/common/AdminOperationBanner';

const formatWatchTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  }
  return `${m} min`;
};

export const AdminStudentDetailPage: React.FC = () => {
  const { showSuccess, showError } = useAdminOperationBanner();
  const { studentId } = useParams<{ studentId: string }>();
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingPassword, setSendingPassword] = useState(false);

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [granting, setGranting] = useState(false);

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

  const handleSendNewPassword = async () => {
    if (!studentId) {
      return;
    }
    try {
      setSendingPassword(true);
      await adminService.resetPassword(studentId);
      showSuccess('Password reimpostata', 'La nuova password temporanea è stata inviata via email allo studente.');
    } catch (err) {
      showError('Password non reimpostata', getErrorMessage(err, 'La password precedente resta valida.'));
    } finally {
      setSendingPassword(false);
    }
  };

  const handleOpenGrantModal = async () => {
    setShowGrantModal(true);
    try {
      const courses = await adminService.getCourses();
      setAvailableCourses(courses);
      if (courses.length > 0) {
        setSelectedCourseId(courses[0].course_id);
      }
    } catch (err) {
      showError('Corsi non caricati', getErrorMessage(err, 'Non è possibile scegliere un corso da assegnare.'));
    }
  };

  const handleConfirmGrant = async () => {
    if (!studentId || !selectedCourseId) return;
    try {
      setGranting(true);
      await adminService.grantCourse(studentId, selectedCourseId);
      const courseTitle = availableCourses.find((course) => course.course_id === selectedCourseId)?.title || 'Il corso selezionato';
      showSuccess('Accesso assegnato', `${courseTitle} è ora disponibile nell’account dello studente.`);
      setShowGrantModal(false);
      await loadDetail();
    } catch (err) {
      showError('Accesso non assegnato', getErrorMessage(err, 'Lo studente non ha ricevuto il nuovo accesso.'));
    } finally {
      setGranting(false);
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Link to="/admin/students" className="text-sm text-primary-600 hover:text-primary-700">
            Torna agli studenti
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{student.full_name}</h1>
          <p className="text-gray-600">{student.email}</p>
        </div>
        <Button onClick={handleSendNewPassword} loading={sendingPassword} variant="secondary">
          <Mail className="w-4 h-4 mr-2" />
          Invia nuova password
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
          <p className="text-xl font-semibold text-gray-900">{formatWatchTime(student.total_watch_time)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avanzamento medio</p>
          <p className="text-xl font-semibold text-gray-900">{student.completion_percentage}%</p>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Accessi attivi</h2>
          </div>
          <Button onClick={handleOpenGrantModal} variant="secondary" size="sm">
            + Assegna Corso
          </Button>
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

      {showGrantModal && (
        <Modal isOpen={showGrantModal} title="Assegna Corso Manualmente" onClose={() => setShowGrantModal(false)}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">
              Seleziona il corso da assegnare gratuitamente a {student.full_name}.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Corso
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {availableCourses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.title} ({c.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowGrantModal(false)}>
                Annulla
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmGrant}
                loading={granting}
                disabled={!selectedCourseId}
              >
                Assegna
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
