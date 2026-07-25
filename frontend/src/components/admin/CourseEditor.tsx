import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical, Save, Play } from 'lucide-react';
import { Reorder } from 'framer-motion';
import type { Chapter, Lesson } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { VideoUploader } from './VideoUploader';
import { ImageUploader } from './ImageUploader';
// FIX: Importa i componenti necessari per l'anteprima
import { VideoPlayer } from '../course/VideoPlayer';
import { courseService } from '../../services/courseService';
import { Loading } from '../common/Loading';

type LessonFormData = {
  title: string;
  description: string;
  duration_seconds: number;
  video_s3_key: string;
  thumbnail_url?: string;
  is_free_preview: boolean;
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
    const updates = localChapters.map((c, i) => ({
      id: c.chapter_id,
      order_number: i + 1,
    }));
    onReorderChapters(updates);
  };

  const handleSaveLessonOrder = (chapterId: string) => {
    const chapter = localChapters.find(c => c.chapter_id === chapterId);
    if (!chapter || !chapter.lessons) return;

    const updates = chapter.lessons.map((l, i) => ({
      id: l.lesson_id,
      order_number: i + 1,
    }));
    onReorderLessons(updates);
  };


  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // FIX: Aggiungi stato per il modale di anteprima
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewLessonId, setPreviewLessonId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [replacingThumbnail, setReplacingThumbnail] = useState(false);

  const [chapterForm, setChapterForm] = useState({ title: '', description: '', image_url: '' });
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    duration_seconds: 0,
    video_s3_key: '',
    thumbnail_url: '',
    is_free_preview: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateChapter = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateChapter(chapterForm);
      setShowChapterModal(false);
      setChapterForm({ title: '', description: '', image_url: '' });
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLesson = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setReplacingThumbnail(false);
    setLessonForm({
      title: '',
      description: '',
      duration_seconds: 0,
      video_s3_key: '',
      thumbnail_url: '',
      is_free_preview: false,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIX: Funzione per gestire l'anteprima del video
  const handlePreviewLesson = async (lesson: Lesson) => {
    try {
      setPreviewLoading(true);
      setShowPreviewModal(true);

      // Chiamiamo lo stesso servizio usato dagli studenti
      const response = await courseService.getVideoUrl(lesson.lesson_id);

      setPreviewVideoUrl(response.video_url);
      setPreviewLessonId(lesson.lesson_id); // Usato per il tracciamento
    } catch (err) {
      console.error("Failed to load preview video", err);
      alert("Failed to load video preview.");
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // FIX: Funzione per chiudere l'anteprima
  const closePreviewModal = () => {
    setShowPreviewModal(false);
    setPreviewVideoUrl(null);
    setPreviewLessonId(null);
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
                  {chapter.image_url ? (
                    <img
                      src={chapter.image_url}
                      alt={chapter.title}
                      className="h-14 w-20 sm:h-20 sm:w-28 rounded-lg border border-gray-200 object-cover bg-white"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      Chapter {chapter.order_number}: {chapter.title}
                    </h3>
                    <p className="text-sm text-gray-600 truncate">{chapter.description}</p>
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
                    onClick={() => {
                      if (confirm('Delete this chapter?')) {
                        onDeleteChapter(chapter.chapter_id);
                      }
                    }}
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
                    className="space-y-2"
                  >
                    {chapter.lessons.map((lesson) => (
                      <Reorder.Item
                        key={lesson.lesson_id}
                        value={lesson}
                        onDragEnd={() => handleSaveLessonOrder(chapter.chapter_id)}
                        className="flex flex-col items-stretch gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3 bg-white rounded border border-gray-200 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3 flex-1">
                          <div className="cursor-move p-1 hover:bg-gray-100 rounded text-gray-400 flex-shrink-0">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          {lesson.thumbnail_url ? (
                            <img
                              src={lesson.thumbnail_url}
                              alt={lesson.title}
                              className="h-12 w-16 sm:h-16 sm:w-24 rounded-lg border border-gray-200 object-cover bg-gray-50 flex-shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-16 sm:h-16 sm:w-24 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-[10px] sm:text-[11px] font-medium text-gray-400">
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
                              setLessonForm({
                                title: lesson.title,
                                description: lesson.description,
                                duration_seconds: lesson.duration_seconds,
                                video_s3_key: lesson.video_s3_key,
                                thumbnail_url: lesson.thumbnail_url || '',
                                is_free_preview: lesson.is_free_preview || false,
                              });
                              setShowLessonModal(true);
                            }}
                            className="p-2 sm:p-1.5 text-gray-500 hover:text-primary-600 rounded hover:bg-primary-50 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this lesson?')) {
                                onDeleteLesson(lesson.lesson_id);
                              }
                            }}
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
            disabled={isSubmitting || !chapterForm.title}
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

          <div className="flex items-center gap-2">
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
            disabled={!lessonForm.title || (!editingLesson && !lessonForm.video_s3_key) || isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : (editingLesson ? 'Update Lesson' : 'Create Lesson')}
          </Button>
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
          />
        ) : (
          <p>Error loading video.</p>
        )}
      </Modal>
    </div>
  );
};
