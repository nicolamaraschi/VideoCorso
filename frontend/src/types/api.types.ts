export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Payment API types
export interface CreateCheckoutRequest {
  course_id: string;
  success_url: string;
  cancel_url: string;
}

export interface CreateCheckoutResponse {
  session_id: string;
  checkout_url: string;
}

// Video API types
export interface GetVideoUrlRequest {
  lesson_id: string;
}

export interface GetVideoUrlResponse {
  video_url: string;
  expires_at: string;
}

// Progress API types
export interface UpdateProgressRequest {
  lesson_id: string;
  watched_seconds: number;
  completed?: boolean;
}

export interface UpdateProgressResponse {
  progress: import('./course.types').Progress;
}

// Admin API types
export interface UploadVideoRequest {
  file_name: string;
  file_type: string;
  lesson_id?: string;
}

export interface UploadVideoResponse {
  upload_url: string;
  video_s3_key: string;
  expires_at: string;
}

export interface CreateChapterRequest {
  course_id: string;
  title: string;
  description: string;
  order_number: number;
}

export interface CreateLessonRequest {
  chapter_id: string;
  title: string;
  description: string;
  order_number: number;
  duration_seconds: number;
  video_s3_key: string;
  thumbnail_url?: string;
  is_free_preview?: boolean;
}

export interface ReorderRequest {
  items: Array<{
    id: string;
    order_number: number;
  }>;
}

export interface AdminStats {
  total_students: number;
  active_students: number;
  total_revenue: number;
  new_purchases_today: number;
  new_purchases_week: number;
  new_purchases_month: number;
  total_video_views: number;
  average_completion_rate: number;
  most_viewed_lessons: Array<{
    lesson_id: string;
    title: string;
    views: number;
  }>;
  recent_purchases: Array<{
    purchase_id: string;
    user_email: string;
    amount: number;
    purchase_date: string;
  }>;
  daily_access_chart: Array<{
    date: string;
    unique_users: number;
  }>;
}

export interface StudentListItem {
  user_id: string;
  email: string;
  full_name: string;
  subscription_status: string;
  subscription_end_date: string;
  total_watch_time: number;
  last_login: string;
  purchase_date: string;
  completion_percentage: number;
}

export interface UpdateStudentRequest {
  subscription_end_date?: string;
  subscription_status?: string;
}
