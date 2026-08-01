import React, { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { adminService } from '../../services/adminService';
import { validateVideoFile } from '../../utils/validators';
import { getErrorMessage } from '../../utils/errors';

interface VideoUploaderProps {
  lessonId?: string;
  // FIX: Modificato per passare anche la durata
  onUploadComplete: (videoKey: string, duration: number) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  lessonId,
  onUploadComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  // FIX: Funzione per ottenere la durata del video
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => {
        reject('Failed to load video metadata.');
      };
      video.src = window.URL.createObjectURL(file);
    });
  };

  const uploadVideo = async (selectedFile: File) => {
    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      let duration = 0;
      try {
        duration = await getVideoDuration(selectedFile);
      } catch (err) {
        console.error(err);
      }

      const uploadData = await adminService.getUploadUrl({
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        lesson_id: lessonId,
      });

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setSuccess(true);
          setProgress(100);
          setUploading(false);
          onUploadComplete(uploadData.video_s3_key, duration);

          setTimeout(() => {
            setFile(null);
            setSuccess(false);
            setProgress(0);
          }, 2000);
        } else {
          setError('Upload fallito. Riprova.');
          setUploading(false);
        }
      });

      xhr.addEventListener('error', () => {
        setError('Upload fallito. Controlla la connessione e riprova.');
        setUploading(false);
      });

      xhr.open('PUT', uploadData.upload_url);
      xhr.setRequestHeader('Content-Type', selectedFile.type);
      xhr.send(selectedFile);
    } catch (err) {
      setError(getErrorMessage(err, 'Caricamento video fallito'));
      setProgress(0);
      setUploading(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const validation = validateVideoFile(selectedFile);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);

    void uploadVideo(selectedFile);
  };

  const handleUpload = () => {
    if (file && !uploading) {
      void uploadVideo(file);
    }
  };


  const removeFile = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors sm:p-12 ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="mb-2 text-base font-medium text-gray-700 sm:text-lg">
            Carica un video o tocca per sceglierlo
          </p>
          <p className="text-sm text-gray-500">
            Formati: MP4, MOV, WebM, OGG — massimo 2 GB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-quicktime,video/webm,video/ogg,.mov"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* File Selected */}
      {file && (
        <div className="rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <File className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!uploading && !success && (
              <button type="button" onClick={removeFile} className="-m-2 min-h-11 min-w-11 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Rimuovi video selezionato">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm font-medium text-gray-700">
                  {progress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Upload successful!</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Upload Button */}
          {!uploading && !success && (
            <Button
              onClick={handleUpload}
              loading={uploading}
              fullWidth
              variant="primary"
            >
              Riprova caricamento video
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
