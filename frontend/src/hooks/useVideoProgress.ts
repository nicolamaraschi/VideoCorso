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
  const progressRef = useRef<Progress | null>(null);
  const lastSavedTime = useRef<number>(0);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionInFlight = useRef(false);
  const lifecycleIdRef = useRef(0);
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);

  const loadProgress = useCallback(async () => {
    if (!enabled) return;
    const lifecycleId = lifecycleIdRef.current;
    try {
      const data = await courseService.getLessonProgress(lessonId);
      if (lifecycleId !== lifecycleIdRef.current) return;
      progressRef.current = data;
      setProgress(data);
      lastSavedTime.current = data?.watched_seconds || 0;
      if (data && data.watched_seconds > 0 && !data.completed) {
        setSeekToSeconds(data.watched_seconds);
      }
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [enabled, lessonId]);

  const saveProgress = useCallback(async (watchedSeconds: number, totalSeconds: number) => {
    if (!enabled || watchedSeconds <= 0 || totalSeconds <= 0) return false;
    const lifecycleId = lifecycleIdRef.current;
    try {
      setIsSaving(true);
      const response = await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: Math.floor(watchedSeconds),
        total_seconds: Math.floor(totalSeconds),
        completed: false,
      });
      if (response.data && lifecycleId === lifecycleIdRef.current) {
        progressRef.current = response.data;
        setProgress(response.data);
      }
      return true;
    } catch (err) {
      console.error('Failed to save progress:', err);
      return false;
    } finally {
      if (lifecycleId === lifecycleIdRef.current) setIsSaving(false);
    }
  }, [enabled, lessonId]);

  const markComplete = useCallback(async (watchedSeconds: number, totalSeconds: number) => {
    if (!enabled || totalSeconds <= 0) return;
    const lifecycleId = lifecycleIdRef.current;
    try {
      setIsSaving(true);
      const response = await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: Math.floor(watchedSeconds),
        total_seconds: Math.floor(totalSeconds),
        completed: true,
      });
      if (response.data && lifecycleId === lifecycleIdRef.current) {
        progressRef.current = response.data;
        setProgress(response.data);
      }
    } catch (err) {
      console.error('Failed to mark complete:', err);
    } finally {
      if (lifecycleId === lifecycleIdRef.current) setIsSaving(false);
    }
  }, [enabled, lessonId]);

  const debouncedSave = useCallback((watchedSeconds: number, totalSeconds: number) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(() => {
      saveTimeout.current = null;
      void saveProgress(watchedSeconds, totalSeconds).then((saved) => {
        if (!saved && lastSavedTime.current === watchedSeconds) {
          lastSavedTime.current = progressRef.current?.watched_seconds || 0;
        }
      });
    }, 1000);
  }, [saveProgress]);

  useEffect(() => {
    lifecycleIdRef.current += 1;
    progressRef.current = null;
    lastSavedTime.current = 0;
    completionInFlight.current = false;
    setProgress(null);
    setSeekToSeconds(null);
    setIsSaving(false);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    void loadProgress();
    return () => {
      lifecycleIdRef.current += 1;
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
    };
  }, [loadProgress]);

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (!enabled || currentTime <= 0 || duration <= 0) return;
    // Save often enough that a refresh/recovery never throws away several
    // minutes of viewing, without flooding the API on every timeupdate event.
    if (Math.abs(currentTime - lastSavedTime.current) >= 30) {
      lastSavedTime.current = currentTime;
      debouncedSave(currentTime, duration);
    }
    if (
      currentTime / duration >= 0.9 &&
      !progressRef.current?.completed &&
      !completionInFlight.current
    ) {
      completionInFlight.current = true;
      void markComplete(currentTime, duration).finally(() => {
        completionInFlight.current = false;
      });
    }
  }, [enabled, debouncedSave, markComplete]);

  const flushProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!enabled || currentTime <= 0 || duration <= 0) return;
    const hadPendingSave = saveTimeout.current !== null;
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    // Ignore duplicate pause/pagehide events emitted by the same browser
    // transition, but persist even a short first viewing session.
    if (!hadPendingSave && Math.abs(currentTime - lastSavedTime.current) < 2) return;
    lastSavedTime.current = currentTime;
    const saved = await saveProgress(currentTime, duration);
    if (!saved && lastSavedTime.current === currentTime) {
      lastSavedTime.current = progressRef.current?.watched_seconds || 0;
    }
  }, [enabled, saveProgress]);

  const resetProgress = async () => {
    if (!enabled) return;
    try {
      await courseService.updateProgress({
        lesson_id: lessonId,
        watched_seconds: 0,
        completed: false,
      });
      progressRef.current = null;
      lastSavedTime.current = 0;
      completionInFlight.current = false;
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
    flushProgress,
    markComplete,
    seekToSeconds,
    clearSeekTo
  };
};
