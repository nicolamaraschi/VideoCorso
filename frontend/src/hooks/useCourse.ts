import { useCallback, useEffect, useState } from 'react';
import { courseService } from '../services/courseService';
import type { CourseProgress, CourseStructure, Lesson } from '../types';
import { useAuthContext } from '../components/auth/useAuthContext';
import { getErrorMessage } from '../utils/errors';

export const useCourse = (courseId?: string) => {
  const { isAuthenticated } = useAuthContext();
  const [courseStructure, setCourseStructure] = useState<CourseStructure | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const structure = await courseService.getCourseStructure(courseId);
      setCourseStructure(structure);

      if (isAuthenticated && structure.course.has_access) {
        const progress = await courseService.getCourseProgress(structure.course.course_id).catch(() => null);
        setCourseProgress(progress);
      } else {
        setCourseProgress(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load course'));
    } finally {
      setLoading(false);
    }
  }, [courseId, isAuthenticated]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const refreshProgress = async () => {
    if (!courseStructure?.course.course_id || !courseStructure.course.has_access) {
      return;
    }
    try {
      const progress = await courseService.getCourseProgress(courseStructure.course.course_id);
      setCourseProgress(progress);
    } catch (err) {
      console.error('Failed to refresh progress:', err);
    }
  };

  const getLessonById = (lessonId: string): Lesson | null => {
    if (!courseStructure) {
      return null;
    }

    for (const chapter of courseStructure.chapters) {
      const lesson = chapter.lessons?.find((item) => item.lesson_id === lessonId);
      if (lesson) {
        return lesson;
      }
    }

    return null;
  };

  const getNextLesson = (currentLessonId: string): Lesson | null => {
    if (!courseStructure) {
      return null;
    }

    let foundCurrent = false;
    for (const chapter of courseStructure.chapters) {
      for (const lesson of chapter.lessons || []) {
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

  const getPreviousLesson = (currentLessonId: string): Lesson | null => {
    if (!courseStructure) {
      return null;
    }

    let previousLesson: Lesson | null = null;
    for (const chapter of courseStructure.chapters) {
      for (const lesson of chapter.lessons || []) {
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
    reload: loadCourse,
    refreshProgress,
    getLessonById,
    getNextLesson,
    getPreviousLesson,
  };
};
