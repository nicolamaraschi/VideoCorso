import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Save,
  Play,
  ArrowUp,
  ArrowDown,
  Paperclip,
  FileText,
  Upload,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Reorder } from 'framer-motion';
import type { Chapter, Lesson, LessonAttachment, VideoQuality } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { VideoUploader } from './VideoUploader';
import { ImageUploader } from './ImageUploader';
// FIX: Importa i componenti necessari per l'anteprima
import { VideoPlayer } from '../course/VideoPlayer';
import { courseService } from '../../services/courseService';
import { adminService } from '../../services/adminService';
import { Loading } from '../common/Loading';

type LessonFormData = {
  title: string;
  description: string;
  duration_seconds: number;
  video_s3_key: string;
  thumbnail_url?: string;
  is_free_preview: boolean;
  attachments?: LessonAttachment[];
};

interface CourseEditorProps {
  chapters: Chapter[];
  onCreateChapter: (data: { title: string; description: string; image_url?: string }) => Promise<void>;
  onUpdateChapter: (chapterId: string, data: Partial<Chapter>) => Promise<void>;
  onDeleteChapter: (chapterId: string) => Promise<void>;
  onCreateLesson: (chapterId: string, data: LessonFormData) => Promise<void>;
  onUpdateLesson: (lessonId: string, data: Partial<LessonFormData>) => Promise<void>;
  onDeleteLesson: (lessonId: string) => Promise<void>;
  onReorderChapters: (items: { id: string; order_number: number }[]) => Promise<void>;
  onReorderLessons: (items: { id: string; order_number: number }[]) => Promise<void>;
}

