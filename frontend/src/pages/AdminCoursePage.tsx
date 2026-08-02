import React, { useCallback, useEffect, useState } from 'react';
import { ListTree, Save, Settings } from 'lucide-react';
import { CourseEditor } from '../components/admin/CourseEditor';
import { ImageUploader } from '../components/admin/ImageUploader';
import { useCourse } from '../hooks/useCourse';
import { adminService } from '../services/adminService';
import { Loading } from '../components/common/Loading';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Button } from '../components/common/Button';
import type { AdminCourseRequest, Chapter, Course, Lesson } from '../types';
import { getErrorMessage } from '../utils/errors';
import { useAdminOperationBanner } from '../components/common/AdminOperationBanner';

type LessonEditorPayload = Omit<Pick<Lesson, 'title' | 'description' | 'duration_seconds' | 'video_s3_key' | 'thumbnail_url'>, 'thumbnail_url'> & {
  thumbnail_url?: string;
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
  const { showSuccess, showError } = useAdminOperationBanner();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<AdminCourseRequest>(emptyCourseForm);
  const [isCreating, setIsCreating] = useState(false);
  const [activeSection, setActiveSection] = useState<'settings' | 'structure'>('settings');
  const [showTechnicalOptions, setShowTechnicalOptions] = useState(false);

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
      showSuccess('Corso aggiornato', `Le impostazioni di “${courseForm.title}” sono state salvate.`);
      await Promise.all([loadCourses(), reload()]);
    } catch (err) {
      showError('Corso non aggiornato', getErrorMessage(err, 'Le impostazioni del corso non sono state salvate.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseForm.title.trim()) {
      showError('Corso non creato', 'Inserisci un titolo prima di creare il corso.');
      return;
    }

    try {
      setSaving(true);
      const response = await adminService.createCourse({
        ...courseForm,
        is_active: courseForm.status === 'published',
      });
      const created = response.data;
      showSuccess('Corso creato', `Il corso “${courseForm.title}” è stato creato. Ora puoi aggiungere capitoli e lezioni.`);
      await loadCourses();
      if (created?.course_id) {
        setSelectedCourseId(created.course_id);
        setIsCreating(false);
      }
    } catch (err) {
      showError('Corso non creato', getErrorMessage(err, 'Il corso non è stato creato.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourseId) return;
    if (!window.confirm('Archiviare questo corso? Non sarà più acquistabile, ma lezioni, acquisti e accessi delle iscritte saranno conservati.')) return;
    
    try {
      setSaving(true);
      await adminService.deleteCourse(selectedCourseId);
      showSuccess('Corso archiviato', 'Il corso non è più acquistabile. Le iscrizioni e gli acquisti già esistenti restano invariati.');
      setSelectedCourseId('');
      setIsCreating(false);
      await loadCourses();
    } catch (err) {
      showError('Corso non archiviato', getErrorMessage(err, 'Il corso è rimasto invariato.'));
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
      showSuccess('Capitolo creato', `Il capitolo “${data.title}” è stato aggiunto al corso.`);
      await reload();
    } catch (err) {
      showError('Capitolo non creato', getErrorMessage(err, 'Il capitolo non è stato aggiunto.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateChapter = async (chapterId: string, data: Partial<Chapter>) => {
    try {
      setSaving(true);
      await adminService.updateChapter(chapterId, data);
      showSuccess('Capitolo aggiornato', 'Le modifiche al capitolo sono state salvate.');
      await reload();
    } catch (err) {
      showError('Capitolo non aggiornato', getErrorMessage(err, 'Le modifiche al capitolo non sono state salvate.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      setSaving(true);
      await adminService.deleteChapter(chapterId);
      showSuccess('Capitolo eliminato', 'Il capitolo e le lezioni contenute sono stati rimossi dal corso.');
      await reload();
    } catch (err) {
      showError('Capitolo non eliminato', getErrorMessage(err, 'Il capitolo è rimasto invariato.'));
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
      showSuccess('Lezione creata', `La lezione “${data.title}” è stata aggiunta al capitolo.`);
      await reload();
    } catch (err) {
      showError('Lezione non creata', getErrorMessage(err, 'La lezione non è stata aggiunta.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLesson = async (lessonId: string, data: Partial<LessonEditorPayload>) => {
    try {
      setSaving(true);
      await adminService.updateLesson(lessonId, data);
      showSuccess('Lezione aggiornata', 'Le modifiche alla lezione, compreso il video eventualmente associato, sono state salvate.');
      await reload();
    } catch (err) {
      showError('Lezione non aggiornata', getErrorMessage(err, 'Le modifiche alla lezione non sono state salvate.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      setSaving(true);
      await adminService.deleteLesson(lessonId);
      showSuccess('Lezione eliminata', 'La lezione è stata rimossa dal capitolo.');
      await reload();
    } catch (err) {
      showError('Lezione non eliminata', getErrorMessage(err, 'La lezione è rimasta invariata.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReorderChapters = async (items: { id: string; order_number: number }[]) => {
    try {
      setSaving(true);
      await adminService.reorderChapters({ items });
      showSuccess('Ordine capitoli aggiornato', 'La nuova posizione dei capitoli è stata salvata.');
      await reload();
    } catch (err) {
      showError('Ordine capitoli non aggiornato', getErrorMessage(err, 'L’ordine precedente dei capitoli è rimasto invariato.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReorderLessons = async (items: { id: string; order_number: number }[]) => {
    try {
      setSaving(true);
      await adminService.reorderLessons({ items });
      showSuccess('Ordine lezioni aggiornato', 'La nuova posizione delle lezioni è stata salvata.');
      await reload();
    } catch (err) {
      showError('Ordine lezioni non aggiornato', getErrorMessage(err, 'L’ordine precedente delle lezioni è rimasto invariato.'));
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {saving && (
        <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50">
          <Loading size="sm" text="Saving..." />
        </div>
      )}

      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Corsi</h1>
        <p className="text-gray-500 mt-2">Crea, modifica e gestisci i corsi del tuo catalogo</p>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="w-full md:w-1/2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Seleziona un corso da modificare</label>
          <select
            value={selectedCourseId}
            onChange={(event) => {
              setSelectedCourseId(event.target.value);
              setIsCreating(false);
              setActiveSection('settings');
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 font-medium"
          >
            {courses.map((course) => (
              <option key={course.course_id} value={course.course_id}>
                {course.title} • {course.status || 'draft'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <span className="text-gray-400 font-medium hidden md:block">oppure</span>
          <Button
            variant="primary"
            onClick={() => {
              setIsCreating(true);
              setActiveSection('settings');
              setCourseForm({
                ...emptyCourseForm,
                public_slug: '',
              });
            }}
            className="w-full md:w-auto shadow-sm py-2.5"
          >
            + Crea nuovo corso
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Sezioni di gestione corso">
        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
            activeSection === 'settings'
              ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-sm'
              : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
          }`}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span>
            <span className="block font-semibold">Impostazioni corso</span>
            <span className="block text-xs opacity-75">Titolo, prezzo, stato, testi e copertina</span>
          </span>
        </button>
        {!isCreating && (
          <button
            type="button"
            onClick={() => setActiveSection('structure')}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
              activeSection === 'structure'
                ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
            }`}
          >
            <ListTree className="h-5 w-5 flex-shrink-0" />
            <span>
              <span className="block font-semibold">Struttura corso</span>
              <span className="block text-xs opacity-75">Capitoli, lezioni, video e relative copertine</span>
            </span>
          </button>
        )}
      </section>

      {activeSection === 'settings' && (
      <>
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            {isCreating ? 'Impostazioni Nuovo Corso' : 'Impostazioni Corso'}
          </h2>
        </div>
        
        <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Titolo corso</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (isCreating) {
                      const newSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                      setCourseForm((prev) => ({ ...prev, title: val, public_slug: newSlug }));
                    } else {
                      updateCourseField('title', val);
                    }
                  }}
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
                  value={courseForm.price || ''}
                  onChange={(event) => updateCourseField('price', event.target.value === '' ? 0 : Number(event.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Es. 1000 (Lascia vuoto per 0)"
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
                  value={courseForm.display_order === 999 ? '' : courseForm.display_order}
                  onChange={(event) => updateCourseField('display_order', event.target.value === '' ? 999 : Number(event.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                  placeholder="Lascia vuoto per la fine"
                />
                <p className="text-xs text-gray-500">
                  Numero piu basso = corso mostrato prima. `1` va in alto, `999` va in fondo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Copertina corso</label>
              <p className="text-xs text-gray-500">Carica qui l’immagine che rappresenta il corso nel catalogo.</p>
              {courseForm.cover_image_url && (
                <img
                  src={courseForm.cover_image_url}
                  alt="Anteprima copertina corso"
                  className="max-h-64 w-auto rounded-lg border border-gray-200 object-contain mx-auto"
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

            <div className="rounded-lg border border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowTechnicalOptions((current) => !current)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700"
              >
                <span>Opzioni tecniche — apri solo se necessario</span>
                <span className="text-primary-600">{showTechnicalOptions ? 'Chiudi' : 'Apri'}</span>
              </button>
              {showTechnicalOptions && (
                <div className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Indirizzo web del corso</label>
                    <input
                      type="text"
                      value={courseForm.public_slug || ''}
                      onChange={(event) => updateCourseField('public_slug', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="nome-corso-negli-url"
                    />
                    <p className="text-xs text-gray-500">Modificalo solo se devi cambiare il link pubblico del corso.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Link diretto alla copertina</label>
                    <input
                      type="text"
                      value={courseForm.cover_image_url || ''}
                      onChange={(event) => updateCourseField('cover_image_url', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="https://.../immagine.jpg"
                    />
                    <p className="text-xs text-gray-500">Usalo solo se la copertina è già online; altrimenti usa il caricamento sopra.</p>
                  </div>
                </div>
              )}
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
      </section>

      {!isCreating && (
        <section className="bg-red-50 rounded-xl border border-red-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
          <div>
            <h3 className="text-red-800 font-bold text-lg">Zona Pericolosa</h3>
            <p className="text-red-600 text-sm mt-1">L'eliminazione del corso e di tutti i suoi contenuti è irreversibile.</p>
          </div>
          <Button
            onClick={() => void handleDeleteCourse()}
            variant="danger"
            className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 whitespace-nowrap"
          >
            Archivia corso
          </Button>
        </section>
      )}
      </>
      )}

      {activeSection === 'settings' && (
      <div className="flex justify-center pt-4">
        <Button
          onClick={() => void (isCreating ? handleCreateCourse() : handleSaveCourse())}
          variant="primary"
          size="lg"
          className="min-w-[200px] shadow-sm"
          loading={saving}
        >
          <Save className="w-5 h-5 mr-2" />
          {isCreating ? 'Crea corso' : 'Salva impostazioni'}
        </Button>
      </div>
      )}

      {activeSection === 'structure' && (isCreating ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          <p className="text-lg font-medium">Salva il corso per iniziare ad aggiungere i contenuti</p>
          <p className="mt-2 text-sm">Dopo aver salvato, potrai creare capitoli e lezioni.</p>
        </div>
      ) : loading ? (
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
      ))}
    </div>
  );
};
