import apiClient from './api';
import type {
  ApiResponse,
  CourseListItem,
  CourseProgress,
  CourseStructure,
  GetVideoUrlResponse,
  Lesson,
  Progress,
  UpdateProgressRequest,
} from '../types';

export const courseService = {
  async getCatalog(): Promise<CourseListItem[]> {
    const response = await apiClient.get<{ items: CourseListItem[] }>('/courses');
    return response.items;
  },

  async getMyCourses(): Promise<CourseListItem[]> {
    const response = await apiClient.get<{ items: CourseListItem[] }>('/me/courses');
    return response.items;
  },

  async getCourseStructure(courseId?: string): Promise<CourseStructure> {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    params.set('_t', Date.now().toString());
    return apiClient.get<CourseStructure>(`/course/structure?${params.toString()}`, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
  },

  async getCourseDetails(courseId: string): Promise<CourseStructure> {
    return apiClient.get<CourseStructure>(`/courses/${courseId}?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
  },

  async getVideoUrl(lessonId: string, quality?: string): Promise<GetVideoUrlResponse> {
    const params = new URLSearchParams();
    if (quality) params.set('quality', quality);
    params.set('_t', Date.now().toString());
    return apiClient.get<GetVideoUrlResponse>(`/course/video/${lessonId}?${params.toString()}`, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
  },

  async getUserProgress(): Promise<CourseProgress> {
    return apiClient.get<CourseProgress>('/progress/user');
  },

  async getCourseProgress(courseId: string): Promise<CourseProgress> {
    return apiClient.get<CourseProgress>(`/me/courses/${courseId}/progress`);
  },

  async updateProgress(data: UpdateProgressRequest): Promise<ApiResponse<Progress>> {
    return apiClient.post<ApiResponse<Progress>>('/progress/update', data);
  },

  async getLessonProgress(lessonId: string): Promise<Progress | null> {
    try {
      return await apiClient.get<Progress>(`/progress/lesson/${lessonId}`);
    } catch {
      return null;
    }
  },

  async markLessonComplete(lessonId: string, totalSeconds?: number): Promise<ApiResponse<Progress>> {
    const sec = totalSeconds && totalSeconds > 0 ? totalSeconds : 1;
    return apiClient.post<ApiResponse<Progress>>('/progress/complete', {
      lesson_id: lessonId,
      completed: true,
      total_seconds: sec,
      watched_seconds: sec,
    });
  },

  async getFreePreviews(): Promise<Lesson[]> {
    return apiClient.get<Lesson[]>('/course/previews');
  },
};
