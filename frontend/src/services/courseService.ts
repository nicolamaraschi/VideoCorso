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
    const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
    return apiClient.get<CourseStructure>(`/course/structure${query}`);
  },

  async getCourseDetails(courseId: string): Promise<CourseStructure> {
    return apiClient.get<CourseStructure>(`/courses/${courseId}`);
  },

  async getVideoUrl(lessonId: string, quality?: string): Promise<GetVideoUrlResponse> {
    const query = quality ? `?quality=${encodeURIComponent(quality)}` : '';
    return apiClient.get<GetVideoUrlResponse>(`/course/video/${lessonId}${query}`);
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
    return apiClient.post<ApiResponse<Progress>>('/progress/complete', {
      lesson_id: lessonId,
      completed: true,
      total_seconds: totalSeconds,
      watched_seconds: totalSeconds,
    });
  },

  async getFreePreviews(): Promise<Lesson[]> {
    return apiClient.get<Lesson[]>('/course/previews');
  },
};