export const CourseEditor: React.FC<CourseEditorProps> = ({
  chapters,
  onCreateChapter,
  onUpdateChapter,
  onDeleteChapter,
  onCreateLesson,
  onUpdateLesson,
  onDeleteLesson,
  onReorderChapters,
  onReorderLessons,
}) => {
  const [localChapters, setLocalChapters] = useState(chapters);

  const reindexLessons = (lessons: Lesson[]) => lessons.map((lesson, index) => ({
    ...lesson,
    order_number: index + 1,
  }));

  const reindexChapters = (chapterItems: Chapter[]) => chapterItems.map((chapter, index) => ({
    ...chapter,
    order_number: index + 1,
    lessons: chapter.lessons ? reindexLessons(chapter.lessons) : chapter.lessons,
  }));

  useEffect(() => {
    setLocalChapters(chapters);
  }, [chapters]);

  const handleReorderChapters = (newOrder: Chapter[]) => {
    setLocalChapters(reindexChapters(newOrder));
  };

  const handleReorderLessonsLocal = (chapterId: string, newLessons: Lesson[]) => {
    setLocalChapters(prev => prev.map(c =>
      c.chapter_id === chapterId ? { ...c, lessons: reindexLessons(newLessons) } : c
    ));
  };

  const handleSaveChapterOrder = () => {
    const confirmed = window.confirm("Sei sicuro di voler salvare la nuova posizione dei capitoli?");
    if (!confirmed) {
      setLocalChapters(chapters);
      return;
    }
    const updates = localChapters.map((c, i) => ({
      id: c.chapter_id,
      order_number: i + 1,
    }));
    onReorderChapters(updates);
  };

  const handleSaveLessonOrder = (chapterId: string) => {
    const confirmed = window.confirm("Sei sicuro di voler salvare la nuova posizione delle lezioni?");
    if (!confirmed) {
      setLocalChapters(chapters);
      return;
    }
    const chapter = localChapters.find(c => c.chapter_id === chapterId);
    if (!chapter || !chapter.lessons) return;

    const updates = chapter.lessons.map((l, i) => ({
      id: l.lesson_id,
      order_number: i + 1,
    }));
    onReorderLessons(updates);
  };

  // Keyboard-accessible alternative to the drag handle above: reordering via
  // pointer drag alone is unusable without a mouse/touch, so move up/down
  // buttons give the same result via click or Enter/Space on a focused
  // button.
  const moveChapter = (chapterId: string, direction: -1 | 1) => {
    const index = localChapters.findIndex((c) => c.chapter_id === chapterId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= localChapters.length) return;

    const currentTitle = localChapters[index]?.title || 'questo capitolo';
    const directionText = direction === -1 ? 'sopra' : 'sotto';
    const confirmed = window.confirm(`Sei sicuro di voler spostare "${currentTitle}" ${directionText}?`);
    if (!confirmed) return;

    const reordered = [...localChapters];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const reindexed = reindexChapters(reordered);
    setLocalChapters(reindexed);
    onReorderChapters(reindexed.map((c, i) => ({ id: c.chapter_id, order_number: i + 1 })));
  };

  const moveLesson = (chapterId: string, lessonId: string, direction: -1 | 1) => {
    const chapter = localChapters.find((c) => c.chapter_id === chapterId);
    if (!chapter || !chapter.lessons) return;

    const index = chapter.lessons.findIndex((l) => l.lesson_id === lessonId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= chapter.lessons.length) return;

    const currentTitle = chapter.lessons[index]?.title || 'questa lezione';
    const directionText = direction === -1 ? 'sopra' : 'sotto';
    const confirmed = window.confirm(`Sei sicuro di voler spostare la lezione "${currentTitle}" ${directionText}?`);
    if (!confirmed) return;

    const reordered = [...chapter.lessons];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const reindexed = reindexLessons(reordered);
    setLocalChapters((prev) => prev.map((c) => (c.chapter_id === chapterId ? { ...c, lessons: reindexed } : c)));
    onReorderLessons(reindexed.map((l, i) => ({ id: l.lesson_id, order_number: i + 1 })));
  };


  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // FIX: Aggiungi stato per il modale di anteprima
  // Confirmation modal replacing native confirm() for delete actions, to
  // stay consistent with the rest of the app's UI instead of the browser's
  // built-in dialog.
  const [confirmDelete, setConfirmDelete] = useState<
    { type: 'chapter'; chapterId: string } | { type: 'lesson'; lessonId: string } | null
  >(null);

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'chapter') {
      onDeleteChapter(confirmDelete.chapterId);
    } else {
      onDeleteLesson(confirmDelete.lessonId);
    }
    setConfirmDelete(null);
  };

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewLessonId, setPreviewLessonId] = useState<string | null>(null);
  const [previewAvailableQualities, setPreviewAvailableQualities] = useState<string[]>([]);
  const [previewQuality, setPreviewQuality] = useState<VideoQuality>('high');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMissing, setPreviewMissing] = useState(false);
  const [replacingThumbnail, setReplacingThumbnail] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);

  const [chapterForm, setChapterForm] = useState({ title: '', description: '', image_url: '' });
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    title: '',
    description: '',
    duration_seconds: 0,
    video_s3_key: '',
    thumbnail_url: '',
    is_free_preview: false,
    attachments: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMaterial(true);
    setMaterialError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await adminService.getMaterialUploadUrl({
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          lesson_id: editingLesson?.lesson_id || selectedChapterId || 'general',
        });
        await adminService.uploadMaterialToS3(res.upload_url, file);
        const newAttachment: LessonAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          file_name: res.file_name,
          s3_key: res.s3_key,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          download_url: null,
          created_at: new Date().toISOString(),
        };
        setLessonForm((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), newAttachment],
        }));
      }
    } catch (err) {
      console.error('Material upload error:', err);
      setMaterialError('Impossibile caricare il materiale. Riprova con un altro file.');
    } finally {
      setUploadingMaterial(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setLessonForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.id !== attId),
    }));
  };

  const handleUpdateAttachmentTitle = (attId: string, title: string) => {
    setLessonForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).map((a) => (a.id === attId ? { ...a, title } : a)),
    }));
  };

  const handleCreateChapter = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateChapter(chapterForm);
      setShowChapterModal(false);
      setChapterForm({ title: '', description: '', image_url: '' });
    } catch {
      // Il banner globale descrive l'errore; il modal resta aperto per correggere i dati.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setChapterForm({
      title: chapter.title,
      description: chapter.description,
      image_url: chapter.image_url || '',
    });
    setShowChapterModal(true);
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUpdateChapter(editingChapter.chapter_id, chapterForm);
      setShowChapterModal(false);
      setEditingChapter(null);
      setChapterForm({ title: '', description: '', image_url: '' });
    } catch {
      // Il banner globale descrive l'errore; il modal resta aperto per correggere i dati.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLesson = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setReplacingThumbnail(false);
    setMaterialError(null);
    setLessonForm({
      title: '',
      description: '',
      duration_seconds: 0,
      video_s3_key: '',
      thumbnail_url: '',
      is_free_preview: false,
      attachments: [],
    });
    setShowLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const lessonPayload: Partial<LessonFormData> = {
        title: lessonForm.title,
        description: lessonForm.description,
        duration_seconds: lessonForm.duration_seconds,
        thumbnail_url: lessonForm.thumbnail_url || '',
        is_free_preview: lessonForm.is_free_preview,
        attachments: lessonForm.attachments || [],
      };

      if (lessonForm.video_s3_key) {
        lessonPayload.video_s3_key = lessonForm.video_s3_key;
      }

      if (editingLesson) {
        await onUpdateLesson(editingLesson.lesson_id, lessonPayload);
      } else if (selectedChapterId) {
        await onCreateLesson(selectedChapterId, lessonPayload as LessonFormData);
      }
      setShowLessonModal(false);
      setEditingLesson(null);
      setSelectedChapterId(null);
    } catch {
      // Il banner globale descrive l'errore; il modal resta aperto per correggere i dati.
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIX: Funzione per gestire l'anteprima del video
  const loadPreviewVideo = async (lessonId: string, quality: VideoQuality) => {
    const response = await courseService.getVideoUrl(lessonId, quality);
    setPreviewVideoUrl(response.video_url);
    setPreviewAvailableQualities(response.available_qualities || []);
  };

  const handlePreviewLesson = async (lesson: Lesson) => {
    if (!lesson.video_s3_key) {
      setPreviewMissing(true);
      setPreviewVideoUrl(null);
      setPreviewLessonId(lesson.lesson_id);
      setShowPreviewModal(true);
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewMissing(false);
      setShowPreviewModal(true);
      setPreviewLessonId(lesson.lesson_id);
      setPreviewQuality('high');

      await loadPreviewVideo(lesson.lesson_id, 'high');
    } catch (err) {
      console.error("Failed to load preview video", err);
      setPreviewMissing(true);
      setPreviewVideoUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewQualityChange = async (quality: VideoQuality) => {
    if (!previewLessonId) return;
    try {
      setPreviewLoading(true);
      setPreviewQuality(quality);
      await loadPreviewVideo(previewLessonId, quality);
    } catch (err) {
      console.error('Failed to switch preview quality', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // FIX: Funzione per chiudere l'anteprima
  const closePreviewModal = () => {
    setShowPreviewModal(false);
    setPreviewVideoUrl(null);
    setPreviewLessonId(null);
    setPreviewAvailableQualities([]);
    setPreviewQuality('high');
    setPreviewMissing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Course Structure</h2>
        <Button
          onClick={() => {
            setEditingChapter(null);
            setChapterForm({ title: '', description: '', image_url: '' });
            setShowChapterModal(true);
          }}
          variant="primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Chapter
        </Button>
      </div>

      {/* Chapters List */}
      <div className="space-y-4">
        <Reorder.Group axis="y" values={localChapters} onReorder={handleReorderChapters} className="space-y-4">
          {localChapters.map((chapter) => (
            <Reorder.Item
              key={chapter.chapter_id}
              value={chapter}
              onDragEnd={handleSaveChapterOrder}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Chapter Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 p-3 sm:p-4 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-hidden">
                  <div className="cursor-move p-1 hover:bg-gray-200 rounded">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveChapter(chapter.chapter_id, -1)}
                      disabled={chapter.order_number <= 1}
                      className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
                      aria-label={`Sposta capitolo "${chapter.title}" su`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChapter(chapter.chapter_id, 1)}
                      disabled={chapter.order_number >= localChapters.length}
                      className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
                      aria-label={`Sposta capitolo "${chapter.title}" giù`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {chapter.image_url ? (
                    <div
                      onClick={() => setZoomImage({ url: chapter.image_url!, title: `Capitolo ${chapter.order_number}: ${chapter.title}` })}
                      className="group relative cursor-pointer flex-shrink-0"
                      title="Clicca per ingrandire la copertina"
                    >
                      <img
                        src={chapter.image_url}
                        alt={chapter.title}
                        loading="lazy"
                        width={192}
                        height={108}
                        className="aspect-video h-20 w-36 sm:h-24 sm:w-44 md:h-28 md:w-52 rounded-xl border border-gray-200 object-contain bg-white shadow-sm group-hover:shadow-md group-hover:scale-[1.02] transition-all"
                      />
                      <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        🔍 Zoom
                      </span>
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate text-base sm:text-lg">
                      Chapter {chapter.order_number}: {chapter.title}
                    </h3>
                    <p className="text-sm text-gray-600 truncate mt-0.5">{chapter.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCreateLesson(chapter.chapter_id)}
                    className="pointer-events-auto"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Lesson
                  </Button>
                  <button
                    onClick={() => handleEditChapter(chapter)}
                    className="p-2 text-gray-600 hover:text-primary-600 pointer-events-auto"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ type: 'chapter', chapterId: chapter.chapter_id })}
                    className="p-2 text-gray-600 hover:text-red-600 pointer-events-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lessons */}
              {chapter.lessons && chapter.lessons.length > 0 && (
                <div className="p-4 bg-gray-50/50">
                  <Reorder.Group
                    axis="y"
                    values={chapter.lessons}
                    onReorder={(newLessons) => handleReorderLessonsLocal(chapter.chapter_id, newLessons)}
                    className="space-y-3"
                  >
                    {chapter.lessons.map((lesson) => (
                      <Reorder.Item
                        key={lesson.lesson_id}
                        value={lesson}
                        onDragEnd={() => handleSaveLessonOrder(chapter.chapter_id)}
                        className="flex flex-col items-stretch gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4 flex-1">
                          <div className="cursor-move p-1 hover:bg-gray-100 rounded text-gray-400 flex-shrink-0">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="flex flex-shrink-0 flex-col">
                            <button
                              type="button"
                              onClick={() => moveLesson(chapter.chapter_id, lesson.lesson_id, -1)}
                              disabled={lesson.order_number <= 1}
                              className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
                              aria-label={`Sposta lezione "${lesson.title}" su`}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLesson(chapter.chapter_id, lesson.lesson_id, 1)}
                              disabled={lesson.order_number >= (chapter.lessons?.length || 0)}
                              className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
                              aria-label={`Sposta lezione "${lesson.title}" giù`}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {lesson.thumbnail_url ? (
                            <div
                              onClick={() => setZoomImage({ url: lesson.thumbnail_url!, title: `Lezione ${lesson.order_number}: ${lesson.title}` })}
                              className="group relative cursor-pointer flex-shrink-0"
                              title="Clicca per ingrandire la copertina"
                            >
                              <img
                                src={lesson.thumbnail_url}
                                alt={lesson.title}
                                loading="lazy"
                                width={192}
                                height={108}
                                className="aspect-video h-20 w-36 sm:h-24 sm:w-44 md:h-28 md:w-52 rounded-xl border border-gray-200 object-contain bg-white shadow-sm group-hover:shadow-md group-hover:scale-[1.02] transition-all"
                              />
                              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                🔍 Zoom
                              </span>
                            </div>
                          ) : (
                            <div className="flex aspect-video h-20 w-36 sm:h-24 sm:w-44 md:h-28 md:w-52 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-xs font-medium text-gray-400">
                              No cover
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 text-sm leading-5 break-words">
                              Lesson {lesson.order_number}: {lesson.title}
                            </p>
                            <p className="text-xs text-gray-500 break-words sm:truncate sm:max-w-md">{lesson.description}</p>
                            {lesson.is_free_preview && (
                              <span className="inline-block mt-1 text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                                Free Preview
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex self-end sm:self-auto items-center gap-1">
                          {/* FIX: Pulsante Anteprima */}
                          <button
                            onClick={() => handlePreviewLesson(lesson)}
                            className="p-2 sm:p-1.5 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                            title="Preview Lesson"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingLesson(lesson);
                              setReplacingThumbnail(false);
                              setMaterialError(null);
                              setLessonForm({
                                title: lesson.title,
                                description: lesson.description,
                                duration_seconds: lesson.duration_seconds,
                                video_s3_key: lesson.video_s3_key,
                                thumbnail_url: lesson.thumbnail_url || '',
                                is_free_preview: lesson.is_free_preview || false,
                                attachments: lesson.attachments ? [...lesson.attachments] : [],
                              });
                              setShowLessonModal(true);
                            }}
                            className="p-2 sm:p-1.5 text-gray-500 hover:text-primary-600 rounded hover:bg-primary-50 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: 'lesson', lessonId: lesson.lesson_id })}
                            className="p-2 sm:p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              )}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* Chapter Modal */}
      <Modal
        isOpen={showChapterModal}
        onClose={() => setShowChapterModal(false)}
        title={editingChapter ? 'Edit Chapter' : 'Create Chapter'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={chapterForm.title}
              onChange={(e) =>
                setChapterForm({ ...chapterForm, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={chapterForm.description}
              onChange={(e) =>
                setChapterForm({ ...chapterForm, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chapter Image
              </label>
              <input
                type="text"
                value={chapterForm.image_url}
                onChange={(e) =>
                  setChapterForm({ ...chapterForm, image_url: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="URL immagine capitolo oppure carica da PC"
              />
            </div>
            {chapterForm.image_url && (
              <img
                src={chapterForm.image_url}
                alt="Anteprima immagine capitolo"
                width={400}
                height={160}
                className="max-h-40 w-auto rounded-lg border border-gray-200 object-contain mx-auto"
              />
            )}
            <ImageUploader
              folder="chapters"
              label="Copertina capitolo"
              onUploadComplete={(imageUrl) => setChapterForm((prev) => ({ ...prev, image_url: imageUrl }))}
            />
          </div>
          <Button
            onClick={editingChapter ? handleUpdateChapter : handleCreateChapter}
            variant="primary"
            fullWidth
            disabled={isSubmitting || !chapterForm.title.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : (editingChapter ? 'Update Chapter' : 'Create Chapter')}
          </Button>
        </div>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        isOpen={showLessonModal}
        onClose={() => setShowLessonModal(false)}
        title={editingLesson ? 'Edit Lesson' : 'Create Lesson'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={lessonForm.title}
              onChange={(e) =>
                setLessonForm({ ...lessonForm, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={lessonForm.description}
              onChange={(e) =>
                setLessonForm({ ...lessonForm, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video lezione
            </label>
            {lessonForm.video_s3_key ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-green-50 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-900">Video caricato</p>
                  <p className="truncate text-xs text-green-700">
                    {lessonForm.video_s3_key.split('/').pop()?.replace(/^[\w-]+-/, '') || 'Video della lezione'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setLessonForm({ ...lessonForm, video_s3_key: '', duration_seconds: 0 })}
                >
                  Sostituisci
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <VideoUploader
                  lessonId={editingLesson?.lesson_id}
                  onUploadComplete={(videoKey, duration) => {
                    setLessonForm((current) => ({
                      ...current,
                      video_s3_key: videoKey,
                      duration_seconds: duration,
                    }));
                  }}
                />
                {editingLesson?.video_s3_key && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setLessonForm((current) => ({
                      ...current,
                      video_s3_key: editingLesson.video_s3_key,
                      duration_seconds: editingLesson.duration_seconds || 0,
                    }))}
                  >
                    Annulla sostituzione
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Copertina lezione
            </label>
            {lessonForm.thumbnail_url && !replacingThumbnail ? (
              <div className="space-y-3">
                <img
                  src={lessonForm.thumbnail_url}
                  alt="Anteprima copertina lezione"
                  width={400}
                  height={160}
                  className="max-h-40 w-auto rounded-lg border border-gray-200 object-contain mx-auto"
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => setReplacingThumbnail(true)}>
                  Sostituisci copertina
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <ImageUploader
                  folder="lessons"
                  label="Copertina lezione"
                  onUploadComplete={(imageUrl) => {
                    setLessonForm((current) => ({ ...current, thumbnail_url: imageUrl }));
                    setReplacingThumbnail(false);
                  }}
                />
                {editingLesson?.thumbnail_url && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setReplacingThumbnail(false)}>
                    Annulla sostituzione
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Campo Durata nascosto, ma ancora nel modulo (viene popolato automaticamente) */}
          <input
            type="hidden"
            value={lessonForm.duration_seconds}
          />

          {/* Sezione Materiali Didattici e Allegati */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-primary-600" />
                  Materiali Didattici e Allegati (PDF, PowerPoint, Dispense)
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Documenti e risorse di studio scaricabili dai corsisti che hanno acquistato il corso.
                </p>
              </div>
              <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                uploadingMaterial
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
              }`}>
                {uploadingMaterial ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Caricamento...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Aggiungi file</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.rar,.png,.jpg,.jpeg"
                  className="hidden"
                  disabled={uploadingMaterial}
                  onChange={handleMaterialUpload}
                />
              </label>
            </div>

            {materialError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                {materialError}
              </p>
            )}

            {lessonForm.attachments && lessonForm.attachments.length > 0 ? (
              <div className="space-y-2">
                {lessonForm.attachments.map((att, idx) => {
                  const isPdf = att.file_name.toLowerCase().endsWith('.pdf') || att.file_type?.includes('pdf');
                  const isPpt = att.file_name.toLowerCase().match(/\.(ppt|pptx)$/) || att.file_type?.includes('presentation');
                  const isDoc = att.file_name.toLowerCase().match(/\.(doc|docx)$/) || att.file_type?.includes('word');
                  const isZip = att.file_name.toLowerCase().match(/\.(zip|rar)$/);

                  const badgeColor = isPdf
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : isPpt
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : isDoc
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : isZip
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200';

                  const formatSize = (bytes?: number) => {
                    if (!bytes || bytes <= 0) return '';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
                  };

                  return (
                    <div
                      key={att.id || idx}
                      className="flex items-center justify-between gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg border flex-shrink-0 ${badgeColor}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={att.title}
                            onChange={(e) => handleUpdateAttachmentTitle(att.id, e.target.value)}
                            placeholder="Titolo documento (es. Dispensa Modulo 1)"
                            className="w-full text-xs font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:bg-white focus:outline-hidden px-1 py-0.5 rounded transition-all"
                          />
                          <p className="text-[11px] text-gray-500 px-1 truncate">
                            {att.file_name} {att.file_size ? `• ${formatSize(att.file_size)}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {att.download_url && (
                          <a
                            href={att.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Apri file"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Rimuovi allegato"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <FileText className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Nessun materiale didattico allegato a questa lezione.</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <input
              type="checkbox"
              id="freePreview"
              checked={lessonForm.is_free_preview}
              onChange={(e) =>
                setLessonForm({ ...lessonForm, is_free_preview: e.target.checked })
              }
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="freePreview" className="text-sm font-medium text-gray-700">
              Free Preview Lesson
            </label>
          </div>
          <Button
            onClick={handleSaveLesson}
            variant="primary"
            fullWidth
            disabled={!lessonForm.title.trim() || (!editingLesson && !lessonForm.video_s3_key) || isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : (editingLesson ? 'Update Lesson' : 'Create Lesson')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.type === 'chapter' ? 'Delete chapter?' : 'Delete lesson?'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmDelete?.type === 'chapter'
              ? 'This will permanently delete the chapter and all its lessons. This action cannot be undone.'
              : 'This will permanently delete the lesson. This action cannot be undone.'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleConfirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* FIX: Modale per l'anteprima del video */}
      <Modal
        isOpen={showPreviewModal}
        onClose={closePreviewModal}
        title="Lesson Preview"
        size="2xl"
      >
        {previewLoading ? (
          <Loading text="Loading video..." />
        ) : previewVideoUrl && previewLessonId ? (
          <VideoPlayer
            videoUrl={previewVideoUrl}
            lessonId={previewLessonId} // Passiamo l'ID per il tracciamento
            availableQualities={previewAvailableQualities}
            quality={previewQuality}
            onQualityChange={handlePreviewQualityChange}
            trackProgress={false}
          />
        ) : previewMissing ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Per questa lezione non è ancora presente un video.</p>
          </div>
        ) : (
          <p>Error loading video.</p>
        )}
      </Modal>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <Modal
          isOpen={true}
          onClose={() => setZoomImage(null)}
          title={zoomImage.title}
          size="2xl"
        >
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-black/5 p-2 flex items-center justify-center">
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setZoomImage(null)}>
                Chiudi
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
