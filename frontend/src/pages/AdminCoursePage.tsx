import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { CourseEditor } from '../components/admin/CourseEditor';
import { useCourse } from '../hooks/useCourse';
import { adminService } from '../services/adminService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import type { AdminCourseRequest, Chapter, Course, Lesson } from '../types';
import { getErrorMessage } from '../utils/errors';

type LessonEditorPayload = Pick<Lesson, 'title' | 'description' | 'duration_seconds' | 'video_s3_key'> & {
  is_free_preview?: boolean;
};

const emptyCourseForm: AdminCourseRequest = {
  title: '',
  description: '',
  subtitle: '',
  short_description: '',
  long_description: '',
  price: 0,
  discounted_price: null,
  cover_image_url: '',
  status: 'draft',
  is_active: false,
  is_purchasable: false,
  public_slug: '',
  display_order: 999,
  badge: '',
};

export const AdminCoursePage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<AdminCourseRequest>(emptyCourseForm);
  const [isCreating, setIsCreating] = useState(false);

  const { courseStructure, loading, error, reload } = useCourse(selectedCourseId || undefined);

  const hydrateCourseForm = (course: Course) => {
    setCourseForm({
      title: course.title,
      description: course.description,
      subtitle: course.subtitle || '',
      short_description: course.short_description || course.description || '',
      long_description: course.long_description || course.description || '',
      price: Number(course.price || 0),
      discounted_price: course.discounted_price ?? null,
      cover_image_url: course.cover_image_url || '',
      status: course.status || (course.is_active ? 'published' : 'hidden'),
      is_active: course.is_active,
      is_purchasable: course.is_purchasable ?? course.is_active,
      public_slug: course.public_slug || course.course_id,
      display_order: course.display_order ?? 999,
      badge: course.badge || '',
    });
  };

  const loadCourses = useCallback(async () => {
    try {
      setPageError(null);
      const response = await adminService.getCourses();
      setCourses(response);
      if (!selectedCourseId && response.length > 0) {
        setSelectedCourseId(response[0].course_id);
      }
    } catch (err) {
      setPageError(getErrorMessage(err, 'Failed to load courses'));
    }
  }, [selectedCourseId]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (courseStructure?.course && !isCreating) {
      hydrateCourseForm(courseStructure.course);
    }
  }, [courseStructure, isCreating]);

  const updateCourseField = <K extends keyof AdminCourseRequest>(key: K, value: AdminCourseRequest[K]) => {
    setCourseForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCourse = async () => {
    if (!selectedCourseId) {
      return;
    }
    try {
      setSaving(true);
      await adminService.updateCourse(selectedCourseId, {
        ...courseForm,
        is_active: courseForm.status === 'published',
      });
      await Promise.all([loadCourses(), reload()]);
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to save course settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseForm.title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      setSaving(true);
      const response = await adminService.createCourse({
        ...courseForm,
        is_active: courseForm.status === 'published',
      });
      const created = response.data;
      await loadCourses();
      if (created?.course_id) {
        setSelectedCourseId(created.course_id);
        setIsCreating(false);
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to create course'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChapter = async (data: { title: string; description: string }) => {
    if (!courseStructure) {
      return;
    }
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

  const handleUpdateChapter = async (chapterId: string, data: Partial<Chapter>) => {
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

  const handleCreateLesson = async (chapterId: string, data: LessonEditorPayload) => {
    if (!courseStructure) {
      return;
    }
    try {
      setSaving(true);
      const chapter = courseStructure.chapters.find((item) => item.chapter_id === chapterId);
      await adminService.createLesson({
        chapter_id: chapterId,
        title: data.title,
        description: data.description,
        order_number: (chapter?.lessons?.length || 0) + 1,
        duration_seconds: data.duration_seconds,
        video_s3_key: data.video_s3_key,
        is_free_preview: data.is_free_preview,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLesson = async (lessonId: string, data: Partial<LessonEditorPayload>) => {
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

  const handleReorderChapters = async (items: { id: string; order_number: number }[]) => {
    try {
      setSaving(true);
      await adminService.reorderChapters({ items });
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleReorderLessons = async (items: { id: string; order_number: number }[]) => {
    try {
      setSaving(true);
      await adminService.reorderLessons({ items });
      await reload();
    } finally {
      setSaving(false);
    }
  };

  if (pageError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorMessage variant="card" message={pageError} onRetry={loadCourses} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {saving && (
        <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50">
          <Loading size="sm" text="Saving..." />
        </div>
      )}

      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="flex-1 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedCourseId}
                onChange={(event) => {
                  setSelectedCourseId(event.target.value);
                  setIsCreating(false);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.title} • {course.status || 'draft'}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreating(true);
                  setCourseForm({
                    ...emptyCourseForm,
                    public_slug: `corso-${Date.now()}`,
                  });
                }}
              >
                Nuovo corso
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={courseForm.title}
                onChange={(event) => updateCourseField('title', event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Titolo corso"
              />
              <input
                type="text"
                value={courseForm.subtitle || ''}
                onChange={(event) => updateCourseField('subtitle', event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Subtitle"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="number"
                min="0"
                step="0.01"
                value={courseForm.price}
                onChange={(event) => updateCourseField('price', Number(event.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Prezzo"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={courseForm.discounted_price ?? ''}
                onChange={(event) => updateCourseField('discounted_price', event.target.value === '' ? null : Number(event.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Prezzo scontato"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={courseForm.display_order ?? 999}
                onChange={(event) => updateCourseField('display_order', Number(event.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Posizione vetrina"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={courseForm.status || 'draft'}
                onChange={(event) => {
                  const status = event.target.value as AdminCourseRequest['status'];
                  updateCourseField('status', status);
                  updateCourseField('is_active', status === 'published');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="draft">Bozza</option>
                <option value="published">Pubblicato</option>
                <option value="hidden">Nascosto</option>
                <option value="archived">Archiviato</option>
              </select>

              <select
                value={courseForm.badge || ''}
                onChange={(event) => updateCourseField('badge', event.target.value as AdminCourseRequest['badge'])}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Nessun badge</option>
                <option value="bestseller">Bestseller</option>
                <option value="new">Nuovo</option>
                <option value="sale">In offerta</option>
              </select>

              <input
                type="text"
                value={courseForm.public_slug || ''}
                onChange={(event) => updateCourseField('public_slug', event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Slug pubblico"
              />
            </div>

            <input
              type="text"
              value={courseForm.cover_image_url || ''}
              onChange={(event) => updateCourseField('cover_image_url', event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="URL immagine copertina"
            />

            <input
              type="text"
              value={courseForm.short_description || ''}
              onChange={(event) => {
                updateCourseField('short_description', event.target.value);
                updateCourseField('description', event.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Descrizione breve"
            />

            <textarea
              value={courseForm.long_description || ''}
              onChange={(event) => updateCourseField('long_description', event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[140px]"
              placeholder="Descrizione lunga / sales copy"
            />

            <div className="flex flex-wrap gap-6 text-sm text-gray-700">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={courseForm.is_purchasable ?? false}
                  onChange={(event) => updateCourseField('is_purchasable', event.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Corso acquistabile
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={courseForm.is_active}
                  onChange={(event) => updateCourseField('is_active', event.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled
                />
                Flag tecnico attivo sincronizzato con lo stato
              </label>
            </div>

            <p className="text-sm text-gray-500">
              `published` + `acquistabile` mette il corso in vetrina e nel checkout pubblico. `hidden` lo nasconde dalla vetrina ma resta gestibile. `archived` lo toglie dalla vendita.
            </p>
          </div>

          <div className="w-full xl:w-[260px]">
            <Button
              onClick={() => void (isCreating ? handleCreateCourse() : handleSaveCourse())}
              variant="primary"
              fullWidth
            >
              <Save className="w-4 h-4 mr-2" />
              {isCreating ? 'Crea corso' : 'Salva impostazioni'}
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <Loading fullScreen text="Loading course structure..." />
      ) : error || !courseStructure ? (
        <ErrorMessage variant="card" message={error || 'Failed to load course structure'} onRetry={reload} />
      ) : (
        <CourseEditor
          chapters={courseStructure.chapters}
          onCreateChapter={handleCreateChapter}
          onUpdateChapter={handleUpdateChapter}
          onDeleteChapter={handleDeleteChapter}
          onCreateLesson={handleCreateLesson}
          onUpdateLesson={handleUpdateLesson}
          onDeleteLesson={handleDeleteLesson}
          onReorderChapters={handleReorderChapters}
          onReorderLessons={handleReorderLessons}
        />
      )}
    </div>
  );
};
