import { useState, useEffect, useRef, useCallback } from 'react';
import { courseService } from '../services/courseService';
import { Progress } from '../types';

interface UseVideoProgressProps {
  lessonId: string;
  videoElement: HTMLVideoElement | null;
}

export const useVideoProgress = ({ lessonId, videoElement }: UseVideoProgressProps) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedTime = useRef<number>(0);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProgress();
  }, [lessonId]);

  useEffect(() => {
    if (!videoElement || !progress) return;

    // Set initial playback position
    if (progress.watched_seconds > 0 && videoElement.currentTime === 0) {
      videoElement.currentTime = progress.watched_seconds;
    }

    const handleTimeUpdate = () => {
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      // Save progress every 5 seconds
      if (Math.abs(currentTime - lastSavedTime.current) >= 5) {
        lastSavedTime.current = currentTime;
        debouncedSave(currentTime, duration);
      }

      // Auto-complete at 90% watched
      if (duration > 0 && currentTime / duration >= 0.9 && !progress.completed) {
        markComplete(currentTime, duration);
      }
    };

    const handlePause = () => {
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;
      saveProgress(currentTime, duration);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('pause', handlePause);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('pause', handlePause);

      // Save on unmount
      if (videoElement.currentTime > 0) {
        saveProgress(videoElement.currentTime, videoElement.duration);
      }
    };
  }, [videoElement, progress, lessonId]);

  const loadProgress = async () => {
    try {
      const data = await courseService.getLessonProgress(lessonId);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  };

  const debouncedSave = useCallback((watchedSeconds: number, totalSeconds: number) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      saveProgress(watchedSeconds, totalSeconds);
    }, 1000);
  }, [lessonId]);

  const saveProgress = async (watchedSeconds: number, totalSeconds: number) => {
    try {
      setIsSaving(true);

      const response = await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: Math.floor(watchedSeconds),
        completed: false,
      });

      if (response.data) {
        setProgress(response.data);
      }
    } catch (err) {
      console.error('Failed to save progress:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const markComplete = async (watchedSeconds: number, totalSeconds: number) => {
    try {
      setIsSaving(true);

      const response = await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: Math.floor(watchedSeconds),
        completed: true,
      });

      if (response.data) {
        setProgress(response.data);
      }
    } catch (err) {
      console.error('Failed to mark complete:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const resetProgress = async () => {
    try {
      await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: 0,
        completed: false,
      });

      await loadProgress();

      if (videoElement) {
        videoElement.currentTime = 0;
      }
    } catch (err) {
      console.error('Failed to reset progress:', err);
    }
  };

  return {
    progress,
    isSaving,
    resetProgress,
    markComplete: () => {
      if (videoElement) {
        markComplete(videoElement.currentTime, videoElement.duration);
      }
    },
  };
};
