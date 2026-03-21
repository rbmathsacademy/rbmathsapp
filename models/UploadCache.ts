import mongoose, { Schema, Document } from 'mongoose';

export interface IUploadCache extends Document {
  uploadId: string;
  chunks: { index: number; data: string }[];
  totalChunks: number;
  
  // Metadata for the final GAS request
  batchName?: string;
  assignmentTitle?: string;
  studentName?: string;
  phoneNumber?: string;
  mimeType?: string;
  fileName?: string;

  createdAt: Date;
}

const UploadCacheSchema = new Schema(
  {
    uploadId: { type: String, required: true, unique: true },
    chunks: [
      {
        index: { type: Number, required: true },
        data: { type: String, required: true },
      },
    ],
    totalChunks: { type: Number, required: true },
    
    batchName: String,
    assignmentTitle: String,
    studentName: String,
    phoneNumber: String,
    mimeType: String,
    fileName: String,

    createdAt: { type: Date, default: Date.now, expires: 3600 }, // Auto delete after 1 hr
  },
  { timestamps: true }
);

export const UploadCache = mongoose.models.UploadCache || mongoose.model<IUploadCache>('UploadCache', UploadCacheSchema);
