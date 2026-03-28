import { useState, useEffect, useRef, useCallback } from 'react';
import { courseService } from '../services/courseService';
import type { Progress } from '../types';

interface UseVideoProgressProps {
  lessonId: string;
  videoElement: HTMLVideoElement | null;
}

export const useVideoProgress = ({ lessonId, videoElement }: UseVideoProgressProps) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedTime = useRef<number>(0);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadProgress = useCallback(async () => {
    try {
      const data = await courseService.getLessonProgress(lessonId);
      setProgress(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [lessonId]);

  const saveProgress = useCallback(async (watchedSeconds: number, totalSeconds: number) => {
    try {
      setIsSaving(true);

      const response = await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: Math.floor(watchedSeconds),
        total_seconds: Math.floor(totalSeconds),
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
  }, [lessonId]);

  const markComplete = useCallback(async (watchedSeconds: number, totalSeconds: number) => {
    try {
      setIsSaving(true);

      const response = await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: Math.floor(watchedSeconds),
        total_seconds: Math.floor(totalSeconds),
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
  }, [lessonId]);

  const debouncedSave = useCallback((watchedSeconds: number, totalSeconds: number) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      void saveProgress(watchedSeconds, totalSeconds);
    }, 1000);
  }, [saveProgress]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    if (!videoElement || !progress) return;

    // Set initial playback position
    // Only resume if NOT completed. If completed, start from beginning.
    if (progress.watched_seconds > 0 && videoElement.currentTime === 0 && !progress.completed) {
      videoElement.currentTime = progress.watched_seconds;
    }

    const handleTimeUpdate = () => {
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      // Save progress every 300 seconds instead of 5
      if (Math.abs(currentTime - lastSavedTime.current) >= 300) {
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
  }, [videoElement, progress, debouncedSave, markComplete, saveProgress]);

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
        void markComplete(videoElement.currentTime, videoElement.duration);
      }
    },
  };
};
