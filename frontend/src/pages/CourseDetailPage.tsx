import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Play } from 'lucide-react';
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
    return <Loading fullScreen text="Loading course..." />;
  }

  if (error || !courseStructure) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={error || 'Course not found'} onRetry={reload} />
      </div>
    );
  }

  const { course } = courseStructure;
  const courseRoute = `/courses/${course.public_slug || course.course_id}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Torna ai corsi</span>
      </button>

      <section className="bg-white rounded-lg border border-gray-200 p-4 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1 max-w-4xl">
            {course.cover_image_url && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200">
                <img
                  src={course.cover_image_url}
                  alt={`Copertina ${course.title}`}
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="aspect-video w-full object-contain bg-gray-50"
                />
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600 mt-3">{course.description}</p>
          </div>

          <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-5 lg:w-auto lg:min-w-[220px]">
            <p className="text-sm uppercase tracking-wide text-gray-500 mb-2">Accesso</p>
            <p className="text-2xl font-bold text-gray-900 mb-4">
              {course.has_access ? 'Sbloccato' : `€ ${Number(course.price).toFixed(2)}`}
            </p>

            {course.has_access ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Accesso lifetime attivo su questo corso.</p>
                {courseProgress?.last_watched_lesson && (
                  <Link to={`${courseRoute}/lessons/${courseProgress.last_watched_lesson.lesson_id}`}>
                    <Button variant="primary" fullWidth>
                      <Play className="w-4 h-4 mr-2" />
                      Riprendi ultima lezione
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <Lock className="w-4 h-4" />
                  Le lezioni premium restano bloccate fino all'acquisto
                </div>
                <Link to={`/checkout?courseId=${course.public_slug || course.course_id}`}>
                  <Button variant="primary" fullWidth>Acquista corso</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {course.has_access && courseProgress && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Il tuo avanzamento</h2>
          <ProgressBar current={courseProgress.completed_lessons} total={courseProgress.total_lessons} size="lg" />
        </section>
      )}

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Contenuti del corso</h2>
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
