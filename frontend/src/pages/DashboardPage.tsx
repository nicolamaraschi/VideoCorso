import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, Award, Calendar } from 'lucide-react';
import { useCourse } from '../hooks/useCourse';
import { useAuth } from '../hooks/useAuth';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ChapterList } from '../components/course/ChapterList';
import { ProgressBar } from '../components/course/ProgressBar';
import { Button } from '../components/common/Button';
import { formatDate, getDaysRemaining, formatWatchTime } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const { courseStructure, courseProgress, loading, error, reload } = useCourse();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <Loading fullScreen text="Loading your course..." />;
  }

  if (error || !courseStructure) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage
          variant="card"
          message={error || 'Failed to load course'}
          onRetry={reload}
        />
      </div>
    );
  }

  const daysRemaining = user?.subscriptionEndDate
    ? getDaysRemaining(user.subscriptionEndDate)
    : null;

  const handleLessonClick = (lesson: any) => {
    navigate(`/video/${lesson.lesson_id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          My Course Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome back, {user?.fullName || 'Student'}! Continue your learning journey.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Progress</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {courseProgress?.percentage.toFixed(0) || 0}%
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Completed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {courseProgress?.completed_lessons || 0} / {courseProgress?.total_lessons || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Watch Time</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatWatchTime(user?.total_watch_time || 0)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Access</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {daysRemaining !== null ? `${daysRemaining}d` : '∞'}
          </p>
        </div>
      </div>

      {/* Progress Overview */}
      {courseProgress && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Overall Progress
          </h2>
          <ProgressBar
            current={courseProgress.completed_lessons}
            total={courseProgress.total_lessons}
            size="lg"
          />

          {courseProgress.last_watched_lesson && (
            <div className="mt-6 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Continue watching
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {courseProgress.last_watched_lesson.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    Lesson {courseProgress.last_watched_lesson.order_number}
                  </p>
                </div>
                <Button
                  onClick={() => handleLessonClick(courseProgress.last_watched_lesson)}
                  variant="primary"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Course Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Course Content
        </h2>
        <ChapterList
          chapters={courseStructure.chapters}
          progress={
            courseProgress
              ? Object.fromEntries(
                  courseStructure.chapters.flatMap((chapter) =>
                    (chapter.lessons || []).map((lesson) => [
                      lesson.lesson_id,
                      {
                        progress_id: '',
                        user_id: user?.userId || '',
                        lesson_id: lesson.lesson_id,
                        watched_seconds: 0,
                        total_seconds: lesson.duration_seconds,
                        completed: false,
                        last_watched: new Date().toISOString(),
                      },
                    ])
                  )
                )
              : {}
          }
          onLessonClick={handleLessonClick}
        />
      </div>
    </div>
  );
};
