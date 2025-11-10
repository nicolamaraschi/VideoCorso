import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Lock } from 'lucide-react';
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
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(chapters.map((c) => c.chapter_id))
  );

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
    <div className="space-y-3">
      {chapters.map((chapter) => {
        const isExpanded = expandedChapters.has(chapter.chapter_id);
        const chapterProgress = getChapterProgress(chapter);

        return (
          <div
            key={chapter.chapter_id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Chapter Header */}
            <button
              onClick={() => toggleChapter(chapter.chapter_id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      Chapter {chapter.order_number}
                    </span>
                    {chapterProgress.percentage === 100 && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">
                    {chapter.title}
                  </h3>
                  {chapter.description && (
                    <p className="text-sm text-gray-600 mt-1">{chapter.description}</p>
                  )}
                </div>
              </div>

              <div className="text-right ml-4">
                <div className="text-sm font-medium text-gray-700">
                  {chapterProgress.completed} / {chapterProgress.total} lessons
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className="h-full bg-primary-600 rounded-full transition-all"
                    style={{ width: `${chapterProgress.percentage}%` }}
                  />
                </div>
              </div>
            </button>

            {/* Lessons */}
            {isExpanded && chapter.lessons && chapter.lessons.length > 0 && (
              <div className="divide-y divide-gray-200">
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
