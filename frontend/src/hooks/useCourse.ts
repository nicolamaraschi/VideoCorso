import { useState, useEffect } from 'react';
import { courseService } from '../services/courseService';
import type { CourseStructure, CourseProgress, Progress } from '../types';
import { useAuthContext } from '../components/auth/AuthContext';

export const useCourse = () => {
  const { isAuthenticated } = useAuthContext();
  const [courseStructure, setCourseStructure] = useState<CourseStructure | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Carichiamo i dati solo se l'utente è autenticato
    // (tranne la struttura base che potrebbe servire pubblica, ma per ora la leghiamo all'auth)
    if (isAuthenticated) {
      loadCourse();
    } else {
      // Se non autenticato, carichiamo solo la struttura (o gestiamo diversamente)
      loadStructureOnly();
    }
  }, [isAuthenticated]); // Ricarica quando lo stato di auth cambia

  const loadStructureOnly = async () => {
     try {
      setLoading(true);
      setError(null);
      const structure = await courseService.getCourseStructure();
      setCourseStructure(structure);
    } catch (err: any) {
      setError(err.message || 'Failed to load course structure');
    } finally {
      setLoading(false);
    }
  }

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError(null);

      // Eseguiamo in parallelo
      const [structure, progress] = await Promise.all([
        courseService.getCourseStructure(),
        courseService.getUserProgress().catch(() => null), // Non bloccare tutto se il progresso fallisce
      ]);

      setCourseStructure(structure);
      setCourseProgress(progress);
    } catch (err: any) {
      setError(err.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const refreshProgress = async () => {
    try {
      const progress = await courseService.getUserProgress();
      setCourseProgress(progress);
    } catch (err: any) {
      console.error('Failed to refresh progress:', err);
    }
  };

  // ... (il resto delle funzioni helper rimane invariato)

  const getLessonById = (lessonId: string) => {
    if (!courseStructure) return null;

    for (const chapter of courseStructure.chapters) {
      const lesson = chapter.lessons?.find((l) => l.lesson_id === lessonId);
      if (lesson) return lesson;
    }

    return null;
  };

  const getChapterById = (chapterId: string) => {
    return courseStructure?.chapters.find((c) => c.chapter_id === chapterId) || null;
  };

  const getNextLesson = (currentLessonId: string) => {
    if (!courseStructure) return null;

    let foundCurrent = false;

    for (const chapter of courseStructure.chapters) {
      if (!chapter.lessons) continue;

      for (const lesson of chapter.lessons) {
        if (foundCurrent) {
          return lesson;
        }
        if (lesson.lesson_id === currentLessonId) {
          foundCurrent = true;
        }
      }
    }

    return null;
  };

  const getPreviousLesson = (currentLessonId: string) => {
    if (!courseStructure) return null;

    let previousLesson = null;

    for (const chapter of courseStructure.chapters) {
      if (!chapter.lessons) continue;

      for (const lesson of chapter.lessons) {
        if (lesson.lesson_id === currentLessonId) {
          return previousLesson;
        }
        previousLesson = lesson;
      }
    }

    return null;
  };

  return {
    courseStructure,
    courseProgress,
    loading,
    error,
    refreshProgress,
    getLessonById,
    getChapterById,
    getNextLesson,
    getPreviousLesson,
    reload: loadCourse,
  };
};