import React from 'react';
import { Play, CheckCircle, Circle, Lock, Clock } from 'lucide-react';
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
  const watchedPercentage = progress
    ? (progress.watched_seconds / progress.total_seconds) * 100
    : 0;

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${
        isActive
          ? 'bg-primary-50 border-l-4 border-primary-600'
          : 'hover:bg-gray-50 border-l-4 border-transparent'
      } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isLocked ? (
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-gray-500" />
          </div>
        ) : isCompleted ? (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            {watchedPercentage > 0 ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className="text-primary-600"
                    strokeDasharray={`${watchedPercentage} 100`}
                  />
                </svg>
                <Play className="w-4 h-4 text-primary-600" />
              </div>
            ) : (
              <Circle className="w-5 h-5 text-gray-400" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500">
            Lesson {lesson.order_number}
          </span>
          {lesson.is_free_preview && (
            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
              Free Preview
            </span>
          )}
        </div>
        <h4
          className={`font-medium ${
            isActive ? 'text-primary-700' : 'text-gray-900'
          } truncate`}
        >
          {lesson.title}
        </h4>
        {lesson.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {lesson.description}
          </p>
        )}

        {/* Progress Bar */}
        {!isLocked && !isCompleted && watchedPercentage > 0 && (
          <div className="mt-2">
            <div className="w-full h-1 bg-gray-200 rounded-full">
              <div
                className="h-full bg-primary-600 rounded-full transition-all"
                style={{ width: `${watchedPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="flex-shrink-0 flex items-center gap-1 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        <span>{formatDuration(lesson.duration_seconds)}</span>
      </div>
    </button>
  );
};
