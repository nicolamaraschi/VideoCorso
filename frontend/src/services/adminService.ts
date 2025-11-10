import apiClient from './api';
import {
  UploadVideoRequest,
  UploadVideoResponse,
  CreateChapterRequest,
  CreateLessonRequest,
  ReorderRequest,
  AdminStats,
  StudentListItem,
  UpdateStudentRequest,
  ApiResponse,
  PaginatedResponse,
  Chapter,
  Lesson,
} from '../types';

export const adminService = {
  // Video Management
  async getUploadUrl(data: UploadVideoRequest): Promise<UploadVideoResponse> {
    return apiClient.post<UploadVideoResponse>('/admin/video/upload', data);
  },

  async uploadVideoToS3(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
  },

  async deleteVideo(videoId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/video/${videoId}`);
  },

  // Chapter Management
  async createChapter(data: CreateChapterRequest): Promise<ApiResponse<Chapter>> {
    return apiClient.post<ApiResponse<Chapter>>('/admin/course/chapter', data);
  },

  async updateChapter(chapterId: string, data: Partial<CreateChapterRequest>): Promise<ApiResponse<Chapter>> {
    return apiClient.put<ApiResponse<Chapter>>(`/admin/course/chapter/${chapterId}`, data);
  },

  async deleteChapter(chapterId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/course/chapter/${chapterId}`);
  },

  // Lesson Management
  async createLesson(data: CreateLessonRequest): Promise<ApiResponse<Lesson>> {
    return apiClient.post<ApiResponse<Lesson>>('/admin/course/lesson', data);
  },

  async updateLesson(lessonId: string, data: Partial<CreateLessonRequest>): Promise<ApiResponse<Lesson>> {
    return apiClient.put<ApiResponse<Lesson>>(`/admin/course/lesson/${lessonId}`, data);
  },

  async deleteLesson(lessonId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/course/lesson/${lessonId}`);
  },

  // Reordering
  async reorderChapters(data: ReorderRequest): Promise<ApiResponse> {
    return apiClient.put<ApiResponse>('/admin/course/reorder-chapters', data);
  },

  async reorderLessons(data: ReorderRequest): Promise<ApiResponse> {
    return apiClient.put<ApiResponse>('/admin/course/reorder-lessons', data);
  },

  // Student Management
  async getStudents(page: number = 1, perPage: number = 20): Promise<PaginatedResponse<StudentListItem>> {
    return apiClient.get<PaginatedResponse<StudentListItem>>(`/admin/students?page=${page}&per_page=${perPage}`);
  },

  async updateStudent(studentId: string, data: UpdateStudentRequest): Promise<ApiResponse> {
    return apiClient.patch<ApiResponse>(`/admin/student/${studentId}`, data);
  },

  async searchStudents(query: string): Promise<StudentListItem[]> {
    return apiClient.get<StudentListItem[]>(`/admin/students/search?q=${encodeURIComponent(query)}`);
  },

  // Statistics
  async getStats(): Promise<AdminStats> {
    return apiClient.get<AdminStats>('/admin/stats');
  },

  // Generate thumbnail from video
  async generateThumbnail(videoKey: string, timestamp: number = 0): Promise<{ thumbnail_url: string }> {
    return apiClient.post<{ thumbnail_url: string }>('/admin/video/thumbnail', {
      video_s3_key: videoKey,
      timestamp,
    });
  },
};
