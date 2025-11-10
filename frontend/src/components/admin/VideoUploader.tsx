import React, { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { adminService } from '../../services/adminService';
import { validateVideoFile } from '../../utils/validators';

interface VideoUploaderProps {
  lessonId?: string;
  onUploadComplete: (videoKey: string) => void;
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

  const handleFileSelect = (selectedFile: File) => {
    const validation = validateVideoFile(selectedFile);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      // Get pre-signed URL
      const uploadData = await adminService.getUploadUrl({
        file_name: file.name,
        file_type: file.type,
        lesson_id: lessonId,
      });

      // Upload to S3 with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setSuccess(true);
          setProgress(100);
          onUploadComplete(uploadData.video_s3_key);

          // Reset after 2 seconds
          setTimeout(() => {
            setFile(null);
            setSuccess(false);
            setProgress(0);
          }, 2000);
        } else {
          throw new Error('Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('Upload failed');
      });

      xhr.open('PUT', uploadData.upload_url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

      await new Promise((resolve, reject) => {
        xhr.addEventListener('load', resolve);
        xhr.addEventListener('error', reject);
      });
    } catch (err: any) {
      setError(err.message || 'Failed to upload video');
      setProgress(0);
    } finally {
      setUploading(false);
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
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop video file here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: MP4, WebM, OGG (Max 2GB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* File Selected */}
      {file && (
        <div className="border border-gray-200 rounded-lg p-6">
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
              <button onClick={removeFile} className="text-gray-400 hover:text-gray-600">
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
              Upload Video
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
