import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    stage: String,
    name: String,
    mimeType: String,
    fileSize: Number,
    storagePath: String,
    url: String,
    fileUrl: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export const Attachment = mongoose.model('Attachment', attachmentSchema);
