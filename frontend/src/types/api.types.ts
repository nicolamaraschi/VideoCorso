export interface ApiResponse<T = unknown> {
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

export interface ShippingAddress {
  full_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code: string;
  province?: string;
  country: string;
  phone?: string;
}

// Payment API types
export interface CreateCheckoutRequest {
  checkout_request_id: string;
  course_id: string;
  success_url: string;
  cancel_url: string;
  email?: string;
  coupon_code?: string;
  /** Required when the course has packages (see Course.packages). */
  package_id?: string;
  /** Required only when the selected package includes a physical kit. */
  shipping_address?: ShippingAddress;
  terms_accepted: boolean;
  digital_content_consent: boolean;
  terms_version: string;
}

export interface CreateCheckoutResponse {
  session_id: string;
  checkout_url: string;
  purchase_id?: string;
  is_free_access?: boolean;
}

export interface PaymentVerification {
  session_id: string;
  payment_state: 'paid' | 'pending' | 'expired';
  payment_status: string;
  checkout_status: string;
  access_state: 'active' | 'processing' | 'not_available';
  local_status?: string | null;
  course_id?: string;
  course_title?: string;
}

// Video API types
export interface GetVideoUrlRequest {
  lesson_id: string;
}

export interface GetVideoUrlResponse {
  video_url: string;
  expires_at: string;
  video_quality?: string;
  available_qualities?: string[];
}

export type VideoQuality = '1080p' | '720p' | '480p' | '360p' | 'high' | 'medium' | 'low';

// Progress API types
export interface UpdateProgressRequest {
  lesson_id: string;
  watched_seconds: number;
  total_seconds?: number;
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

export interface UploadImageRequest {
  file_name: string;
  file_type: string;
  folder?: string;
}

export interface UploadImageResponse {
  upload_url: string;
  image_s3_key: string;
  image_url: string;
  expires_at: string;
}

export interface AdminCourseRequest {
  title: string;
  description: string;
  subtitle?: string;
  short_description?: string;
  long_description?: string;
  price: number;
  discounted_price?: number | null;
  cover_image_url?: string;
  status?: 'draft' | 'published' | 'hidden' | 'archived';
  is_active: boolean;
  is_purchasable?: boolean;
  public_slug?: string;
  display_order?: number;
  badge?: '' | 'bestseller' | 'new' | 'sale';
  packages?: import('./course.types').CoursePackage[];
}

export interface CreateChapterRequest {
  course_id: string;
  title: string;
  description: string;
  image_url?: string;
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
    status?: string;
  }>;
  daily_access_chart: Array<{
    date: string;
    active_users: number;
    revenue?: number;
    orders_count?: number;
    lessons_completed?: number;
  }>;
  active_students_last_7_days: number;
  revenue_last_30_days: number;
  attention_items: Array<{
    id: string;
    severity: 'urgent' | 'attention';
    title: string;
    description: string;
    action_label: string;
    action_url: string;
  }>;
  course_health: Array<{
    course_id: string;
    title: string;
    enrolled_students: number;
    active_students_last_7_days: number;
    average_completion_rate: number;
  }>;
  _debug_dates?: string[];
}

export interface UpdateStudentRequest {
  subscription_end_date?: string;
  subscription_status?: string;
  full_name?: string;
  global_access?: boolean;
}

export interface CouponRequest {
  code: string;
  course_scope: string[];
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  starts_at?: string | null;
  expires_at?: string | null;
  max_redemptions?: number | null;
  allowed_user_emails: string[];
  is_active: boolean;
  is_free_access: boolean;
}

export interface AuditLogEntry {
  audit_id: string;
  created_at: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  source?: string;
  admin_email?: string;
  actor?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  error_message?: string;
  stack_trace?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  server_time?: string;
}

