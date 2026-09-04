import apiClient from './api';
import type {
  AdminCourseRequest,
  AdminStats,
  AdminAccount,
  ApiResponse,
  Chapter,
  Coupon,
  CouponRequest,
  Course,
  Lesson,
  PaginatedResponse,
  PurchaseDetail,
  PurchaseRecord,
  ReorderRequest,
  StudentDetail,
  StudentListItem,
  UpdateStudentRequest,
  UploadVideoRequest,
  UploadVideoResponse,
  UploadImageRequest,
  UploadImageResponse,
  UploadMaterialRequest,
  UploadMaterialResponse,
  CreateChapterRequest,
  CreateLessonRequest,
  User,
  AuditLogsResponse,
} from '../types';

export const adminService = {
  async getUploadUrl(data: UploadVideoRequest): Promise<UploadVideoResponse> {
    return apiClient.post<UploadVideoResponse>('/admin/video/upload', data);
  },

  async getImageUploadUrl(data: UploadImageRequest): Promise<UploadImageResponse> {
    return apiClient.post<UploadImageResponse>('/admin/image/upload', data);
  },

  async getMaterialUploadUrl(data: UploadMaterialRequest): Promise<UploadMaterialResponse> {
    return apiClient.post<UploadMaterialResponse>('/admin/material/upload', data);
  },

  async uploadMaterialToS3(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  },

  async uploadVideoToS3(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
  },

  async uploadImageToS3(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
  },

  async deleteVideo(videoId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/video/${encodeURIComponent(videoId)}`);
  },

  async getCourses(): Promise<Course[]> {
    const response = await apiClient.get<{ items: Course[] }>('/admin/courses');
    return response.items;
  },

  async getAdminAccounts(): Promise<AdminAccount[]> {
    const response = await apiClient.get<{ items: AdminAccount[] }>('/admin/accounts');
    return response.items;
  },

  async createAdminAccount(data: { email: string; full_name: string }): Promise<ApiResponse<AdminAccount>> {
    return apiClient.post<ApiResponse<AdminAccount>>('/admin/account', data);
  },

  async updateAdminAccount(email: string, data: { full_name?: string; enabled?: boolean }): Promise<ApiResponse> {
    return apiClient.patch<ApiResponse>(`/admin/account/${encodeURIComponent(email)}`, data);
  },

  async deleteAdminAccount(email: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/account/${encodeURIComponent(email)}`);
  },

  async resendAdminInvite(email: string): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>(`/admin/account/${encodeURIComponent(email)}/resend-invite`);
  },

  async createCourse(data: AdminCourseRequest): Promise<ApiResponse<Course>> {
    return apiClient.post<ApiResponse<Course>>('/admin/course', data);
  },

  async updateCourse(courseId: string, data: Partial<AdminCourseRequest>): Promise<ApiResponse<Course>> {
    return apiClient.put<ApiResponse<Course>>(`/admin/course/${courseId}`, data);
  },

  async deleteCourse(courseId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/course/${courseId}`);
  },

  async createChapter(data: CreateChapterRequest): Promise<ApiResponse<Chapter>> {
    return apiClient.post<ApiResponse<Chapter>>('/admin/course/chapter', data);
  },

  async updateChapter(chapterId: string, data: Partial<CreateChapterRequest>): Promise<ApiResponse<Chapter>> {
    return apiClient.put<ApiResponse<Chapter>>(`/admin/course/chapter/${chapterId}`, data);
  },

  async deleteChapter(chapterId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/course/chapter/${chapterId}`);
  },

  async createLesson(data: CreateLessonRequest): Promise<ApiResponse<Lesson>> {
    return apiClient.post<ApiResponse<Lesson>>('/admin/course/lesson', data);
  },

  async updateLesson(lessonId: string, data: Partial<CreateLessonRequest>): Promise<ApiResponse<Lesson>> {
    return apiClient.put<ApiResponse<Lesson>>(`/admin/course/lesson/${lessonId}`, data);
  },

  async deleteLesson(lessonId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/course/lesson/${lessonId}`);
  },

  async reorderChapters(data: ReorderRequest): Promise<ApiResponse> {
    return apiClient.put<ApiResponse>('/admin/course/reorder-chapters', data);
  },

  async reorderLessons(data: ReorderRequest): Promise<ApiResponse> {
    return apiClient.put<ApiResponse>('/admin/course/reorder-lessons', data);
  },

  async getStudents(page: number = 1, perPage: number = 50): Promise<PaginatedResponse<StudentListItem>> {
    return apiClient.get<PaginatedResponse<StudentListItem>>(`/admin/students?page=${page}&per_page=${perPage}`);
  },

  async searchStudents(query: string): Promise<StudentListItem[]> {
    return apiClient.get<StudentListItem[]>(`/admin/students/search?q=${encodeURIComponent(query)}`);
  },

  async getStudentDetail(studentId: string): Promise<StudentDetail> {
    return apiClient.get<StudentDetail>(`/admin/student/${studentId}`);
  },

  async createStudent(data: { email: string; full_name: string }): Promise<ApiResponse<User>> {
    return apiClient.post<ApiResponse<User>>('/admin/student/create', data);
  },

  async updateStudent(studentId: string, data: UpdateStudentRequest): Promise<ApiResponse<User>> {
    return apiClient.patch<ApiResponse<User>>(`/admin/student/${studentId}`, data);
  },

  async deleteStudent(studentId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/student/${studentId}`);
  },

  async resendInvite(studentId: string): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>(`/admin/student/${studentId}/resend-invite`);
  },

  async grantCourse(studentId: string, courseId: string): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>(`/admin/student/${studentId}/grant-course`, { course_id: courseId });
  },

  async resetPassword(studentId: string): Promise<ApiResponse> {
    return apiClient.post<ApiResponse>(`/admin/student/${studentId}/reset-password`);
  },

  async getPurchases(filters?: { status?: string; course_id?: string; email?: string; origin?: string }): Promise<PurchaseRecord[]> {
    const query = new URLSearchParams();
    if (filters?.status) {
      query.set('status', filters.status);
    }
    if (filters?.course_id) {
      query.set('course_id', filters.course_id);
    }
    if (filters?.email) {
      query.set('email', filters.email);
    }
    if (filters?.origin) {
      query.set('origin', filters.origin);
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get<{ items: PurchaseRecord[] }>(`/admin/purchases${suffix}`);
    return response.items;
  },

  async getPurchaseDetail(purchaseId: string): Promise<PurchaseDetail> {
    return apiClient.get<PurchaseDetail>(`/admin/purchase/${purchaseId}`);
  },

  async deleteStripeTestPurchase(purchaseId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/purchase/${purchaseId}`);
  },

  async resyncPurchase(purchaseId: string): Promise<ApiResponse<PurchaseRecord>> {
    return apiClient.post<ApiResponse<PurchaseRecord>>(`/admin/purchase/${purchaseId}/resync`);
  },

  async forceUnlockPurchase(purchaseId: string): Promise<ApiResponse<PurchaseRecord>> {
    return apiClient.post<ApiResponse<PurchaseRecord>>(`/admin/purchase/${purchaseId}/unlock`);
  },

  async revokePurchase(purchaseId: string): Promise<ApiResponse<PurchaseRecord>> {
    return apiClient.post<ApiResponse<PurchaseRecord>>(`/admin/purchase/${purchaseId}/revoke`);
  },

  async refundPurchase(purchaseId: string, data: { amount?: number; reason?: string }): Promise<ApiResponse<PurchaseRecord> & { refund_id?: string }> {
    return apiClient.post<ApiResponse<PurchaseRecord> & { refund_id?: string }>(`/admin/purchase/${purchaseId}/refund`, data);
  },

  async markPurchaseVerified(purchaseId: string): Promise<ApiResponse<PurchaseRecord>> {
    return apiClient.post<ApiResponse<PurchaseRecord>>(`/admin/purchase/${purchaseId}/mark-verified`);
  },

  async correctPurchaseEmail(purchaseId: string, data: { email: string; full_name?: string; reason?: string }): Promise<ApiResponse<PurchaseRecord> & { message?: string; account_created?: boolean }> {
    return apiClient.post<ApiResponse<PurchaseRecord> & { message?: string; account_created?: boolean }>(
      `/admin/purchase/${purchaseId}/correct-email`,
      data,
    );
  },

  async getCoupons(): Promise<Coupon[]> {
    const response = await apiClient.get<{ items: Coupon[] }>('/admin/coupons');
    return response.items;
  },

  async createCoupon(data: CouponRequest): Promise<ApiResponse<Coupon>> {
    return apiClient.post<ApiResponse<Coupon>>('/admin/coupon', data);
  },

  async updateCoupon(couponId: string, data: Partial<CouponRequest>): Promise<ApiResponse<Coupon>> {
    return apiClient.put<ApiResponse<Coupon>>(`/admin/coupon/${couponId}`, data);
  },

  async deleteCoupon(couponId: string): Promise<ApiResponse> {
    return apiClient.delete<ApiResponse>(`/admin/coupon/${couponId}`);
  },

  async testCoupon(data: { code: string; course_id?: string; email?: string }): Promise<{ valid: boolean; reason: string; final_total?: number }> {
    return apiClient.post<{ valid: boolean; reason: string; final_total?: number }>('/admin/coupon/test', data);
  },

  async getStats(): Promise<AdminStats> {
    return apiClient.get<AdminStats>('/admin/stats');
  },

  async generateThumbnail(videoKey: string, timestamp: number = 0): Promise<{ thumbnail_url: string; message?: string }> {
    return apiClient.post<{ thumbnail_url: string; message?: string }>('/admin/video/thumbnail', {
      video_s3_key: videoKey,
      timestamp,
    });
  },

  async getAuditLogs(params?: { level?: string; source?: string; search?: string; limit?: number }): Promise<AuditLogsResponse> {
    const query = new URLSearchParams();
    query.set('logs', 'true');
    if (params?.level) query.set('level', params.level);
    if (params?.source) query.set('source', params.source);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    try {
      return await apiClient.get<AuditLogsResponse>(`/admin/stats?${qs}`);
    } catch {
      return await apiClient.get<AuditLogsResponse>(`/admin/audit-logs?${qs}`);
    }
  },
};
