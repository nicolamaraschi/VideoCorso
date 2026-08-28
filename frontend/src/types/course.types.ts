export interface CoursePackage {
  package_id: string;
  name: string;
  description?: string;
  price: number;
  discounted_price?: number | null;
  display_order?: number;
  benefits: string[];
  includes_kit: boolean;
  includes_ebook: boolean;
  includes_whatsapp_support: boolean;
  /** null means "support included but duration not yet confirmed" - never
   * assume a duration in the UI when this is null. */
  whatsapp_support_months?: number | null;
  includes_community: boolean;
  live_meetings_count: number;
}

export interface Course {
  course_id: string;
  title: string;
  description: string;
  subtitle?: string;
  short_description?: string;
  long_description?: string;
  price: number;
  discounted_price?: number | null;
  cover_image_url?: string;
  status?: 'draft' | 'published' | 'hidden' | 'archived';
  is_purchasable?: boolean;
  public_slug?: string;
  display_order?: number;
  badge?: '' | 'bestseller' | 'new' | 'sale';
  created_at: string;
  updated_at: string;
  is_active: boolean;
  has_access?: boolean;
  /** Commercial tiers (e.g. Basic/Intermedio/Avanzato). All packages of a
   * course grant identical lesson access; they differ only in price and
   * included benefits. Empty when the course uses the legacy flat price. */
  packages?: CoursePackage[];
}

export interface Chapter {
  chapter_id: string;
  course_id: string;
  order_number: number;
  title: string;
  description: string;
  image_url?: string;
  created_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  lesson_id: string;
  chapter_id: string;
  order_number: number;
  title: string;
  description: string;
  duration_seconds: number;
  video_s3_key: string;
  thumbnail_url: string;
  created_at: string;
  is_free_preview?: boolean;
}

export interface Progress {
  progress_id: string;
  user_id: string;
  lesson_id: string;
  watched_seconds: number;
  total_seconds: number;
  completed: boolean;
  last_watched: string;
}

export interface CourseStructure {
  course: Course;
  chapters: Chapter[];
}

export interface CourseListItem extends Course {
  access_granted_by?: 'purchase' | 'global_access';
  purchase?: import('./user.types').PurchaseRecord | null;
}

export interface VideoPlayerData {
  lesson: Lesson;
  videoUrl: string;
  progress?: Progress;
}

export interface ChapterProgress {
  chapter_id: string;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
}

export interface CourseProgress {
  course_id?: string;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
  chapters: ChapterProgress[];
  last_watched_lesson?: Lesson;
  lesson_progress: Record<string, Progress>;
  total_watch_time: number;
}
