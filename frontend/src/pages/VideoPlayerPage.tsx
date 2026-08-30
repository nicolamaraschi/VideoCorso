import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  ListOrdered,
  Play,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { VideoPlayer } from '../components/course/VideoPlayer';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useCourse } from '../hooks/useCourse';
import { courseService } from '../services/courseService';
import { getErrorMessage } from '../utils/errors';
import { formatDuration } from '../utils/formatters';
import type { VideoQuality } from '../types';

const QUALITY_STORAGE_KEY = 'videocorso_preferred_quality';

const readStoredQuality = (): VideoQuality | undefined => {
  try {
    const stored = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (
      stored === '1080p' ||
      stored === '720p' ||
      stored === '480p' ||
      stored === '360p' ||
      stored === 'high' ||
      stored === 'medium' ||
      stored === 'low'
    ) {
      return stored as VideoQuality;
    }
  } catch {
    // localStorage may be unavailable (private browsing)
  }
  return undefined;
};

export const VideoPlayerPage: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const {
    getLessonById,
    getNextLesson,
    getPreviousLesson,
    refreshProgress,
    courseStructure,
    courseProgress,
  } = useCourse(courseId);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [quality, setQuality] = useState<VideoQuality | undefined>(() => readStoredQuality());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isTogglingComplete, setIsTogglingComplete] = useState(false);

  const lesson = lessonId ? getLessonById(lessonId) : null;
  const nextLesson = lessonId ? getNextLesson(lessonId) : null;
  const previousLesson = lessonId ? getPreviousLesson(lessonId) : null;

  // Find the current chapter for this lesson
  const currentChapter = useMemo(() => {
    if (!courseStructure || !lessonId) return null;
    return courseStructure.chapters.find((chap) =>
      chap.lessons?.some((l) => l.lesson_id === lessonId)
    ) || null;
  }, [courseStructure, lessonId]);

  // Chapter index (1-based)
  const chapterNumber = useMemo(() => {
    if (!courseStructure || !currentChapter) return 1;
    const idx = courseStructure.chapters.findIndex(
      (c) => c.chapter_id === currentChapter.chapter_id
    );
    return idx >= 0 ? idx + 1 : currentChapter.order_number || 1;
  }, [courseStructure, currentChapter]);

  // Lesson index in current chapter (1-based)
  const lessonNumberInChapter = useMemo(() => {
    if (!currentChapter || !lessonId) return 1;
    const idx = currentChapter.lessons?.findIndex((l) => l.lesson_id === lessonId);
    return idx !== undefined && idx >= 0 ? idx + 1 : lesson?.order_number || 1;
  }, [currentChapter, lessonId, lesson]);

  const totalLessonsInChapter = currentChapter?.lessons?.length || 1;

  // Completion status of current lesson
  const isCompleted = useMemo(() => {
    if (!courseProgress || !lessonId) return false;
    if (courseProgress.lesson_progress && courseProgress.lesson_progress[lessonId]?.completed) {
      return true;
    }
    return false;
  }, [courseProgress, lessonId]);

  // Global completed count
  const totalCompletedInCourse = courseProgress?.completed_lessons || 0;
  const totalLessonsInCourse = courseProgress?.total_lessons || 0;

  // Guard against stale asynchronous video requests
  const requestIdRef = useRef(0);

  const loadVideoUrl = useCallback(async () => {
    if (!lessonId) return;

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
      // Ignored
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

  const handleToggleComplete = async () => {
    if (!lessonId || isTogglingComplete) return;
    try {
      setIsTogglingComplete(true);
      await courseService.markLessonComplete(lessonId);
      await refreshProgress();
    } catch (err) {
      console.error('Error updating completion:', err);
    } finally {
      setIsTogglingComplete(false);
    }
  };

  const courseBackUrl = `/courses/${
    courseStructure?.course?.public_slug || courseStructure?.course?.course_id || courseId
  }`;

  if (loading) {
    return <Loading fullScreen text="Caricamento video in corso..." />;
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
          <div className="bg-white border border-primary-100 shadow-xl rounded-3xl p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 border border-primary-200 mb-5 shadow-inner">
              <Video className="w-10 h-10 text-primary-700" />
            </div>
            <div>
              <span className="inline-block px-3.5 py-1 bg-primary-50 border border-primary-200 text-primary-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
                Chiara Morocutti Academy
              </span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold text-primary-950 mb-3"
              style={{ fontFamily: 'Abhaya Libre, serif' }}
            >
              Video-lezione in arrivo
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto mb-8 text-sm sm:text-base leading-relaxed">
              {lesson?.title ? (
                <>
                  La lezione <strong>"{lesson.title}"</strong> è attualmente in fase di finalizzazione
                  e sarà disponibile a brevissimo.
                </>
              ) : (
                <>Questa video-lezione è attualmente in fase di caricamento e sarà subito attiva.</>
              )}
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              <Button onClick={() => navigate(courseBackUrl)} variant="secondary" className="w-full sm:w-auto">
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
    <div className="min-h-full bg-[#FAF7F8] py-6 sm:py-8 lg:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* ========================================================================= */}
        {/* TOP BAR: Navigation breadcrumb, Playlist Drawer Trigger & Mark Complete */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-primary-100/80">
          
          {/* Back to Course button */}
          <Link
            to={courseBackUrl}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/50 text-xs sm:text-sm font-semibold transition-all shadow-xs group"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500 group-hover:text-primary-700 group-hover:-translate-x-0.5 transition-all" />
            <span>Indice Corso</span>
          </Link>

          {/* Right Action Group: Playlist Toggle & Completion Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Quick Playlist Drawer Button */}
            <button
              type="button"
              onClick={() => setIsPlaylistOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-primary-200 text-primary-900 hover:bg-primary-50 text-xs sm:text-sm font-semibold transition-all shadow-xs"
              title="Apri elenco lezioni"
            >
              <ListOrdered className="w-4 h-4 text-primary-700" />
              <span className="hidden sm:inline">Elenco Lezioni</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-900 text-[11px] font-bold">
                {totalCompletedInCourse}/{totalLessonsInCourse || '—'}
              </span>
            </button>

            {/* Mark as Complete Toggle */}
            <button
              type="button"
              onClick={handleToggleComplete}
              disabled={isTogglingComplete}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50'
              }`}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Completata</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 text-gray-400" />
                  <span>Segna completata</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTERED HERO HEADER: Module Badge, Luxury Title & Lesson Metadata */}
        {/* ========================================================================= */}
        <header className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          {/* Module Pill */}
          {currentChapter && (
            <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-primary-100/90 border border-primary-200/90 text-primary-900 text-xs font-bold uppercase tracking-wider mb-3 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-primary-700" />
              <span>
                Modulo {chapterNumber} • {currentChapter.title}
              </span>
            </div>
          )}

          {/* Main Lesson Title */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-950 leading-tight tracking-tight mb-2 sm:mb-3"
            style={{ fontFamily: 'Abhaya Libre, serif' }}
          >
            {lesson.title}
          </h1>

          {/* Lesson Metadata Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-gray-600">
            <span className="inline-flex items-center gap-1 font-medium text-gray-700">
              <Layers className="w-3.5 h-3.5 text-primary-600" />
              Lezione {lessonNumberInChapter} di {totalLessonsInChapter}
            </span>
            {lesson.duration_seconds > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                  <Clock className="w-3.5 h-3.5 text-primary-600" />
                  {formatDuration(lesson.duration_seconds)}
                </span>
              </>
            )}
            {isCompleted && (
              <>
                <span className="text-gray-300">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Hai già completato questa lezione
                </span>
              </>
            )}
          </div>

          {/* Lesson Description (if any) */}
          {lesson.description && (
            <p className="mt-3 text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
              {lesson.description}
            </p>
          )}
        </header>

        {/* ========================================================================= */}
        {/* VIDEO PLAYER FRAME: Centered Cinema Container */}
        {/* ========================================================================= */}
        <div className="relative mb-6 sm:mb-8">
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-black">
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
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM NAVIGATION CONTROLS: Previous & Next Lesson Cards */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
          
          {/* Previous Lesson Button */}
          {previousLesson ? (
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/lessons/${previousLesson.lesson_id}`)}
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-primary-100/80 hover:border-primary-300 hover:bg-primary-50/40 shadow-sm text-left transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200/80 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                <ArrowLeft className="w-5 h-5 text-primary-800 group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                  Lezione Precedente
                </span>
                <span className="text-sm font-semibold text-primary-950 block truncate group-hover:text-primary-800">
                  {previousLesson.title}
                </span>
              </div>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          {/* Next Lesson Button */}
          {nextLesson ? (
            <button
              type="button"
              onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.lesson_id}`)}
              className="flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-primary-900 hover:bg-primary-950 text-white shadow-md text-right transition-all duration-200 group sm:col-start-2"
            >
              <div className="min-w-0 flex-1 text-left sm:text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary-200 block mb-0.5">
                  Prossima Lezione
                </span>
                <span className="text-sm font-semibold text-white block truncate group-hover:text-primary-100">
                  {nextLesson.title}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 transition-colors">
                <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(courseBackUrl)}
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-md text-center font-bold transition-all sm:col-start-2"
            >
              <CheckCircle className="w-5 h-5 text-emerald-200" />
              <span>Hai completato tutte le lezioni! Torna al corso</span>
            </button>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SLIDE-OVER PLAYLIST DRAWER: All Modules & Lessons Quick Switcher */}
      {/* ========================================================================= */}
      {isPlaylistOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsPlaylistOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl border-l border-primary-100 flex flex-col animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="p-5 bg-primary-950 text-white flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-widest text-primary-300 font-bold block">
                    Indice Masterclass
                  </span>
                  <h3
                    className="text-lg font-bold text-white mt-0.5"
                    style={{ fontFamily: 'Abhaya Libre, serif' }}
                  >
                    {courseStructure.course.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlaylistOpen(false)}
                  className="p-2 rounded-xl text-primary-200 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Chiudi elenco"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar in Drawer */}
              <div className="px-5 py-3 bg-primary-900/40 border-b border-primary-100 flex items-center justify-between text-xs font-semibold text-primary-900">
                <span>Progresso generale:</span>
                <span className="font-bold text-primary-950">
                  {totalCompletedInCourse} di {totalLessonsInCourse} lezioni completate
                </span>
              </div>

              {/* Drawer Lessons List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {courseStructure.chapters.map((chapter, chapIdx) => (
                  <div key={chapter.chapter_id} className="space-y-2">
                    <div className="px-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
                        Modulo {chapIdx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900">{chapter.title}</h4>
                    </div>

                    <div className="space-y-1.5">
                      {chapter.lessons?.map((les, lesIdx) => {
                        const isCurrent = les.lesson_id === lessonId;
                        const isLesDone =
                          courseProgress?.lesson_progress &&
                          courseProgress.lesson_progress[les.lesson_id]?.completed;

                        return (
                          <button
                            key={les.lesson_id}
                            type="button"
                            onClick={() => {
                              setIsPlaylistOpen(false);
                              navigate(`/courses/${courseId}/lessons/${les.lesson_id}`);
                            }}
                            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-all ${
                              isCurrent
                                ? 'bg-primary-100 text-primary-950 border border-primary-300 font-bold shadow-xs'
                                : 'bg-gray-50/70 hover:bg-primary-50 text-gray-700 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                                  isCurrent
                                    ? 'bg-primary-700 text-white font-bold'
                                    : isLesDone
                                    ? 'bg-emerald-100 text-emerald-700 font-bold'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {isCurrent ? (
                                  <Play className="w-3 h-3 fill-current" />
                                ) : isLesDone ? (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                ) : (
                                  lesIdx + 1
                                )}
                              </div>
                              <span className="text-xs sm:text-sm line-clamp-1">
                                {les.title}
                              </span>
                            </div>

                            {les.duration_seconds > 0 && (
                              <span className="text-[11px] text-gray-400 flex-shrink-0">
                                {formatDuration(les.duration_seconds)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
