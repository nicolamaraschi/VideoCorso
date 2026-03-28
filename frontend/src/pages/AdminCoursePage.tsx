import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { CourseEditor } from '../components/admin/CourseEditor';
import { ImageUploader } from '../components/admin/ImageUploader';
import { useCourse } from '../hooks/useCourse';
import { adminService } from '../services/adminService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import type { AdminCourseRequest, Chapter, Course, Lesson } from '../types';
import { getErrorMessage } from '../utils/errors';

type LessonEditorPayload = Pick<Lesson, 'title' | 'description' | 'duration_seconds' | 'video_s3_key' | 'thumbnail_url'> & {
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

  const handleCreateChapter = async (data: { title: string; description: string; image_url?: string }) => {
    if (!courseStructure) {
      return;
    }
    try {
      setSaving(true);
      await adminService.createChapter({
        course_id: courseStructure.course.course_id,
        title: data.title,
        description: data.description,
        image_url: data.image_url,
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
        thumbnail_url: data.thumbnail_url,
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
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Titolo corso</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(event) => updateCourseField('title', event.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Nome principale del corso visibile ovunque"
                />
                <p className="text-xs text-gray-500">
                  E il nome che il cliente vede in catalogo, checkout, dashboard e admin.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Subtitle</label>
                <input
                  type="text"
                  value={courseForm.subtitle || ''}
                  onChange={(event) => updateCourseField('subtitle', event.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Riga secondaria che spiega meglio il corso"
                />
                <p className="text-xs text-gray-500">
                  Serve per chiarire in una frase breve a chi e utile il corso o qual e il focus.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Prezzo pieno</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={courseForm.price}
                  onChange={(event) => updateCourseField('price', Number(event.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Prezzo standard del corso"
                />
                <p className="text-xs text-gray-500">
                  E il prezzo base del corso. Se non hai uno sconto attivo, e questo che viene usato.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Prezzo scontato</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={courseForm.discounted_price ?? ''}
                  onChange={(event) => updateCourseField('discounted_price', event.target.value === '' ? null : Number(event.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Prezzo promo opzionale"
                />
                <p className="text-xs text-gray-500">
                  Se lo compili e piu basso del prezzo pieno, il corso viene mostrato come in offerta.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Posizione vetrina</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={courseForm.display_order ?? 999}
                  onChange={(event) => updateCourseField('display_order', Number(event.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Ordine nel catalogo pubblico"
                />
                <p className="text-xs text-gray-500">
                  Numero piu basso = corso mostrato prima. `1` va in alto, `999` va in fondo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Stato corso</label>
                <select
                  value={courseForm.status || 'draft'}
                  onChange={(event) => {
                    const status = event.target.value as AdminCourseRequest['status'];
                    updateCourseField('status', status);
                    updateCourseField('is_active', status === 'published');
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                >
                  <option value="draft">Bozza</option>
                  <option value="published">Pubblicato</option>
                  <option value="hidden">Nascosto</option>
                  <option value="archived">Archiviato</option>
                </select>
                <p className="text-xs text-gray-500">
                  `Bozza` solo admin. `Pubblicato` pronto per la vetrina. `Nascosto` fuori vetrina ma gestibile. `Archiviato` fuori vendita.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Badge marketing</label>
                <select
                  value={courseForm.badge || ''}
                  onChange={(event) => updateCourseField('badge', event.target.value as AdminCourseRequest['badge'])}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                >
                  <option value="">Nessun badge</option>
                  <option value="bestseller">Bestseller</option>
                  <option value="new">Nuovo</option>
                  <option value="sale">In offerta</option>
                </select>
                <p className="text-xs text-gray-500">
                  Etichetta visiva commerciale. Non cambia accessi o pagamenti, serve solo per la vetrina.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Slug pubblico</label>
                <input
                  type="text"
                  value={courseForm.public_slug || ''}
                  onChange={(event) => updateCourseField('public_slug', event.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="nome-corso-negli-url"
                />
                <p className="text-xs text-gray-500">
                  E il nome leggibile usato negli URL pubblici. Meglio corto, minuscolo e con trattini.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">URL immagine copertina</label>
              <input
                type="text"
                value={courseForm.cover_image_url || ''}
                onChange={(event) => updateCourseField('cover_image_url', event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Immagine principale del corso"
              />
              <p className="text-xs text-gray-500">
                Immagine usata in catalogo, card corso e riepiloghi commerciali.
              </p>
              {courseForm.cover_image_url && (
                <img
                  src={courseForm.cover_image_url}
                  alt="Anteprima copertina corso"
                  className="max-h-48 w-full rounded-lg border border-gray-200 object-cover"
                />
              )}
              <ImageUploader
                folder="courses"
                label="Copertina corso"
                onUploadComplete={(imageUrl) => updateCourseField('cover_image_url', imageUrl)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Descrizione breve</label>
              <input
                type="text"
                value={courseForm.short_description || ''}
                onChange={(event) => {
                  updateCourseField('short_description', event.target.value);
                  updateCourseField('description', event.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Testo corto per catalogo e checkout"
              />
              <p className="text-xs text-gray-500">
                Riassunto veloce del corso. E quello che conviene mostrare nelle card e nel checkout.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Descrizione lunga</label>
              <textarea
                value={courseForm.long_description || ''}
                onChange={(event) => updateCourseField('long_description', event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[140px]"
                placeholder="Programma, benefici, destinatari, contenuti e dettagli vendita"
              />
              <p className="text-xs text-gray-500">
                Testo completo del corso: cosa include, per chi e pensato, risultati, moduli e motivi per acquistarlo.
              </p>
            </div>

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

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-1">
              <p><strong className="text-gray-800">Corso acquistabile</strong>: se attivo, il corso puo essere comprato dal cliente.</p>
              <p><strong className="text-gray-800">Flag tecnico attivo</strong>: e interno e segue lo stato del corso, non serve usarlo a mano.</p>
              <p><strong className="text-gray-800">Regola pratica</strong>: `published` + `acquistabile` mette il corso in vetrina e nel checkout pubblico.</p>
            </div>
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
