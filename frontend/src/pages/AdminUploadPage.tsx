import React, { useState } from 'react';
import { VideoUploader } from '../components/admin/VideoUploader';
import { CheckCircle } from 'lucide-react';

export const AdminUploadPage: React.FC = () => {
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);

  const handleUploadComplete = (videoKey: string) => {
    setUploadedVideos((prev) => [...prev, videoKey]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Videos</h1>
        <p className="text-gray-600">
          Upload video files to use in your course lessons
        </p>
      </div>

      {/* Uploader */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <VideoUploader onUploadComplete={handleUploadComplete} />
      </div>

      {/* Recently Uploaded */}
      {uploadedVideos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recently Uploaded
          </h2>
          <div className="space-y-2">
            {uploadedVideos.map((videoKey, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"
              >
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-900 font-mono truncate">
                  {videoKey}
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Use these video keys when creating or editing lessons in the Course Structure page.
          </p>
        </div>
      )}
    </div>
  );
};
