'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ImageUploaderProps {
  currentUrl: string | null;
  onUpload: (url: string) => void;
  onDelete: () => void;
  folderPath: string; // e.g. 'syllabuses', 'classes', 'subjects'
}

export default function ImageUploader({ currentUrl, onUpload, onDelete, folderPath }: ImageUploaderProps) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folderPath}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('course-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('course-images')
        .getPublicUrl(fileName);

      if (data?.publicUrl) {
        onUpload(data.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentUrl) return;
    
    // Attempt to extract the file path from the URL
    // Public URL format: https://[project].supabase.co/storage/v1/object/public/course-images/[path]
    try {
      const urlParts = currentUrl.split('/course-images/');
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        setUploading(true);
        // We delete from storage but don't strictly wait to avoid blocking if it fails
        await supabase.storage.from('course-images').remove([filePath]);
      }
    } catch (e) {
      console.error('Error deleting from storage:', e);
    } finally {
      setUploading(false);
      onDelete();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {currentUrl ? (
        <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--surface-glass-border)' }}>
          <img src={currentUrl} alt="Uploaded preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <button 
            onClick={handleDelete}
            disabled={uploading}
            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            {uploading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : '📁 Select Image'}
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>
            Recommended: 16:9 ratio
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
