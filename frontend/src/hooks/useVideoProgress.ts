import { useState, useEffect, useRef, useCallback } from 'react';
import { courseService } from '../services/courseService';
import type { Progress } from '../types';

interface UseVideoProgressProps {
  lessonId: string;
  enabled?: boolean;
}

export const useVideoProgress = ({ lessonId, enabled = true }: UseVideoProgressProps) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedTime = useRef<number>(0);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionInFlight = useRef(false);
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);

  const loadProgress = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await courseService.getLessonProgress(lessonId);
      setProgress(data);
      if (data && data.watched_seconds > 0 && !data.completed) {
        setSeekToSeconds(data.watched_seconds);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [enabled, lessonId]);

  const saveProgress = useCallback(async (watchedSeconds: number, totalSeconds: number) => {
    if (!enabled) return;
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
  }, [enabled, lessonId]);

  const markComplete = useCallback(async (watchedSeconds: number, totalSeconds: number) => {
    if (!enabled) return;
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
  }, [enabled, lessonId]);

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

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (!enabled) return;
    if (!progress) return;
    if (Math.abs(currentTime - lastSavedTime.current) >= 300) {
      lastSavedTime.current = currentTime;
      debouncedSave(currentTime, duration);
    }
    if (duration > 0 && currentTime / duration >= 0.9 && !progress.completed && !completionInFlight.current) {
      completionInFlight.current = true;
      void markComplete(currentTime, duration).finally(() => {
        completionInFlight.current = false;
      });
    }
  }, [enabled, progress, debouncedSave, markComplete]);

  const resetProgress = async () => {
    if (!enabled) return;
    try {
      await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: 0,
        completed: false,
      });
      await loadProgress();
    } catch (err) {
      console.error('Failed to reset progress:', err);
    }
  };

  const clearSeekTo = useCallback(() => setSeekToSeconds(null), []);

  return {
    progress,
    isSaving,
    resetProgress,
    handleTimeUpdate,
    saveProgress,
    markComplete,
    seekToSeconds,
    clearSeekTo
  };
};
