import React, { useState } from 'react';
import { ChevronDown, CheckCircle, Sparkles, Layers, ZoomIn, X } from 'lucide-react';
import type { Chapter, Lesson, Progress } from '../../types';
import { LessonCard } from './LessonCard';

interface ChapterListProps {
  chapters: Chapter[];
  progress?: Record<string, Progress>;
  onLessonClick: (lesson: Lesson) => void;
  currentLessonId?: string;
  isPreview?: boolean;
}

export const ChapterList: React.FC<ChapterListProps> = ({
  chapters,
  progress = {},
  onLessonClick,
  currentLessonId,
  isPreview = false,
}) => {
  // HD Zoom Modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // By default, expand the first chapter (or all chapters if only 1)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    if (chapters.length > 0) {
      return new Set([chapters[0].chapter_id]);
    }
    return new Set();
  });

  const allChapterIds = chapters.map((c) => c.chapter_id);
  const areAllExpanded = allChapterIds.length > 0 && allChapterIds.every((id) => expandedChapters.has(id));

  const toggleAll = () => {
    if (areAllExpanded) {
      setExpandedChapters(new Set());
    } else {
      setExpandedChapters(new Set(allChapterIds));
    }
  };

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  const getChapterProgress = (chapter: Chapter) => {
    if (!chapter.lessons) return { completed: 0, total: 0, percentage: 0 };

    const total = chapter.lessons.length;
    const completed = chapter.lessons.filter(
      (lesson) => progress[lesson.lesson_id]?.completed
    ).length;

    return {
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  };

  const totalLessonsCount = chapters.reduce((acc, chap) => acc + (chap.lessons?.length || 0), 0);
  const totalCompletedCount = chapters.reduce((acc, chap) => {
    return acc + (chap.lessons?.filter((l) => progress[l.lesson_id]?.completed).length || 0);
  }, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header Summary & Toggle All Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1 sm:py-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700">
          <Layers className="w-4 h-4 text-primary-700" />
          <span>
            {chapters.length} Moduli • {totalLessonsCount} Lezioni totali
          </span>
          {totalCompletedCount > 0 && (
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
              {totalCompletedCount} completate
            </span>
          )}
        </div>

        {chapters.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs sm:text-sm font-bold text-primary-800 hover:text-primary-950 bg-primary-50/80 hover:bg-primary-100 border border-primary-200/80 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
          >
            {areAllExpanded ? 'Comprimi tutti i moduli' : 'Espandi tutti i moduli'}
          </button>
        )}
      </div>

      {/* Chapters Accordion List */}
      <div className="space-y-4 sm:space-y-5">
        {chapters.map((chapter) => {
          const isExpanded = expandedChapters.has(chapter.chapter_id);
          const chapterProgress = getChapterProgress(chapter);
          const isAllDone = chapterProgress.total > 0 && chapterProgress.completed === chapterProgress.total;

          return (
            <div
              key={chapter.chapter_id}
              className="border-2 border-primary-100/90 rounded-2xl sm:rounded-3xl overflow-hidden bg-white shadow-xs hover:shadow-md hover:border-primary-200 transition-all duration-300 group/chap"
            >
              {/* Chapter Header Button */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleChapter(chapter.chapter_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleChapter(chapter.chapter_id);
                  }
                }}
                aria-expanded={isExpanded}
                className={`w-full cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 p-4 sm:p-6 lg:p-7 text-left transition-all select-none ${
                  isExpanded
                    ? 'bg-gradient-to-r from-primary-50/80 via-primary-50/30 to-white border-b border-primary-100/80'
                    : 'bg-white hover:bg-primary-50/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0 flex-1">
                  {/* Chapter Cover Thumbnail (Large, prominent, cinematic 16:9, crystal clear) */}
                  <div
                    onClick={(e) => {
                      if (chapter.image_url) {
                        e.stopPropagation();
                        setPreviewImage({
                          url: chapter.image_url,
                          title: `Modulo ${chapter.order_number}: ${chapter.title}`,
                        });
                      }
                    }}
                    className={`w-full sm:w-64 md:w-80 lg:w-[360px] xl:w-[400px] aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-primary-200/90 shrink-0 shadow-sm relative group/chapterthumb ${
                      chapter.image_url ? 'cursor-zoom-in' : ''
                    }`}
                    title={chapter.image_url ? 'Clicca per ingrandire la copertina in HD' : undefined}
                  >
                    {chapter.image_url ? (
                      <>
                        <img
                          src={chapter.image_url}
                          alt={`Copertina ${chapter.title}`}
                          loading="lazy"
                          className="w-full h-full object-cover img-sharp group-hover/chapterthumb:scale-102 transition-transform duration-500"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/75 hover:bg-black/90 text-white px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover/chapterthumb:opacity-100 transition-opacity shadow-md pointer-events-none">
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span className="text-[11px] tracking-wide">Ingrandisci HD</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 to-primary-950 text-white p-2 text-center">
                        <Sparkles className="w-6 h-6 text-primary-300 mb-1" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary-200">
                          Modulo {chapter.order_number}
                        </span>
                      </div>
                    )}

                    {isAllDone && (
                      <div className="absolute top-2 left-2 p-1 rounded-md bg-emerald-600 text-white shadow-md">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Chapter Titles & Progress Bar */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-primary-900 bg-primary-100 px-3 py-0.5 rounded-lg border border-primary-200/80">
                        Modulo {chapter.order_number}
                      </span>
                      {isAllDone && (
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          Completato
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-base sm:text-xl md:text-2xl font-bold text-gray-950 leading-snug break-normal line-clamp-2"
                      style={{ fontFamily: 'Abhaya Libre, serif' }}
                    >
                      {chapter.title}
                    </h3>

                    {/* Progress Indicator */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-3">
                      <div className="w-28 sm:w-48 md:w-60 h-2 sm:h-2.5 bg-gray-200/80 rounded-full overflow-hidden flex-shrink-0 shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAllDone
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-primary-700 to-primary-500'
                          }`}
                          style={{ width: `${chapterProgress.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 whitespace-nowrap">
                        {chapterProgress.completed} / {chapterProgress.total} lezioni
                        {isAllDone
                          ? ' • 100%'
                          : chapterProgress.completed > 0
                          ? ` • ${Math.round(chapterProgress.percentage)}%`
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chevron icon button */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-50 border border-primary-200/80 flex items-center justify-center flex-shrink-0 text-primary-900 transition-all duration-300 ml-2 shadow-2xs group-hover/chap:bg-primary-100 self-end sm:self-center">
                  <ChevronDown
                    className={`w-5 h-5 text-primary-900 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 text-primary-950' : 'rotate-0 text-primary-700'
                    }`}
                  />
                </div>
              </div>

              {/* Lessons List */}
              {isExpanded && chapter.lessons && chapter.lessons.length > 0 && (
                <div className="divide-y divide-primary-100/70 bg-white">
                  {chapter.lessons.map((lesson) => {
                    const lessonProgress = progress[lesson.lesson_id];
                    const isLocked = isPreview && !lesson.is_free_preview;

                    return (
                      <LessonCard
                        key={lesson.lesson_id}
                        lesson={lesson}
                        progress={lessonProgress}
                        isActive={currentLessonId === lesson.lesson_id}
                        isLocked={isLocked}
                        onClick={() => !isLocked && onLessonClick(lesson)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full HD Zoom Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-5xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white mb-3 px-1">
              <span className="text-sm sm:text-base font-semibold truncate pr-4 text-gray-200">
                {previewImage.title} • Copertina Ufficiale HD
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Chiudi anteprima"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="w-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full h-auto max-h-[82vh] object-contain mx-auto img-sharp"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Clicca ovunque fuori dall'immagine o sulla X per chiudere
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
