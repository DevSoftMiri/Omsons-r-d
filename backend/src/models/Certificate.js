import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    type: {
      type: String,
      enum: ['ISO Certificate', 'Calibration Certificate', 'Material Test Report', 'Requirement Document', 'Drawing Approval'],
      required: true
    },
    fileName: String,
    mimeType: String,
    fileSize: Number,
    storagePath: String,
    publicUrl: String,
    fileUrl: String,
    status: { type: String, enum: ['Missing', 'Uploaded', 'Approved', 'Rejected'], default: 'Missing' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNotes: String,
    rejectedReason: String
  },
  { timestamps: true }
);

export const Certificate = mongoose.model('Certificate', certificateSchema);
