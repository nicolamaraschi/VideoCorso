import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Save,
  Play,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Paperclip,
  FileText,
  Upload,
  Loader2,
  ExternalLink,
  ListOrdered,
  Search,
  X,
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
import { formatDuration } from '../../utils/formatters';

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
  courseId?: string;
  courseTitle?: string;
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

const formatChapterTitle = (orderNumber: number, rawTitle: string) => {
  if (!rawTitle) return `Modulo ${orderNumber}`;
  const cleaned = rawTitle.replace(/^modulo\s*\d+[:\s-]*/i, '').trim();
  if (cleaned) {
    return `Modulo ${orderNumber}: ${cleaned}`;
  }
  return `Modulo ${orderNumber}`;
};

const formatLessonTitle = (orderNumber: number, rawTitle: string) => {
  if (!rawTitle) return `Lezione ${orderNumber}`;
  const cleaned = rawTitle.replace(/^lezione\s*\d+[:\s-]*/i, '').trim();
  if (cleaned) {
    return `Lezione ${orderNumber}: ${cleaned}`;
  }
  return `Lezione ${orderNumber}`;
};

export const CourseEditor: React.FC<CourseEditorProps> = ({
  courseId,
  courseTitle,
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
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallOrTablet = window.innerWidth <= 1024;
      setIsTouchDevice(hasTouch || isSmallOrTablet);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

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
    // Disable drag-and-drop position saving on touch devices (phones & iPads)
    if (isTouchDevice) return;

    // Check if order actually changed before asking confirmation
    const orderChanged =
      localChapters.length !== chapters.length ||
      localChapters.some((c, i) => c.chapter_id !== chapters[i]?.chapter_id);
    if (!orderChanged) return;

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
    if (isTouchDevice) return;

    const currentChapter = localChapters.find(c => c.chapter_id === chapterId);
    const originalChapter = chapters.find(c => c.chapter_id === chapterId);
    if (!currentChapter || !currentChapter.lessons || !originalChapter || !originalChapter.lessons) return;

    const orderChanged =
      currentChapter.lessons.length !== originalChapter.lessons.length ||
      currentChapter.lessons.some((l, i) => l.lesson_id !== originalChapter.lessons?.[i]?.lesson_id);
    if (!orderChanged) return;

    const confirmed = window.confirm("Sei sicuro di voler salvare la nuova posizione delle lezioni?");
    if (!confirmed) {
      setLocalChapters(chapters);
      return;
    }

    const updates = currentChapter.lessons.map((l, i) => ({
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

  // Moduli compressi/chiusi di default per una navigazione comoda
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(() => new Set());

  const toggleChapter = (chapterId: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const expandAllChapters = () => {
    setExpandedChapterIds(new Set(localChapters.map((c) => c.chapter_id)));
  };

  const collapseAllChapters = () => {
    setExpandedChapterIds(new Set());
  };

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
      const chapterOfLesson = localChapters.find((c) => c.lessons?.some((l) => l.lesson_id === confirmDelete.lessonId));
      if (chapterOfLesson) {
        setExpandedChapterIds((prev) => new Set(prev).add(chapterOfLesson.chapter_id));
      }
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
  const [replacingChapterImage, setReplacingChapterImage] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);

  // Indice Corso Slide-Over Drawer State
  const [isIndexDrawerOpen, setIsIndexDrawerOpen] = useState(false);
  const [indexSearchQuery, setIndexSearchQuery] = useState('');
  const [indexExpandedChapters, setIndexExpandedChapters] = useState<Set<string>>(new Set());

  // Total lessons count
  const totalLessonsCount = useMemo(
    () => localChapters.reduce((acc, chap) => acc + (chap.lessons?.length || 0), 0),
    [localChapters]
  );

  // Sync drawer expanded chapters on open
  useEffect(() => {
    if (isIndexDrawerOpen) {
      setIndexExpandedChapters(new Set(localChapters.map((c) => c.chapter_id)));
    }
  }, [isIndexDrawerOpen, localChapters]);

  // Lock body scroll and listen for Escape key when index drawer is open
  useEffect(() => {
    if (!isIndexDrawerOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsIndexDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isIndexDrawerOpen]);

  const toggleIndexChapter = (chapterId: string) => {
    setIndexExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const allIndexChapterIds = useMemo(
    () => localChapters.map((c) => c.chapter_id),
    [localChapters]
  );

  const areAllIndexChaptersExpanded =
    allIndexChapterIds.length > 0 &&
    allIndexChapterIds.every((id) => indexExpandedChapters.has(id));

  const toggleAllIndexChapters = () => {
    if (areAllIndexChaptersExpanded) {
      setIndexExpandedChapters(new Set());
    } else {
      setIndexExpandedChapters(new Set(allIndexChapterIds));
    }
  };

  const filteredChapters = useMemo(() => {
    const q = indexSearchQuery.trim().toLowerCase();
    if (!q) return localChapters;
    return localChapters
      .map((chap) => {
        const matchesChap = chap.title.toLowerCase().includes(q) || (chap.description || '').toLowerCase().includes(q);
        const matchingLessons = chap.lessons?.filter(
          (les) =>
            les.title.toLowerCase().includes(q) ||
            (les.description || '').toLowerCase().includes(q) ||
            String(les.order_number).includes(q)
        );
        if (matchesChap) return chap;
        if (matchingLessons && matchingLessons.length > 0) {
          return { ...chap, lessons: matchingLessons };
        }
        return null;
      })
      .filter((c): c is Chapter => c !== null);
  }, [localChapters, indexSearchQuery]);

  const handleJumpToLesson = (chapterId: string, lessonId: string) => {
    setIsIndexDrawerOpen(false);
    setExpandedChapterIds((prev) => new Set(prev).add(chapterId));
    setTimeout(() => {
      const el = document.getElementById(`lesson-card-${lessonId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary-500', 'bg-primary-50/50');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary-500', 'bg-primary-50/50');
        }, 2200);
      }
    }, 120);
  };

  const handleEditLessonFromDrawer = (chapterId: string, lesson: Lesson) => {
    setIsIndexDrawerOpen(false);
    setSelectedChapterId(chapterId);
    setExpandedChapterIds((prev) => new Set(prev).add(chapterId));
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
  };

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
    setReplacingChapterImage(false);
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
    setExpandedChapterIds((prev) => new Set(prev).add(chapterId));
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
    const targetChapterId = selectedChapterId || (editingLesson ? localChapters.find((c) => c.lessons?.some((l) => l.lesson_id === editingLesson.lesson_id))?.chapter_id : null);
    const targetLessonId = editingLesson?.lesson_id;

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

      if (targetChapterId) {
        setExpandedChapterIds((prev) => new Set(prev).add(targetChapterId));
        // Mantiene lo scroll sulla sezione/lezione appena modificata senza rimandare l'utente all'inizio
        setTimeout(() => {
          const targetEl = targetLessonId 
            ? document.getElementById(`lesson-card-${targetLessonId}`) 
            : document.getElementById(`chapter-card-${targetChapterId}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'auto', block: 'nearest' });
          } else {
            document.getElementById(`chapter-card-${targetChapterId}`)?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
          }
        }, 50);
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
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Struttura & Indice Corso</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-900 border border-primary-200">
              {localChapters.length} Moduli • {totalLessonsCount} Lezioni
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestisci moduli e lezioni, oppure usa l'Indice Rapido per trovare e saltare subito a qualsiasi contenuto.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Quick Course Index Drawer Button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsIndexDrawerOpen(true)}
            className="bg-primary-50 text-primary-950 border-primary-200 hover:bg-primary-100 text-xs font-bold shadow-2xs"
            title="Apri indice rapido lezioni"
          >
            <ListOrdered className="w-4 h-4 mr-1.5 text-primary-700" />
            <span>Indice Corso</span>
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-primary-200/90 text-[10px] font-bold text-primary-900">
              {totalLessonsCount}
            </span>
          </Button>

          {expandedChapterIds.size > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={collapseAllChapters}
              className="text-xs font-medium"
            >
              <ChevronUp className="w-4 h-4 mr-1.5" />
              Comprimi ({expandedChapterIds.size})
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={expandAllChapters}
              className="text-xs font-medium"
            >
              <ChevronDown className="w-4 h-4 mr-1.5" />
              Espandi ({localChapters.length})
            </Button>
          )}

          <Button
            onClick={() => {
              setEditingChapter(null);
              setReplacingChapterImage(false);
              setChapterForm({ title: '', description: '', image_url: '' });
              setShowChapterModal(true);
            }}
            variant="primary"
            size="sm"
            className="text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Aggiungi Modulo
          </Button>
        </div>
      </div>

      {/* Chapters List */}
      <div className="space-y-4">
        <Reorder.Group axis="y" values={localChapters} onReorder={handleReorderChapters} className="space-y-4">
          {localChapters.map((chapter) => {
            const isExpanded = expandedChapterIds.has(chapter.chapter_id);
            const lessonCount = chapter.lessons?.length || 0;

            return (
              <Reorder.Item
                key={chapter.chapter_id}
                id={`chapter-card-${chapter.chapter_id}`}
                value={chapter}
                drag={isTouchDevice ? false : "y"}
                dragListener={!isTouchDevice}
                layout="position"
                transition={{ duration: 0 }}
                onDragEnd={handleSaveChapterOrder}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:border-gray-300 scroll-mt-24 touch-pan-y"
              >
                {/* Chapter Header */}
                <div
                  className={`p-3 sm:p-4 ${
                    isExpanded ? 'bg-gray-50/90 border-b border-gray-200' : 'bg-white hover:bg-gray-50/70 cursor-pointer'
                  }`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('a') || target.closest('input')) {
                      return;
                    }
                    toggleChapter(chapter.chapter_id);
                  }}
                >
                  {/* MOBILE HEADER LAYOUT (< sm) */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChapter(chapter.chapter_id);
                          }}
                          className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-200/70 transition-colors shrink-0"
                          title={isExpanded ? 'Comprimi modulo' : 'Espandi modulo'}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-primary-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <span className="text-xs font-bold uppercase tracking-wider text-primary-900 bg-primary-100/90 px-2 py-0.5 rounded-md border border-primary-200/80 shrink-0">
                          Modulo {chapter.order_number}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                          lessonCount > 0 
                            ? 'bg-primary-50 text-primary-700 border border-primary-200/60' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {lessonCount} {lessonCount === 1 ? 'lez.' : 'lezioni'}
                        </span>
                      </div>

                      {/* Mobile chapter action buttons */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(chapter.chapter_id, -1);
                          }}
                          disabled={chapter.order_number <= 1}
                          className="p-1.5 text-gray-500 hover:text-primary-600 disabled:opacity-25 rounded-lg hover:bg-gray-100"
                          title="Sposta modulo su"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(chapter.chapter_id, 1);
                          }}
                          disabled={chapter.order_number >= localChapters.length}
                          className="p-1.5 text-gray-500 hover:text-primary-600 disabled:opacity-25 rounded-lg hover:bg-gray-100"
                          title="Sposta modulo giù"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditChapter(chapter);
                          }}
                          className="p-1.5 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                          title="Modifica modulo"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete({ type: 'chapter', chapterId: chapter.chapter_id });
                          }}
                          className="p-1.5 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100"
                          title="Elimina modulo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title and Description on Mobile */}
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-950 text-base leading-snug">
                        {chapter.title.replace(/^modulo\s*\d+[:\s-]*/i, '').trim() || chapter.title}
                      </h3>
                      {chapter.description ? (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{chapter.description}</p>
                      ) : null}
                    </div>

                    {/* Mobile Cover Image */}
                    {chapter.image_url ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChapter(chapter.chapter_id);
                        }}
                        className="relative cursor-pointer w-full aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black shadow-xs"
                      >
                        <img
                          src={chapter.image_url}
                          alt={chapter.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}

                    {/* Mobile Add Lesson Button */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateLesson(chapter.chapter_id);
                      }}
                      className="w-full justify-center text-xs py-2 pointer-events-auto"
                    >
                      <Plus className="w-4 h-4 mr-1.5 text-primary-600" />
                      Aggiungi Lezione al Modulo
                    </Button>
                  </div>

                  {/* DESKTOP HEADER LAYOUT (>= sm) */}
                  <div className="hidden sm:flex sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-hidden">
                      {/* Expand/Collapse Chevron Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChapter(chapter.chapter_id);
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200/70 transition-colors flex-shrink-0"
                        title={isExpanded ? 'Comprimi modulo' : 'Espandi modulo'}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-primary-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {/* Grip handle: only on non-touch desktop */}
                      {!isTouchDevice && (
                        <div className="cursor-move p-1 hover:bg-gray-200 rounded flex-shrink-0 text-gray-400">
                          <GripVertical className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex flex-col flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(chapter.chapter_id, -1);
                          }}
                          disabled={chapter.order_number <= 1}
                          className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
                          aria-label={`Sposta capitolo "${chapter.title}" su`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(chapter.chapter_id, 1);
                          }}
                          disabled={chapter.order_number >= localChapters.length}
                          className="p-0.5 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400"
                          aria-label={`Sposta capitolo "${chapter.title}" giù`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {chapter.image_url ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChapter(chapter.chapter_id);
                          }}
                          className="relative cursor-pointer flex-shrink-0"
                          title={isExpanded ? 'Comprimi modulo' : 'Espandi modulo e visualizza le lezioni'}
                        >
                          <img
                            src={chapter.image_url}
                            alt={chapter.title}
                            loading="lazy"
                            width={400}
                            height={225}
                            className="aspect-video w-48 sm:w-60 md:w-72 lg:w-80 rounded-xl border border-gray-200 object-cover bg-black shadow-sm hover:opacity-95 transition-opacity"
                          />
                        </div>
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate text-base sm:text-lg">
                            {formatChapterTitle(chapter.order_number, chapter.title)}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            lessonCount > 0 
                              ? 'bg-primary-50 text-primary-700 border border-primary-200/60' 
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {lessonCount} {lessonCount === 1 ? 'lezione' : 'lezioni'}
                          </span>
                        </div>
                        {chapter.description ? (
                          <p className="text-sm text-gray-600 truncate mt-0.5">{chapter.description}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateLesson(chapter.chapter_id);
                        }}
                        className="pointer-events-auto"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Aggiungi Lezione
                      </Button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditChapter(chapter);
                        }}
                        className="p-2 text-gray-600 hover:text-primary-600 pointer-events-auto rounded-lg hover:bg-gray-100 transition-colors"
                        title="Modifica modulo"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete({ type: 'chapter', chapterId: chapter.chapter_id });
                        }}
                        className="p-2 text-gray-600 hover:text-red-600 pointer-events-auto rounded-lg hover:bg-gray-100 transition-colors"
                        title="Elimina modulo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lessons (Visible only if chapter is expanded) */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 bg-gray-50/50">
                    {chapter.lessons && chapter.lessons.length > 0 ? (
                      <Reorder.Group
                        axis="y"
                        values={chapter.lessons}
                        onReorder={(newLessons) => handleReorderLessonsLocal(chapter.chapter_id, newLessons)}
                        className="space-y-3"
                      >
                        {chapter.lessons.map((lesson) => (
                          <Reorder.Item
                            key={lesson.lesson_id}
                            id={`lesson-card-${lesson.lesson_id}`}
                            value={lesson}
                            drag={isTouchDevice ? false : "y"}
                            dragListener={!isTouchDevice}
                            layout="position"
                            transition={{ duration: 0 }}
                            onDragEnd={() => handleSaveLessonOrder(chapter.chapter_id)}
                            className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md scroll-mt-28 touch-pan-y overflow-hidden"
                          >
                            {/* MOBILE LESSON CARD (< sm) */}
                            <div className="flex flex-col gap-2.5 p-3 sm:hidden">
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-gray-100">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  <span className="text-[11px] font-bold text-primary-900 bg-primary-100 px-2 py-0.5 rounded-md border border-primary-200/60">
                                    Lezione {lesson.order_number}
                                  </span>
                                  {lesson.is_free_preview && (
                                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                      Anteprima
                                    </span>
                                  )}
                                  {lesson.duration_seconds > 0 ? (
                                    <span className="text-[11px] text-gray-500 font-mono font-medium">
                                      {formatDuration(lesson.duration_seconds)}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md font-medium border border-amber-200/60">
                                      Dispensa
                                    </span>
                                  )}
                                </div>

                                {/* Mobile lesson action buttons */}
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => moveLesson(chapter.chapter_id, lesson.lesson_id, -1)}
                                    disabled={lesson.order_number <= 1}
                                    className="p-1.5 text-gray-500 hover:text-primary-600 disabled:opacity-25 rounded-md hover:bg-gray-100 transition-colors"
                                    title="Sposta su"
                                    aria-label="Sposta su"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveLesson(chapter.chapter_id, lesson.lesson_id, 1)}
                                    disabled={lesson.order_number >= (chapter.lessons?.length || 0)}
                                    className="p-1.5 text-gray-500 hover:text-primary-600 disabled:opacity-25 rounded-md hover:bg-gray-100 transition-colors"
                                    title="Sposta giù"
                                    aria-label="Sposta giù"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePreviewLesson(lesson)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    title="Anteprima Video"
                                    aria-label="Anteprima Video"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLesson(lesson);
                                      setSelectedChapterId(chapter.chapter_id);
                                      setExpandedChapterIds((prev) => new Set(prev).add(chapter.chapter_id));
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
                                    className="p-1.5 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                    title="Modifica"
                                    aria-label="Modifica"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete({ type: 'lesson', lessonId: lesson.lesson_id })}
                                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Elimina"
                                    aria-label="Elimina"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 pt-0.5">
                                {lesson.thumbnail_url ? (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewLesson(lesson);
                                    }}
                                    className="relative cursor-pointer shrink-0 group/thumb rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all w-28 min-[380px]:w-32 min-[430px]:w-36 aspect-video"
                                    title="Tocca la copertina per aprire l'anteprima video"
                                  >
                                    <img
                                      src={lesson.thumbnail_url}
                                      alt={lesson.title}
                                      loading="lazy"
                                      className="w-full h-full border border-primary-200/80 object-cover bg-black img-sharp group-hover/thumb:scale-[1.03] transition-transform duration-300"
                                    />
                                    {/* Video Play Badge overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/thumb:bg-black/35 transition-colors pointer-events-none">
                                      <div className="w-7 h-7 rounded-full bg-black/65 backdrop-blur-xs text-white flex items-center justify-center shadow-md border border-white/30 group-hover/thumb:scale-110 transition-transform">
                                        <Play className="w-3.5 h-3.5 fill-current translate-x-0.5 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewLesson(lesson);
                                    }}
                                    className="flex aspect-video w-28 min-[380px]:w-32 min-[430px]:w-36 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-[10px] font-medium text-gray-400 cursor-pointer hover:bg-gray-100 transition-colors"
                                    title="Tocca per anteprima"
                                  >
                                    <span>Nessun video</span>
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 flex flex-col justify-center">
                                  <p className="font-bold text-gray-950 text-sm leading-snug line-clamp-2">
                                    {lesson.title}
                                  </p>
                                  {lesson.description && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">{lesson.description}</p>
                                  )}
                                  {lesson.attachments && lesson.attachments.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-800 bg-primary-50 px-2 py-0.5 rounded-md mt-1.5 border border-primary-200/60 w-fit">
                                      <Paperclip className="w-2.5 h-2.5 text-primary-600" />
                                      {lesson.attachments.length} {lesson.attachments.length === 1 ? 'allegato' : 'allegati'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* DESKTOP LESSON CARD (>= sm) */}
                            <div className="hidden sm:flex sm:items-center sm:justify-between p-4">
                              <div className="flex min-w-0 items-center gap-3 sm:gap-4 flex-1">
                                {!isTouchDevice && (
                                  <div className="cursor-move p-1 hover:bg-gray-100 rounded text-gray-400 flex-shrink-0">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                )}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewLesson(lesson);
                                    }}
                                    className="group/thumb relative cursor-pointer flex-shrink-0 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all"
                                    title="Clicca sulla copertina per aprire l'anteprima video"
                                  >
                                    <img
                                      src={lesson.thumbnail_url}
                                      alt={lesson.title}
                                      loading="lazy"
                                      width={260}
                                      height={146}
                                      className="aspect-video w-36 sm:w-44 md:w-52 border border-gray-200 object-contain bg-black group-hover/thumb:scale-[1.02] transition-transform"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                                      <div className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-xs text-white flex items-center justify-center shadow-md border border-white/30">
                                        <Play className="w-4 h-4 fill-current translate-x-0.5 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex aspect-video w-36 sm:w-44 md:w-52 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-xs font-medium text-gray-400">
                                    No cover
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900 text-sm leading-5 break-words">
                                    {formatLessonTitle(lesson.order_number, lesson.title)}
                                  </p>
                                  <p className="text-xs text-gray-500 break-words sm:truncate sm:max-w-md">{lesson.description}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {lesson.is_free_preview && (
                                      <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded border border-primary-200/50">
                                        Anteprima Gratuita
                                      </span>
                                    )}
                                    {lesson.attachments && lesson.attachments.length > 0 && (
                                      <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Paperclip className="w-2.5 h-2.5 text-gray-500" />
                                        {lesson.attachments.length} {lesson.attachments.length === 1 ? 'allegato' : 'allegati'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 pl-3">
                                <button
                                  onClick={() => handlePreviewLesson(lesson)}
                                  className="p-2 sm:p-1.5 text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                  title="Anteprima Video"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingLesson(lesson);
                                    setSelectedChapterId(chapter.chapter_id);
                                    setExpandedChapterIds((prev) => new Set(prev).add(chapter.chapter_id));
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
                                  title="Modifica"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete({ type: 'lesson', lessonId: lesson.lesson_id })}
                                  className="p-2 sm:p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    ) : (
                      <div className="text-center py-6 text-sm text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                        <p>Nessuna lezione presente in questo capitolo.</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCreateLesson(chapter.chapter_id)}
                          className="mt-2 text-primary-600 hover:text-primary-700"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Aggiungi la prima lezione
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>

      {/* Chapter Modal */}
      <Modal
        isOpen={showChapterModal}
        onClose={() => setShowChapterModal(false)}
        title={editingChapter ? 'Modifica Modulo' : 'Crea Modulo'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titolo Modulo
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
              Descrizione
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
            <label className="block text-sm font-medium text-gray-700">
              Copertina modulo
            </label>
            {chapterForm.image_url && !replacingChapterImage ? (
              <div className="space-y-3">
                <img
                  src={chapterForm.image_url}
                  alt="Anteprima copertina modulo"
                  width={400}
                  height={160}
                  className="max-h-40 w-auto rounded-lg border border-gray-200 object-contain mx-auto shadow-xs"
                />
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setReplacingChapterImage(true)}
                  >
                    Sostituisci copertina
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setChapterForm((prev) => ({ ...prev, image_url: '' }))}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Rimuovi
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <ImageUploader
                  folder="chapters"
                  label="Copertina modulo"
                  onUploadComplete={(imageUrl) => {
                    setChapterForm((prev) => ({ ...prev, image_url: imageUrl }));
                    setReplacingChapterImage(false);
                  }}
                />
                {editingChapter?.image_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setReplacingChapterImage(false)}
                  >
                    Annulla sostituzione
                  </Button>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={editingChapter ? handleUpdateChapter : handleCreateChapter}
            variant="primary"
            fullWidth
            disabled={isSubmitting || !chapterForm.title.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Salvataggio...' : (editingChapter ? 'Aggiorna Modulo' : 'Crea Modulo')}
          </Button>
        </div>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        isOpen={showLessonModal}
        onClose={() => setShowLessonModal(false)}
        title={editingLesson ? 'Modifica Lezione' : 'Crea Nuova Lezione'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titolo della lezione
            </label>
            <input
              type="text"
              value={lessonForm.title}
              onChange={(e) =>
                setLessonForm({ ...lessonForm, title: e.target.value })
              }
              placeholder="Es. Introduzione al Trattamento"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione della lezione
            </label>
            <textarea
              value={lessonForm.description}
              onChange={(e) =>
                setLessonForm({ ...lessonForm, description: e.target.value })
              }
              placeholder="Breve spiegazione degli argomenti trattati in questa lezione..."
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
              Anteprima gratuita (accessibile anche a chi non ha ancora acquistato il corso)
            </label>
          </div>
          <Button
            onClick={handleSaveLesson}
            variant="primary"
            fullWidth
            disabled={!lessonForm.title.trim() || (!editingLesson && !lessonForm.video_s3_key) || isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Salvataggio...' : (editingLesson ? 'Salva Modifiche Lezione' : 'Crea Lezione')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.type === 'chapter' ? 'Elimina modulo?' : 'Elimina lezione?'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmDelete?.type === 'chapter'
              ? 'Questo eliminerà definitivamente il modulo e tutte le relative lezioni. L\'azione non può essere annullata.'
              : 'Questo eliminerà definitivamente la lezione. L\'azione non può essere annullata.'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>
              Annulla
            </Button>
            <Button variant="danger" fullWidth onClick={handleConfirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Elimina
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale per l'anteprima del video */}
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

      {/* Floating Action Button for Quick Course Index on Mobile */}
      <button
        type="button"
        onClick={() => setIsIndexDrawerOpen(true)}
        className="fixed bottom-5 right-5 sm:hidden z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-950 text-white shadow-2xl border border-primary-700/80 active:scale-95 transition-all text-xs font-bold cursor-pointer"
        aria-label="Apri indice rapido lezioni"
      >
        <ListOrdered className="w-4 h-4 text-primary-300" />
        <span>Indice Corso ({totalLessonsCount})</span>
      </button>

      {/* ========================================================================= */}
      {/* ADMIN SLIDE-OVER PLAYLIST DRAWER: All Modules & Lessons Quick Navigator */}
      {/* ========================================================================= */}
      {isIndexDrawerOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsIndexDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-full sm:max-w-md h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-primary-950 text-white flex items-center justify-between border-b border-primary-900/50 flex-shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-primary-300 font-bold block">
                    Pannello Admin
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                    Indice Rapido
                  </span>
                </div>
                <h3
                  className="text-base sm:text-lg font-bold text-white truncate mt-0.5"
                  style={{ fontFamily: 'Abhaya Libre, serif' }}
                >
                  {courseTitle || 'Indice Corso'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsIndexDrawerOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors flex-shrink-0 cursor-pointer"
                aria-label="Chiudi indice"
              >
                <span className="text-xs font-semibold">Chiudi</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Search Bar */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={indexSearchQuery}
                  onChange={(e) => setIndexSearchQuery(e.target.value)}
                  placeholder="Cerca lezione o modulo..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-2xs"
                />
                {indexSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setIndexSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Summary & Accordion Toolbar */}
            <div className="px-4 py-2.5 bg-primary-900/30 border-b border-primary-100 flex items-center justify-between text-xs text-primary-950 flex-shrink-0">
              <div className="font-medium">
                <span className="text-gray-600">Riepilogo: </span>
                <span className="font-bold text-primary-950">
                  {localChapters.length} Moduli • {totalLessonsCount} Lezioni
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAllIndexChapters}
                  className="text-[11px] font-semibold text-primary-800 hover:text-primary-950 underline underline-offset-2 cursor-pointer"
                >
                  {areAllIndexChaptersExpanded ? 'Comprimi tutti' : 'Espandi tutti'}
                </button>
                {courseId && (
                  <a
                    href={`/courses/${courseId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-950 hover:underline"
                    title="Vedi come studente in nuova scheda"
                  >
                    <span>Vista studente</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Lessons List with Module Accordions */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {filteredChapters.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-sm font-semibold">Nessun modulo o lezione trovata</p>
                  <p className="text-xs text-gray-400 mt-1">Prova a cambiare termine di ricerca</p>
                </div>
              ) : (
                filteredChapters.map((chapter) => {
                  const isChapExpanded = indexExpandedChapters.has(chapter.chapter_id);
                  const totalInChap = chapter.lessons?.length || 0;

                  return (
                    <div key={chapter.chapter_id} className="rounded-xl border border-primary-100/90 bg-white overflow-hidden shadow-2xs">
                      {/* Chapter Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleIndexChapter(chapter.chapter_id)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-left bg-gray-50/90 hover:bg-primary-50/60 transition-colors cursor-pointer select-none"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 block">
                            Modulo {chapter.order_number}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate mt-0.5">
                            {chapter.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-100/80 text-primary-800">
                            {totalInChap} {totalInChap === 1 ? 'lezione' : 'lezioni'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                              isChapExpanded ? 'rotate-180 text-primary-700' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Chapter Lessons */}
                      {isChapExpanded && (
                        <div className="p-2 space-y-1.5 border-t border-primary-50 bg-white">
                          {chapter.lessons && chapter.lessons.length > 0 ? (
                            chapter.lessons.map((les) => {
                              const isDispensa = !les.video_s3_key || les.video_s3_key.trim() === '' || les.duration_seconds === 0;

                              return (
                                <div
                                  key={les.lesson_id}
                                  className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50/70 hover:bg-primary-50/70 text-gray-700 border border-transparent hover:border-primary-200 transition-all group"
                                >
                                  {/* Click to jump to lesson in editor */}
                                  <button
                                    type="button"
                                    onClick={() => handleJumpToLesson(chapter.chapter_id, les.lesson_id)}
                                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                                    title="Clicca per andare direttamente a questa lezione nell'editor"
                                  >
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                        isDispensa
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-primary-100 text-primary-800'
                                      }`}
                                    >
                                      {isDispensa ? (
                                        <FileText className="w-3 h-3 text-amber-600" />
                                      ) : (
                                        les.order_number
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-900">
                                        {les.title}
                                      </span>
                                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                        {les.duration_seconds > 0 ? (
                                          <span className="font-mono">{formatDuration(les.duration_seconds)}</span>
                                        ) : (
                                          <span className="text-amber-700 font-medium">Dispensa PDF / Testo</span>
                                        )}
                                        {les.video_s3_key ? (
                                          <span className="text-emerald-700 font-semibold">• Video OK</span>
                                        ) : (
                                          <span className="text-amber-700 font-semibold">• No video</span>
                                        )}
                                      </div>
                                    </div>
                                  </button>

                                  {/* Quick Action Buttons in Drawer */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handlePreviewLesson(les)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer"
                                      title="Anteprima video"
                                      aria-label="Anteprima video"
                                    >
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEditLessonFromDrawer(chapter.chapter_id, les)}
                                      className="p-1.5 text-gray-600 hover:text-primary-700 hover:bg-primary-100/70 rounded-lg transition-colors cursor-pointer"
                                      title="Modifica lezione"
                                      aria-label="Modifica lezione"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-gray-400 italic p-2 text-center">Nessuna lezione in questo modulo</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2 flex-shrink-0">
              <span className="text-[11px] text-gray-500">
                Tocca una lezione per navigare nell'editor
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsIndexDrawerOpen(false)}
                className="text-xs"
              >
                Chiudi
              </Button>
            </div>

          </div>
        </div>,
        document.body
      )}


    </div>
  );
};
