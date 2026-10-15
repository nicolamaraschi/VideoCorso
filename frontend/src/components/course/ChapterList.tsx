import React, { useState, useEffect } from 'react';
import { ChevronDown, CheckCircle, Sparkles, Layers } from 'lucide-react';
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
  // By default, expand the first chapter (or the chapter with active/current lesson)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    if (chapters.length > 0) {
      if (currentLessonId) {
        const matchingChapter = chapters.find((c) =>
          c.lessons?.some((l) => l.lesson_id === currentLessonId)
        );
        if (matchingChapter) {
          return new Set([matchingChapter.chapter_id]);
        }
      }
      return new Set([chapters[0].chapter_id]);
    }
    return new Set();
  });

  // Keep expanded chapters in sync when chapters load asynchronously or currentLessonId updates
  useEffect(() => {
    if (chapters.length === 0) return;

    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (currentLessonId) {
        const matchingChapter = chapters.find((c) =>
          c.lessons?.some((l) => l.lesson_id === currentLessonId)
        );
        if (matchingChapter) {
          next.add(matchingChapter.chapter_id);
          return next;
        }
      }

      // If nothing has been expanded yet, default to expanding chapter 1
      if (next.size === 0 && chapters.length > 0) {
        next.add(chapters[0].chapter_id);
      }
      return next;
    });
  }, [chapters, currentLessonId]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 py-1 sm:py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700">
          <Layers className="w-4 h-4 text-primary-700 shrink-0" />
          <span>
            {chapters.length} {chapters.length === 1 ? 'Modulo' : 'Moduli'} • {totalLessonsCount} Lezioni totali
          </span>
          {totalCompletedCount > 0 && (
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-xs">
              {totalCompletedCount} completate
            </span>
          )}
        </div>

        {chapters.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-primary-900 hover:text-primary-950 bg-primary-50 hover:bg-primary-100 border border-primary-200/90 px-3.5 py-2 rounded-xl transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-primary-700" />
            <span>{areAllExpanded ? 'Comprimi tutti i moduli' : 'Espandi tutti i moduli'}</span>
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
                className={`w-full cursor-pointer p-4 sm:p-6 lg:p-7 text-left transition-all select-none ${
                  isExpanded
                    ? 'bg-gradient-to-r from-primary-50/80 via-primary-50/30 to-white border-b border-primary-100/80'
                    : 'bg-white hover:bg-primary-50/30'
                }`}
              >
                {/* MOBILE CHAPTER HEADER LAYOUT (< sm) - Symmetrical & Balanced */}
                <div className="flex flex-col gap-3.5 sm:hidden">
                  {/* Chapter Cover Thumbnail */}
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-primary-200/90 shrink-0 shadow-xs relative">
                    {chapter.image_url ? (
                      <img
                        src={chapter.image_url}
                        alt={`Copertina ${chapter.title}`}
                        loading="lazy"
                        className="w-full h-full object-cover img-sharp"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 to-primary-950 text-white p-2 text-center">
                        <Sparkles className="w-6 h-6 text-primary-300 mb-1" />
                        <span className="text-xs font-bold uppercase tracking-wider text-primary-200">
                          Modulo {chapter.order_number}
                        </span>
                      </div>
                    )}

                    {isAllDone && (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Completato</span>
                      </div>
                    )}
                  </div>

                  {/* Header Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-primary-900 bg-primary-100 px-2.5 py-0.5 rounded-md border border-primary-200/80">
                        Modulo {chapter.order_number}
                      </span>
                      {isAllDone ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Tutte le lezioni completate
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-500">
                          {chapter.lessons?.length || 0} {chapter.lessons?.length === 1 ? 'lezione' : 'lezioni'}
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-lg font-bold text-gray-950 leading-snug"
                      style={{ fontFamily: 'Abhaya Libre, serif' }}
                    >
                      {chapter.title.replace(/^modulo\s*\d+[:\s-]*/i, '').trim() || chapter.title}
                    </h3>

                    {/* Symmetrical Progress Bar on Mobile */}
                    <div className="mt-2.5 space-y-1.5">
                      <div className="w-full h-2 bg-gray-200/80 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAllDone
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-primary-700 to-primary-500'
                          }`}
                          style={{ width: `${chapterProgress.percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                        <span>Progresso modulo</span>
                        <span>
                          {chapterProgress.completed} / {chapterProgress.total} lezioni
                          {chapterProgress.percentage > 0 ? ` (${Math.round(chapterProgress.percentage)}%)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Symmetrical Action Toggle Bar (Completely solves the void pointed in the screenshot!) */}
                  <div className="pt-2.5 border-t border-primary-100/80 flex items-center justify-between text-xs font-bold text-primary-900">
                    <span className="text-primary-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-primary-600" />
                      <span>{isExpanded ? 'Visualizzazione lezioni attiva' : 'Tocca per visualizzare le lezioni'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-100/90 text-primary-950 shadow-2xs group-hover/chap:bg-primary-200 transition-colors">
                      <span>{isExpanded ? 'Comprimi' : 'Apri'}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-primary-900 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180 text-primary-950' : 'rotate-0 text-primary-700'
                        }`}
                      />
                    </span>
                  </div>
                </div>

                {/* DESKTOP CHAPTER HEADER LAYOUT (>= sm) */}
                <div className="hidden sm:flex sm:items-center justify-between gap-4 sm:gap-6">
                  <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                    {/* Chapter Cover Thumbnail */}
                    <div
                      className="w-56 md:w-72 lg:w-80 aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-primary-200/90 shrink-0 shadow-sm relative group/chapterthumb cursor-pointer"
                      title={isExpanded ? 'Comprimi modulo' : 'Espandi modulo e visualizza le lezioni'}
                    >
                      {chapter.image_url ? (
                        <img
                          src={chapter.image_url}
                          alt={`Copertina ${chapter.title}`}
                          loading="lazy"
                          className="w-full h-full object-cover img-sharp group-hover/chapterthumb:scale-102 transition-transform duration-500"
                        />
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
                        {chapter.title.replace(/^modulo\s*\d+[:\s-]*/i, '').trim() || chapter.title}
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
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-50 border border-primary-200/80 flex items-center justify-center flex-shrink-0 text-primary-900 transition-all duration-300 ml-2 shadow-2xs group-hover/chap:bg-primary-100 self-center">
                    <ChevronDown
                      className={`w-5 h-5 text-primary-900 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 text-primary-950' : 'rotate-0 text-primary-700'
                      }`}
                    />
                  </div>
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
    </div>
  );
};
