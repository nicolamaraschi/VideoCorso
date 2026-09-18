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
      className={`w-full flex items-center gap-4 sm:gap-6 lg:gap-8 p-3.5 sm:p-5 md:p-6 text-left transition-all duration-200 group ${
        isActive
          ? 'bg-primary-50/80 border-l-4 border-primary-700 shadow-inner'
          : 'hover:bg-primary-50/30 border-l-4 border-transparent'
      } ${isLocked ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Thumbnail Container with Integrated Play/Status Badge */}
      <div className="w-32 sm:w-56 md:w-64 lg:w-72 aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-primary-950 border border-primary-200/80 flex-shrink-0 relative shadow-sm group/thumb">
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt={`Copertina ${lesson.title}`}
            loading="lazy"
            className="w-full h-full object-cover img-smooth group-hover/thumb:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900 to-primary-950 text-primary-300">
            <Play className="w-8 h-8 opacity-60" />
          </div>
        )}

        {/* Hover Play Icon Overlay */}
        {!isLocked && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center text-primary-900 shadow-lg transform scale-90 group-hover/thumb:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        )}

        {/* Video Duration Badge (Bottom-Right overlay) */}
        {lesson.duration_seconds > 0 && (
          <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-white text-[10px] sm:text-xs font-mono font-semibold shadow-xs">
            {formatDuration(lesson.duration_seconds)}
          </div>
        )}

        {/* Status Overlay Badge (Top-Left overlay) */}
        {isLocked ? (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 p-1.5 rounded-lg bg-black/80 backdrop-blur-md text-white shadow-md">
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        ) : isCompleted ? (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-md">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Completata</span>
          </div>
        ) : isActive ? (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-2 py-0.5 rounded-lg bg-primary-700 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-md">
            <Play className="w-3 h-3 fill-current" />
            <span className="hidden sm:inline">In corso</span>
          </div>
        ) : null}

        {/* Bottom watched progress bar inside thumbnail */}
        {!isLocked && !isCompleted && watchedPercentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
            <div
              className="h-full bg-primary-500 shadow-xs"
              style={{ width: `${watchedPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Lesson Content Column */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        {/* Top Metadata: Lesson number + Preview Tag + Attachments */}
        <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-1.5">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary-800 bg-primary-100/90 px-2.5 py-0.5 rounded-md border border-primary-200/60">
            Lezione {lesson.order_number}
          </span>
          {lesson.is_free_preview && (
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              Anteprima Gratuita
            </span>
          )}
          {lesson.attachments && lesson.attachments.length > 0 && (
            <span className="text-xs font-medium text-primary-800 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
              <Paperclip className="w-3 h-3 text-primary-600" />
              <span>{lesson.attachments.length} {lesson.attachments.length === 1 ? 'risorsa scaricabile' : 'risorse scaricabili'}</span>
            </span>
          )}
        </div>

        {/* Lesson Title */}
        <h4
          className={`text-base sm:text-lg md:text-xl font-bold leading-snug break-normal line-clamp-2 ${
            isActive ? 'text-primary-950' : 'text-gray-900 group-hover:text-primary-900'
          } transition-colors`}
        >
          {lesson.title}
        </h4>

        {/* Description */}
        {lesson.description && (
          <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-1.5 line-clamp-2 leading-relaxed">
            {lesson.description}
          </p>
        )}

        {/* Mobile completion badge / resume indicator */}
        <div className="flex sm:hidden items-center gap-2 mt-2">
          {isCompleted ? (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Completata
            </span>
          ) : watchedPercentage > 0 ? (
            <span className="text-xs text-primary-700 font-semibold">
              In corso ({Math.round(watchedPercentage)}%)
            </span>
          ) : null}
        </div>
      </div>

      {/* Desktop Right Action & Status Column */}
      <div className="hidden sm:flex flex-col items-end justify-center flex-shrink-0 gap-2.5 min-w-[130px] pl-2">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-600">
          <Clock className="w-4 h-4 text-primary-600" />
          <span>{formatDuration(lesson.duration_seconds)}</span>
        </div>

        {/* Interactive CTA Pill */}
        {isCompleted ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rivedi</span>
          </span>
        ) : isActive ? (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-700 text-white text-xs font-bold shadow-xs">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>In riproduzione</span>
          </span>
        ) : isLocked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 border border-gray-200 text-xs font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Bloccata</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-primary-900 border border-primary-300 group-hover:bg-primary-700 group-hover:text-white group-hover:border-primary-700 text-xs font-bold transition-all shadow-2xs">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{watchedPercentage > 0 ? 'Riprendi' : 'Guarda'}</span>
          </span>
        )}
      </div>
    </button>
  );
};
