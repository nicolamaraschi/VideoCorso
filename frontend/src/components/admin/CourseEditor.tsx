import React, { useState } from 'react';
import { Plus, Edit, Trash2, GripVertical, Save, Play } from 'lucide-react';
import type { Chapter, Lesson } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { VideoUploader } from './VideoUploader';
// FIX: Importa i componenti necessari per l'anteprima
import { VideoPlayer } from '../course/VideoPlayer';
import { courseService } from '../../services/courseService';
import { Loading } from '../common/Loading';

interface CourseEditorProps {
  chapters: Chapter[];
  onCreateChapter: (data: { title: string; description: string }) => Promise<void>;
  onUpdateChapter: (chapterId: string, data: Partial<Chapter>) => Promise<void>;
  onDeleteChapter: (chapterId: string) => Promise<void>;
  onCreateLesson: (chapterId: string, data: any) => Promise<void>;
  onUpdateLesson: (lessonId: string, data: any) => Promise<void>;
  onDeleteLesson: (lessonId: string) => Promise<void>;
}

export const CourseEditor: React.FC<CourseEditorProps> = ({
  chapters,
  onCreateChapter,
  onUpdateChapter,
  onDeleteChapter,
  onCreateLesson,
  onUpdateLesson,
  onDeleteLesson,
}) => {
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

  const [chapterForm, setChapterForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    duration_seconds: 0,
    video_s3_key: '',
    is_free_preview: false,
  });

  const handleCreateChapter = async () => {
    await onCreateChapter(chapterForm);
    setShowChapterModal(false);
    setChapterForm({ title: '', description: '' });
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setChapterForm({
      title: chapter.title,
      description: chapter.description,
    });
    setShowChapterModal(true);
  };

  const handleUpdateChapter = async () => {
    if (!editingChapter) return;
    await onUpdateChapter(editingChapter.chapter_id, chapterForm);
    setShowChapterModal(false);
    setEditingChapter(null);
    setChapterForm({ title: '', description: '' });
  };

  const handleCreateLesson = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setLessonForm({
      title: '',
      description: '',
      duration_seconds: 0,
      video_s3_key: '',
      is_free_preview: false,
    });
    setShowLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (editingLesson) {
      await onUpdateLesson(editingLesson.lesson_id, lessonForm);
    } else if (selectedChapterId) {
      await onCreateLesson(selectedChapterId, lessonForm);
    }
    setShowLessonModal(false);
    setEditingLesson(null);
    setSelectedChapterId(null);
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Course Structure</h2>
        <Button
          onClick={() => {
            setEditingChapter(null);
            setChapterForm({ title: '', description: '' });
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
        {chapters.map((chapter) => (
          <div
            key={chapter.chapter_id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* Chapter Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3 flex-1">
                <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Chapter {chapter.order_number}: {chapter.title}
                  </h3>
                  <p className="text-sm text-gray-600">{chapter.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCreateLesson(chapter.chapter_id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Lesson
                </Button>
                <button
                  onClick={() => handleEditChapter(chapter)}
                  className="p-2 text-gray-600 hover:text-primary-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this chapter?')) {
                      onDeleteChapter(chapter.chapter_id);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lessons */}
            {chapter.lessons && chapter.lessons.length > 0 && (
              <div className="divide-y divide-gray-200">
                {chapter.lessons.map((lesson) => (
                  <div
                    key={lesson.lesson_id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      <div>
                        <p className="font-medium text-gray-900">
                          Lesson {lesson.order_number}: {lesson.title}
                        </p>
                        <p className="text-sm text-gray-600">{lesson.description}</p>
                        {lesson.is_free_preview && (
                          <span className="inline-block mt-1 text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                            Free Preview
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* FIX: Pulsante Anteprima */}
                      <button
                        onClick={() => handlePreviewLesson(lesson)}
                        className="p-2 text-gray-600 hover:text-blue-600"
                        title="Preview Lesson"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingLesson(lesson);
                          setLessonForm({
                            title: lesson.title,
                            description: lesson.description,
                            duration_seconds: lesson.duration_seconds,
                            video_s3_key: lesson.video_s3_key,
                            is_free_preview: lesson.is_free_preview || false,
                          });
                          setShowLessonModal(true);
                        }}
                        className="p-2 text-gray-600 hover:text-primary-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this lesson?')) {
                            onDeleteLesson(lesson.lesson_id);
                          }
                        }}
                        className="p-2 text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
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
          <Button
            onClick={editingChapter ? handleUpdateChapter : handleCreateChapter}
            variant="primary"
            fullWidth
          >
            <Save className="w-4 h-4 mr-2" />
            {editingChapter ? 'Update Chapter' : 'Create Chapter'}
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

          {/* FIX: Logica di upload video integrata */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video File
            </label>
            {lessonForm.video_s3_key ? (
              // Se un video è già stato caricato/collegato
              <div className="flex items-center justify-between gap-3 p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-900 font-mono truncate">
                  {lessonForm.video_s3_key}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setLessonForm({ ...lessonForm, video_s3_key: '', duration_seconds: 0 })}
                >
                  Change
                </Button>
              </div>
            ) : (
              // Se non c'è video, mostra l'uploader
              <VideoUploader
                onUploadComplete={(videoKey, duration) => {
                  console.log('Video S3 Key received:', videoKey);
                  console.log('Video duration received:', duration);
                  // Popola automaticamente sia la chiave che la durata
                  setLessonForm({ 
                    ...lessonForm, 
                    video_s3_key: videoKey,
                    duration_seconds: duration 
                  });
                }}
              />
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
            disabled={!lessonForm.title || !lessonForm.video_s3_key}
          >
            <Save className="w-4 h-4 mr-2" />
            {editingLesson ? 'Update Lesson' : 'Create Lesson'}
          </Button>
        </div>
      </Modal>

      {/* FIX: Modale per l'anteprima del video */}
      <Modal
        isOpen={showPreviewModal}
        onClose={closePreviewModal}
        title="Lesson Preview"
        size="xl"
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