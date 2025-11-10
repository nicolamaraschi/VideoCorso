export interface Course {
  course_id: string;
  title: string;
  description: string;
  price: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Chapter {
  chapter_id: string;
  course_id: string;
  order_number: number;
  title: string;
  description: string;
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
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
  chapters: ChapterProgress[];
  last_watched_lesson?: Lesson;
  lesson_progress: Record<string, Progress>; // <--- AGGIUNTO
  total_watch_time: number; // <--- AGGIUNTO
}