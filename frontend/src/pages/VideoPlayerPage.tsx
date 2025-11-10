import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { VideoPlayer } from '../components/course/VideoPlayer';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useCourse } from '../hooks/useCourse';
import { courseService } from '../services/courseService';

export const VideoPlayerPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { getLessonById, getNextLesson, getPreviousLesson, refreshProgress } = useCourse();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lesson = lessonId ? getLessonById(lessonId) : null;
  const nextLesson = lessonId ? getNextLesson(lessonId) : null;
  const previousLesson = lessonId ? getPreviousLesson(lessonId) : null;

  useEffect(() => {
    if (lessonId) {
      loadVideoUrl();
    }
  }, [lessonId]);

  const loadVideoUrl = async () => {
    if (!lessonId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await courseService.getVideoUrl(lessonId);
      setVideoUrl(response.video_url);
    } catch (err: any) {
      setError(err.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoEnded = async () => {
    await refreshProgress();

    if (nextLesson) {
      navigate(`/video/${nextLesson.lesson_id}`);
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return <Loading fullScreen text="Loading video..." />;
  }

  if (error || !lesson || !videoUrl) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage
          variant="card"
          message={error || 'Video not found'}
          onRetry={loadVideoUrl}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Dashboard</span>
      </button>

      {/* Video Player */}
      <div className="mb-8">
        <VideoPlayer
          videoUrl={videoUrl}
          lessonId={lessonId!}
          onEnded={handleVideoEnded}
        />
      </div>

      {/* Lesson Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {lesson.title}
        </h1>
        {lesson.description && (
          <p className="text-gray-600 mb-4">{lesson.description}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {previousLesson ? (
            <Button
              onClick={() => navigate(`/video/${previousLesson.lesson_id}`)}
              variant="secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous Lesson
            </Button>
          ) : (
            <div />
          )}
        </div>

        <div>
          {nextLesson ? (
            <Button
              onClick={() => navigate(`/video/${nextLesson.lesson_id}`)}
              variant="primary"
            >
              Next Lesson
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => navigate('/dashboard')} variant="primary">
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Course
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
