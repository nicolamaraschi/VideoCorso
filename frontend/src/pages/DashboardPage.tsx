import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, Play, ShieldCheck, Sparkles, GraduationCap } from 'lucide-react';
import { useAuthContext } from '../components/auth/useAuthContext';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import { courseService } from '../services/courseService';
import type { CourseListItem, CourseProgress } from '../types';
import { getErrorMessage } from '../utils/errors';

export const DashboardPage: React.FC = () => {
  const { isAdmin, user } = useAuthContext();
  const navigate = useNavigate();
  const [ownedCourses, setOwnedCourses] = useState<CourseListItem[]>([]);
  const [catalogCourses, setCatalogCourses] = useState<CourseListItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgress>>({});
  const [failedProgressCourseIds, setFailedProgressCourseIds] = useState<Set<string>>(new Set());
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

      const progressEntries: Array<{ courseId: string; progress: CourseProgress | null; failed: boolean }> =
        await Promise.all(
          mine.map(async (course) => {
            try {
              const progress = await courseService.getCourseProgress(course.course_id);
              return { courseId: course.course_id, progress, failed: false };
            } catch {
              return { courseId: course.course_id, progress: null, failed: true };
            }
          })
        );

      setProgressMap(
        Object.fromEntries(
          progressEntries
            .filter((entry) => entry.progress !== null)
            .map((entry) => [entry.courseId, entry.progress as CourseProgress])
        )
      );
      setFailedProgressCourseIds(
        new Set(progressEntries.filter((entry) => entry.failed).map((entry) => entry.courseId))
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
    return <Loading fullScreen text="Caricamento dei tuoi corsi in corso..." />;
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

  const rawName = user?.fullName || user?.email?.split('@')[0] || 'Corsista';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-10 bg-[#FAF7F8] min-h-full">
      
      {/* Header Section */}
      <section className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary-100/90 border border-primary-200/90 text-primary-900 text-xs font-bold uppercase tracking-wider shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-primary-700" />
          <span>Area Riservata Corsiste</span>
        </div>

        <h1
          className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-950 tracking-tight"
          style={{ fontFamily: 'Abhaya Libre, serif' }}
        >
          I Miei Corsi
        </h1>

        <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-2xl">
          Bentornata, <strong className="text-primary-950 font-bold">{displayName}</strong>. Qui trovi i percorsi formativi sbloccati e il tuo stato di avanzamento.
        </p>
      </section>

      {/* Owned Courses Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {ownedCourses.length === 0 && (
          <div className="bg-white rounded-3xl border border-primary-100 p-8 text-center sm:text-left shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-200 flex items-center justify-center mb-4 text-primary-700">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2
              className="text-xl font-bold text-primary-950 mb-2"
              style={{ fontFamily: 'Abhaya Libre, serif' }}
            >
              Nessun corso sbloccato
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Il tuo account non ha ancora accesso a contenuti premium. Puoi esplorare il catalogo qui sotto per iniziare il tuo percorso.
            </p>
          </div>
        )}

        {ownedCourses.map((course) => {
          const progress = progressMap[course.course_id];
          const progressUnavailable = failedProgressCourseIds.has(course.course_id);
          const percent = Math.round(progress?.percentage || 0);

          return (
            <div
              key={course.course_id}
              className="overflow-hidden bg-white rounded-3xl border border-primary-100/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Course Banner Cover */}
                <div className="aspect-video bg-gray-100 border-b border-primary-100/80 overflow-hidden relative">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={`Copertina ${course.title}`}
                      loading="lazy"
                      width={640}
                      height={360}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-100 via-primary-50 to-white flex items-center justify-center">
                      <GraduationCap className="w-12 h-12 text-primary-300" />
                    </div>
                  )}

                  {/* Top-Right Badge */}
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Accesso Attivo
                    </span>
                  </div>
                </div>

                {/* Course Content Area */}
                <div className="p-5 sm:p-7 space-y-4">
                  {/* Title & Description: Full Width, No Cramping */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary-800 block mb-1">
                      Masterclass Ufficiale
                    </span>
                    <h2
                      className="text-xl sm:text-2xl font-bold text-primary-950 leading-snug break-normal"
                      style={{ fontFamily: 'Abhaya Libre, serif' }}
                    >
                      {course.title}
                    </h2>
                    {course.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                        {course.description}
                      </p>
                    )}
                  </div>

                  {/* Progress & Stats Cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3.5 rounded-2xl bg-primary-50/50 border border-primary-100/80 text-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-primary-800">
                        Progresso
                      </p>
                      {progressUnavailable ? (
                        <p className="text-xs font-bold text-amber-700 mt-1">—</p>
                      ) : (
                        <p className="text-base sm:text-lg font-bold text-primary-950 mt-0.5">
                          {percent}%
                        </p>
                      )}
                    </div>

                    <div className="border-x border-primary-200/60">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-primary-800">
                        Lezioni
                      </p>
                      {progressUnavailable ? (
                        <p className="text-xs font-bold text-amber-700 mt-1">—</p>
                      ) : (
                        <p className="text-base sm:text-lg font-bold text-primary-950 mt-0.5">
                          {progress?.completed_lessons || 0}/{progress?.total_lessons || 0}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-primary-800">
                        Accesso
                      </p>
                      <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5">
                        A Vita
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {!progressUnavailable && progress && (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}

                  {progressUnavailable && (
                    <p className="text-xs text-amber-700">
                      Avanzamento temporaneamente non disponibile.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 sm:p-7 pt-0 flex flex-col sm:flex-row gap-3">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => navigate(getCourseRoute(course))}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Accedi alle Lezioni
                </Button>

                {progress?.last_watched_lesson && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (progress?.last_watched_lesson?.lesson_id) {
                        navigate(
                          `/courses/${course.course_id}/lessons/${progress.last_watched_lesson.lesson_id}`
                        );
                      }
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Riprendi
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Catalog / Other Courses Section */}
      {availableCourses.length > 0 && (
        <section className="pt-4 border-t border-primary-100">
          <div className="mb-6">
            <h2
              className="text-xl sm:text-2xl font-bold text-primary-950 mb-1"
              style={{ fontFamily: 'Abhaya Libre, serif' }}
            >
              Altri Corsi Disponibili
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Percorsi aggiuntivi disponibili per l'acquisto e l'anteprima gratuita.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {availableCourses.map((course) => (
              <div
                key={course.course_id}
                className="overflow-hidden bg-white rounded-3xl border border-primary-100 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-video bg-gray-100 border-b border-primary-100 overflow-hidden">
                    {course.cover_image_url ? (
                      <img
                        src={course.cover_image_url}
                        alt={`Copertina ${course.title}`}
                        loading="lazy"
                        width={640}
                        height={360}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
                    )}
                  </div>

                  <div className="p-5 sm:p-7 space-y-2">
                    <h3
                      className="text-lg sm:text-xl font-bold text-primary-950"
                      style={{ fontFamily: 'Abhaya Libre, serif' }}
                    >
                      {course.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      {course.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-7 pt-0 flex items-center justify-between gap-3 border-t border-primary-50 mt-4">
                  <span className="text-lg font-bold text-primary-950">
                    € {Number(course.price).toFixed(2)}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate(getCourseRoute(course))}>
                      Anteprima
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => navigate(getCheckoutRoute(course))}>
                      Acquista
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};
