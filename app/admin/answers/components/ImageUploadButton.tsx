'use client';

import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ImageUploadButtonProps {
    onImageUploaded: (base64: string) => void;
    label?: string;
    className?: string;
}

export default function ImageUploadButton({ onImageUploaded, label = "Upload Image", className = "" }: ImageUploadButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB hard limit
            toast.error('File too large (Max 5MB)');
            return;
        }

        setUploading(true);

        try {
            // Client-side compression
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize large images
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Compress to JPEG 0.7 quality
                    let compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                    if (compressedBase64.length > 500 * 1024) {
                        // If still > 500KB, try more aggressive compression
                        compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
                    }

                    onImageUploaded(compressedBase64);
                    setUploading(false);
                    toast.success('Image uploaded and compressed');

                    // Reset input
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                };
                img.onerror = () => {
                    toast.error('Failed to load image');
                    setUploading(false);
                };
            };
            reader.onerror = () => {
                toast.error('Failed to read file');
                setUploading(false);
            };
        } catch (error) {
            toast.error('Upload failed');
            setUploading(false);
        }
    };

    return (
        <div className={className}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
            />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {uploading ? (
                    <>
                        <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <ImageIcon className="h-3 w-3" />
                        {label}
                    </>
                )}
            </button>
        </div>
    );
}
