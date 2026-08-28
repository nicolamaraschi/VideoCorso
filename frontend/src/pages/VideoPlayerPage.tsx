import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Video } from 'lucide-react';
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
    if (stored === '1080p' || stored === '720p' || stored === '480p' || stored === '360p' || stored === 'high' || stored === 'medium' || stored === 'low') {
      return stored as VideoQuality;
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

  // Guards against a race when the user navigates to the next/previous
  // lesson before the previous lesson's video URL request resolves: without
  // this, a slow stale response could overwrite the URL for the new lesson.
  const requestIdRef = useRef(0);

  const loadVideoUrl = useCallback(async () => {
    if (!lessonId) {
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const response = await courseService.getVideoUrl(lessonId, quality);
      if (requestId !== requestIdRef.current) return;
      setVideoUrl(response.video_url);
      setAvailableQualities(response.available_qualities || []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(getErrorMessage(err, 'Failed to load video'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
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
    return <Loading fullScreen text="Caricamento video..." />;
  }

  if (error || !lesson || !videoUrl || !courseStructure) {
    const isVideoMissing =
      !videoUrl ||
      error?.toLowerCase().includes('no video') ||
      error?.toLowerCase().includes('not found') ||
      error?.includes('404');

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isVideoMissing ? (
          <div className="bg-white border border-rose-100 shadow-lg rounded-2xl p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-50 border border-rose-200 mb-5 shadow-inner">
              <Video className="w-10 h-10 text-primary-600" />
            </div>
            <div>
              <span className="inline-block px-3.5 py-1 bg-primary-50 border border-primary-200 text-primary-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
                Chiara Morocutti Academy
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Video-lezione in arrivo
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto mb-8 text-sm sm:text-base leading-relaxed">
              {lesson?.title ? (
                <>La lezione <strong>"{lesson.title}"</strong> è attualmente in fase di preparazione/montaggio e sarà presto disponibile nel corso.</>
              ) : (
                <>Questa video-lezione è attualmente in fase di finalizzazione e sarà presto caricata.</>
              )}
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              <Button
                onClick={() => navigate(`/courses/${courseStructure?.course?.public_slug || courseStructure?.course?.course_id || courseId}`)}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna al corso
              </Button>
              {previousLesson && (
                <Button
                  onClick={() => navigate(`/courses/${courseId}/lessons/${previousLesson.lesson_id}`)}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Lezione precedente
                </Button>
              )}
              {nextLesson && (
                <Button
                  onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.lesson_id}`)}
                  variant="primary"
                  className="w-full sm:w-auto"
                >
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
          key={lessonId}
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
