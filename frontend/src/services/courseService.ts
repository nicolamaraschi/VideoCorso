import apiClient from './api';
import {
  CourseStructure,
  Progress,
  CourseProgress,
  GetVideoUrlResponse,
  UpdateProgressRequest,
  ApiResponse,
} from '../types';

export const courseService = {
  // Get complete course structure with chapters and lessons
  async getCourseStructure(): Promise<CourseStructure> {
    return apiClient.get<CourseStructure>('/course/structure');
  },

  // Get signed URL for video streaming
  async getVideoUrl(lessonId: string): Promise<GetVideoUrlResponse> {
    return apiClient.get<GetVideoUrlResponse>(`/course/video/${lessonId}`);
  },

  // Get user's overall course progress
  async getUserProgress(): Promise<CourseProgress> {
    return apiClient.get<CourseProgress>('/progress/user');
  },

  // Update lesson progress
  async updateProgress(data: UpdateProgressRequest): Promise<ApiResponse<Progress>> {
    return apiClient.post<ApiResponse<Progress>>('/progress/update', data);
  },

  // Get progress for specific lesson
  async getLessonProgress(lessonId: string): Promise<Progress | null> {
    try {
      return apiClient.get<Progress>(`/progress/lesson/${lessonId}`);
    } catch (error) {
      return null;
    }
  },

  // Mark lesson as completed
  async markLessonComplete(lessonId: string): Promise<ApiResponse<Progress>> {
    return apiClient.post<ApiResponse<Progress>>('/progress/complete', {
      lesson_id: lessonId,
      completed: true,
    });
  },

  // Get free preview lessons (no auth required)
  async getFreePreviews(): Promise<any> {
    return apiClient.get<any>('/course/previews');
  },
};
