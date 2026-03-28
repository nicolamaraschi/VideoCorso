import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BookOpen, Play, ShieldCheck } from 'lucide-react';
import { useAuthContext } from '../components/auth/useAuthContext';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { courseService } from '../services/courseService';
import type { CourseListItem, CourseProgress } from '../types';
import { getErrorMessage } from '../utils/errors';

export const DashboardPage: React.FC = () => {
  const { isAdmin, user } = useAuthContext();
  const [ownedCourses, setOwnedCourses] = useState<CourseListItem[]>([]);
  const [catalogCourses, setCatalogCourses] = useState<CourseListItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const [catalog, mine] = await Promise.all([
        courseService.getCatalog(),
        courseService.getMyCourses(),
      ]);

      setCatalogCourses(catalog);
      setOwnedCourses(mine);

      const progressEntries = await Promise.all(
        mine.map(async (course) => {
          try {
            const progress = await courseService.getCourseProgress(course.course_id);
            return [course.course_id, progress] as const;
          } catch {
            return [course.course_id, null] as const;
          }
        })
      );

      setProgressMap(
        Object.fromEntries(
          progressEntries.filter((entry): entry is readonly [string, CourseProgress] => entry[1] !== null)
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return <Loading fullScreen text="Loading your courses..." />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error} onRetry={loadDashboard} />
      </div>
    );
  }

  const availableCourses = catalogCourses.filter(
    (course) => !ownedCourses.some((owned) => owned.course_id === course.course_id)
  );

  const getCourseRoute = (course: CourseListItem) => `/courses/${course.public_slug || course.course_id}`;
  const getCheckoutRoute = (course: CourseListItem) => `/checkout?courseId=${course.public_slug || course.course_id}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">I miei corsi</h1>
        <p className="text-gray-600">
          Bentornata, {user?.fullName || 'Student'}.
          {' '}
          Qui trovi i corsi sbloccati e il loro stato di avanzamento.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ownedCourses.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Nessun corso sbloccato</h2>
            <p className="text-gray-600 mb-4">
              Il tuo account non ha ancora accesso a contenuti premium. Puoi acquistare un corso dal catalogo qui sotto.
            </p>
          </div>
        )}

        {ownedCourses.map((course) => {
          const progress = progressMap[course.course_id];
          return (
            <div key={course.course_id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{course.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                </div>
                {course.access_granted_by === 'global_access' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Accesso globale
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Progresso</p>
                  <p className="text-lg font-semibold text-gray-900">{Math.round(progress?.percentage || 0)}%</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Completate</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {progress?.completed_lessons || 0}/{progress?.total_lessons || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Accesso</p>
                  <p className="text-lg font-semibold text-gray-900">A vita</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to={getCourseRoute(course)}>
                  <Button variant="primary">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Apri corso
                  </Button>
                </Link>
                {progress?.last_watched_lesson && (
                  <Link to={`/courses/${course.course_id}/lessons/${progress.last_watched_lesson.lesson_id}`}>
                    <Button variant="secondary">
                      <Play className="w-4 h-4 mr-2" />
                      Riprendi
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Catalogo corsi</h2>
            <p className="text-gray-600">Corsi disponibili all'acquisto e anteprima.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {availableCourses.map((course) => (
            <div key={course.course_id} className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-gray-900">{course.title}</h3>
              <p className="text-gray-600 mt-2">{course.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">
                  € {Number(course.price).toFixed(2)}
                </span>
                <div className="flex gap-3">
                  <Link to={getCourseRoute(course)}>
                    <Button variant="secondary">Dettagli</Button>
                  </Link>
                  <Link to={getCheckoutRoute(course)}>
                    <Button variant="primary">Acquista</Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {availableCourses.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <p className="text-gray-600">Hai gia accesso a tutti i corsi attualmente disponibili.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
