import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle, FileImage, Upload, X } from 'lucide-react';
import { Button } from '../common/Button';
import { adminService } from '../../services/adminService';
import { getErrorMessage } from '../../utils/errors';

interface ImageUploaderProps {
  folder: string;
  label?: string;
  onUploadComplete: (imageUrl: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  folder,
  label = 'Immagine',
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Seleziona un file immagine valido.');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const uploadData = await adminService.getImageUploadUrl({
        file_name: file.name,
        file_type: file.type,
        folder,
      });
      await adminService.uploadImageToS3(uploadData.upload_url, file);
      onUploadComplete(uploadData.image_url);
      setSuccess(true);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Upload immagine fallito'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <FileImage className="w-4 h-4" />
        <span>{label}</span>
      </div>

      {!file ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-6 text-center hover:border-primary-300"
        >
          <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-700">Carica immagine da PC</p>
          <p className="mt-1 text-xs text-gray-500">PNG, JPG, WEBP, GIF</p>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
          {!uploading && (
            <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) {
            handleSelect(selected);
          }
        }}
        className="hidden"
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Immagine caricata con successo.</span>
        </div>
      )}

      <Button type="button" onClick={handleUpload} variant="secondary" fullWidth loading={uploading} disabled={!file}>
        Carica immagine
      </Button>
    </div>
  );
};
