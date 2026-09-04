import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Sparkles } from 'lucide-react';
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
  // By default, expand the first chapter (or all chapters with 0 progress)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    if (chapters.length > 0) {
      return new Set([chapters[0].chapter_id]);
    }
    return new Set();
  });

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

  return (
    <div className="space-y-3 sm:space-y-4">
      {chapters.map((chapter) => {
        const isExpanded = expandedChapters.has(chapter.chapter_id);
        const chapterProgress = getChapterProgress(chapter);
        const isAllDone = chapterProgress.total > 0 && chapterProgress.completed === chapterProgress.total;

        return (
          <div
            key={chapter.chapter_id}
            className="border border-primary-100 rounded-2xl overflow-hidden bg-white shadow-xs transition-all"
          >
            {/* Chapter Header Button */}
            <button
              type="button"
              onClick={() => toggleChapter(chapter.chapter_id)}
              aria-expanded={isExpanded}
              className={`w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 text-left transition-colors ${
                isExpanded ? 'bg-primary-50/50' : 'bg-white hover:bg-gray-50/80'
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                
                {/* Chapter Cover Thumbnail (Compact on mobile, wider on tablet/desktop) */}
                {chapter.image_url ? (
                  <div className="w-16 h-12 sm:w-28 sm:h-20 rounded-xl overflow-hidden bg-primary-100 border border-primary-200/80 flex-shrink-0 shadow-xs">
                    <img
                      src={chapter.image_url}
                      alt={`Copertina ${chapter.title}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-primary-100 border border-primary-200 flex items-center justify-center flex-shrink-0 text-primary-800 font-bold">
                    <Sparkles className="w-5 h-5 text-primary-700" />
                  </div>
                )}

                {/* Chapter Titles & Progress Bar */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary-800 bg-primary-100/80 px-2 py-0.5 rounded-md">
                      Modulo {chapter.order_number}
                    </span>
                    {isAllDone && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle className="w-3 h-3" />
                        Completato
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-sm sm:text-base font-bold text-gray-900 leading-snug break-normal line-clamp-2"
                    style={{ fontFamily: 'Abhaya Libre, serif' }}
                  >
                    {chapter.title}
                  </h3>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <div className="w-20 sm:w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all duration-300"
                        style={{ width: `${chapterProgress.percentage}%` }}
                      />
                    </div>
                    <span className="text-[11px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">
                      {chapterProgress.completed}/{chapterProgress.total} lezioni
                    </span>
                  </div>
                </div>
              </div>

              {/* Chevron icon */}
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600 ml-1">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-primary-900" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>

            {/* Lessons List */}
            {isExpanded && chapter.lessons && chapter.lessons.length > 0 && (
              <div className="divide-y divide-primary-100/60 border-t border-primary-100/60 bg-white">
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
  );
};
