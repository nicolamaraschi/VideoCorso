import React, { useState } from 'react';
import { CourseEditor } from '../components/admin/CourseEditor';
import { useCourse } from '../hooks/useCourse';
import { adminService } from '../services/adminService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const AdminCoursePage: React.FC = () => {
  const { courseStructure, loading, error, reload } = useCourse();
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <Loading fullScreen text="Loading course structure..." />;
  }

  if (error || !courseStructure) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage
          variant="card"
          message={error || 'Failed to load course'}
          onRetry={reload}
        />
      </div>
    );
  }

  const handleCreateChapter = async (data: { title: string; description: string }) => {
    try {
      setSaving(true);
      await adminService.createChapter({
        course_id: courseStructure.course.course_id,
        title: data.title,
        description: data.description,
        order_number: courseStructure.chapters.length + 1,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateChapter = async (chapterId: string, data: any) => {
    try {
      setSaving(true);
      await adminService.updateChapter(chapterId, data);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      setSaving(true);
      await adminService.deleteChapter(chapterId);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLesson = async (chapterId: string, data: any) => {
    try {
      setSaving(true);

      const chapter = courseStructure.chapters.find((c) => c.chapter_id === chapterId);
      const order = (chapter?.lessons?.length || 0) + 1;

      await adminService.createLesson({
        chapter_id: chapterId,
        title: data.title,
        description: data.description,
        order_number: order,
        duration_seconds: data.duration_seconds,
        video_s3_key: data.video_s3_key,
        is_free_preview: data.is_free_preview,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLesson = async (lessonId: string, data: any) => {
    try {
      setSaving(true);
      await adminService.updateLesson(lessonId, data);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      setSaving(true);
      await adminService.deleteLesson(lessonId);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {saving && (
        <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50">
          <Loading size="sm" text="Saving..." />
        </div>
      )}

      <CourseEditor
        chapters={courseStructure.chapters}
        onCreateChapter={handleCreateChapter}
        onUpdateChapter={handleUpdateChapter}
        onDeleteChapter={handleDeleteChapter}
        onCreateLesson={handleCreateLesson}
        onUpdateLesson={handleUpdateLesson}
        onDeleteLesson={handleDeleteLesson}
      />
    </div>
  );
};
