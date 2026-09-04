import React from 'react';
import { Play, CheckCircle, Lock, Clock, Paperclip } from 'lucide-react';
import type { Lesson, Progress } from '../../types';
import { formatDuration } from '../../utils/formatters';

interface LessonCardProps {
  lesson: Lesson;
  progress?: Progress;
  isActive?: boolean;
  isLocked?: boolean;
  onClick: () => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  progress,
  isActive = false,
  isLocked = false,
  onClick,
}) => {
  const isCompleted = progress?.completed || false;
  const watchedPercentage = progress && progress.total_seconds > 0
    ? Math.min(100, Math.max(0, (progress.watched_seconds / progress.total_seconds) * 100))
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      className={`w-full flex items-center gap-3 p-2.5 sm:p-4 text-left transition-all ${
        isActive
          ? 'bg-primary-100/70 border-l-4 border-primary-700'
          : 'hover:bg-primary-50/40 border-l-4 border-transparent'
      } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Thumbnail Container with Integrated Play/Status Badge */}
      <div className="w-24 sm:w-44 md:w-52 aspect-video rounded-xl overflow-hidden bg-primary-100 border border-primary-200/80 flex-shrink-0 relative shadow-xs group/thumb">
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt={`Copertina ${lesson.title}`}
            loading="lazy"
            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary-50">
            <Play className="w-5 h-5 text-primary-300" />
          </div>
        )}

        {/* Video Duration Badge (Overlay bottom-right of thumbnail on mobile) */}
        {lesson.duration_seconds > 0 && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[9px] sm:text-[10px] font-mono font-medium leading-none">
            {formatDuration(lesson.duration_seconds)}
          </div>
        )}

        {/* Status Overlay Badge (Top-left of thumbnail) */}
        {isLocked ? (
          <div className="absolute top-1 left-1 w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-black/70 backdrop-blur-xs flex items-center justify-center text-white">
            <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        ) : isCompleted ? (
          <div className="absolute top-1 left-1 w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-emerald-600/90 text-white flex items-center justify-center shadow-xs">
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        ) : isActive ? (
          <div className="absolute top-1 left-1 w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-primary-700 text-white flex items-center justify-center shadow-xs">
            <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
          </div>
        ) : null}

        {/* Bottom watched progress bar inside thumbnail */}
        {!isLocked && !isCompleted && watchedPercentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              className="h-full bg-primary-500"
              style={{ width: `${watchedPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Lesson Content Column (Takes 100% of remaining width with zero cramped wrapping) */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        {/* Top Metadata: Lesson number + Preview Tag + Attachments */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-primary-800">
            Lezione {lesson.order_number}
          </span>
          {lesson.is_free_preview && (
            <span className="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
              Anteprima Gratuita
            </span>
          )}
          {lesson.attachments && lesson.attachments.length > 0 && (
            <span className="text-[10px] sm:text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
              <Paperclip className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>{lesson.attachments.length} {lesson.attachments.length === 1 ? 'risorsa' : 'risorse'}</span>
            </span>
          )}
        </div>

        {/* Lesson Title: Clear, robust, un-hyphenated */}
        <h4
          className={`text-xs sm:text-sm md:text-base font-bold leading-snug break-normal line-clamp-2 ${
            isActive ? 'text-primary-950' : 'text-gray-900 hover:text-primary-900'
          }`}
        >
          {lesson.title}
        </h4>

        {/* Description (Desktop only) */}
        {lesson.description && (
          <p className="hidden sm:block text-xs text-gray-500 mt-1 line-clamp-1">
            {lesson.description}
          </p>
        )}

        {/* Mobile completion badge / resume indicator */}
        <div className="flex sm:hidden items-center gap-2 mt-1">
          {isCompleted ? (
            <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Completata
            </span>
          ) : watchedPercentage > 0 ? (
            <span className="text-[10px] text-primary-700 font-medium">
              In corso ({Math.round(watchedPercentage)}%)
            </span>
          ) : null}
        </div>
      </div>

      {/* Desktop Right Duration Badge */}
      <div className="hidden sm:flex flex-shrink-0 items-center gap-1 text-xs font-medium text-gray-500">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span>{formatDuration(lesson.duration_seconds)}</span>
      </div>
    </button>
  );
};
