import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { VideoPlayer } from '../components/course/VideoPlayer';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useCourse } from '../hooks/useCourse';
import { courseService } from '../services/courseService';
import { getErrorMessage } from '../utils/errors';
import type { VideoQuality } from '../types';

const QUALITY_STORAGE_KEY = 'videocorso_preferred_quality';

const readStoredQuality = (): VideoQuality | undefined => {
  try {
    const stored = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (stored === 'high' || stored === 'medium' || stored === 'low') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private browsing); default quality is fine.
  }
  return undefined;
};

export const VideoPlayerPage: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { getLessonById, getNextLesson, getPreviousLesson, refreshProgress, courseStructure } = useCourse(courseId);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [quality, setQuality] = useState<VideoQuality | undefined>(() => readStoredQuality());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lesson = lessonId ? getLessonById(lessonId) : null;
  const nextLesson = lessonId ? getNextLesson(lessonId) : null;
  const previousLesson = lessonId ? getPreviousLesson(lessonId) : null;

  const loadVideoUrl = useCallback(async () => {
    if (!lessonId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await courseService.getVideoUrl(lessonId, quality);
      setVideoUrl(response.video_url);
      setAvailableQualities(response.available_qualities || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load video'));
    } finally {
      setLoading(false);
    }
  }, [lessonId, quality]);

  useEffect(() => {
    void loadVideoUrl();
  }, [loadVideoUrl]);

  const handleQualityChange = (newQuality: VideoQuality) => {
    setQuality(newQuality);
    try {
      window.localStorage.setItem(QUALITY_STORAGE_KEY, newQuality);
    } catch {
      // Non-critical: worst case the preference just isn't remembered next time.
    }
  };

  const handleVideoEnded = async () => {
    await refreshProgress();

    if (nextLesson && courseId) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.lesson_id}`);
      return;
    }

    if (courseId) {
      navigate(`/courses/${courseId}`);
      return;
    }

    navigate('/dashboard');
  };

  if (loading) {
    return <Loading fullScreen text="Loading video..." />;
  }

  if (error || !lesson || !videoUrl || !courseStructure) {
    const isVideoMissing = error?.includes('404') || error?.includes('Not Found');

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isVideoMissing ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Materiale Informativo</h2>
            <p className="text-blue-700 mb-8">
              In questo modulo non è presente un video. Puoi continuare con il materiale testuale o passare direttamente alla lezione successiva.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button onClick={() => navigate(`/courses/${courseId}`)} variant="secondary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna al corso
              </Button>
              {nextLesson && (
                <Button onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.lesson_id}`)} variant="primary">
                  Lezione successiva
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <ErrorMessage variant="card" message={error || 'Video non trovato'} onRetry={loadVideoUrl} />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(`/courses/${courseStructure.course.public_slug || courseStructure.course.course_id}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Torna al corso</span>
      </button>

      <div className="-mx-4 mb-6 sm:mx-0 sm:mb-8">
        <VideoPlayer
          videoUrl={videoUrl}
          lessonId={lessonId!}
          onEnded={handleVideoEnded}
          availableQualities={availableQualities}
          quality={quality}
          onQualityChange={handleQualityChange}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-gray-600 mb-4">{lesson.description}</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-auto">
          {previousLesson ? (
            <Button
              onClick={() => navigate(`/courses/${courseId}/lessons/${previousLesson.lesson_id}`)}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Lezione precedente
            </Button>
          ) : (
            <div />
          )}
        </div>

        <div className="w-full sm:w-auto">
          {nextLesson ? (
            <Button
              onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.lesson_id}`)}
              variant="primary"
              className="w-full sm:w-auto"
            >
              Lezione successiva
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => navigate(`/courses/${courseId}`)} variant="primary" className="w-full sm:w-auto">
              <CheckCircle className="w-4 h-4 mr-2" />
              Torna al corso
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
