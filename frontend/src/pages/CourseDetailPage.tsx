import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Play, Sparkles } from 'lucide-react';
import { useCourse } from '../hooks/useCourse';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ProgressBar } from '../components/course/ProgressBar';
import { ChapterList } from '../components/course/ChapterList';
import { Button } from '../components/common/Button';
import type { Lesson } from '../types';

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { courseStructure, courseProgress, loading, error, reload } = useCourse(courseId);

  const handleLessonClick = (lesson: Lesson) => {
    if (!courseStructure?.course.has_access && !lesson.is_free_preview) {
      return;
    }
    navigate(`/courses/${courseStructure?.course.course_id}/lessons/${lesson.lesson_id}`);
  };

  if (loading) {
    return <Loading fullScreen text="Caricamento corso..." />;
  }

  if (error || !courseStructure) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error || 'Corso non trovato'} onRetry={reload} />
      </div>
    );
  }

  const { course } = courseStructure;
  const courseRoute = `/courses/${course.public_slug || course.course_id}`;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 bg-[#FAF7F8] min-h-full">
      <button
        onClick={() => navigate('/dashboard')}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:text-primary-800 hover:border-primary-300 transition-colors shadow-xs"
      >
        <ArrowLeft className="w-4 h-4 text-gray-500" />
        <span>Torna ai miei corsi</span>
      </button>

      {/* Hero Course Header Card */}
      <section className="bg-white rounded-2xl sm:rounded-3xl border border-primary-100/80 p-4 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1 max-w-4xl">
            {course.cover_image_url && (
              <div className="mb-4 sm:mb-6 overflow-hidden rounded-xl sm:rounded-2xl border border-primary-100 shadow-xs bg-gray-50">
                <img
                  src={course.cover_image_url}
                  alt={`Copertina ${course.title}`}
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="aspect-video w-full object-contain"
                />
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary-50 border border-primary-200 text-primary-900 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary-700" />
              <span>Masterclass Ufficiale</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-950 leading-tight"
              style={{ fontFamily: 'Abhaya Libre, serif' }}
            >
              {course.title}
            </h1>
            <p className="text-gray-600 mt-2 sm:mt-3 text-sm sm:text-base leading-relaxed">
              {course.description}
            </p>
          </div>

          <div className="w-full min-w-0 rounded-2xl border border-primary-100 bg-primary-50/40 p-4 sm:p-5 lg:w-auto lg:min-w-[260px]">
            <p className="text-xs uppercase tracking-wider font-bold text-primary-800 mb-1">Stato Accesso</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-950 mb-3">
              {course.has_access ? 'Accesso Completo Attivo' : `€ ${Number(course.price).toFixed(2)}`}
            </p>

            {course.has_access ? (
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-gray-600">Accesso illimitato a tutti i moduli e le lezioni.</p>
                {courseProgress?.last_watched_lesson && (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => navigate(`${courseRoute}/lessons/${courseProgress.last_watched_lesson?.lesson_id}`)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Riprendi ultima lezione
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 rounded-xl p-2.5 border border-amber-200">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Le lezioni premium restano bloccate fino all'acquisto</span>
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate(`/checkout?courseId=${course.public_slug || course.course_id}`)}
                >
                  Acquista corso
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Progress Section */}
      {course.has_access && courseProgress && (
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-primary-100/80 p-4 sm:p-6 shadow-xs">
          <h2
            className="text-lg sm:text-xl font-bold text-primary-950 mb-3"
            style={{ fontFamily: 'Abhaya Libre, serif' }}
          >
            Il tuo avanzamento nel corso
          </h2>
          <ProgressBar current={courseProgress.completed_lessons} total={courseProgress.total_lessons} size="lg" />
        </section>
      )}

      {/* Curriculum Module & Lesson List Section */}
      <section className="bg-white rounded-2xl sm:rounded-3xl border border-primary-100/80 p-3.5 sm:p-6 shadow-xs">
        <h2
          className="text-lg sm:text-xl font-bold text-primary-950 mb-4 sm:mb-6"
          style={{ fontFamily: 'Abhaya Libre, serif' }}
        >
          Contenuti e Moduli del corso
        </h2>
        <ChapterList
          chapters={courseStructure.chapters}
          progress={courseProgress?.lesson_progress || {}}
          onLessonClick={handleLessonClick}
          isPreview={!course.has_access}
        />
      </section>
    </div>
  );
};
