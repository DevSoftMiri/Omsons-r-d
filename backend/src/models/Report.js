import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: Date, required: true },
    workDone: { type: String, required: true },
    hours: { type: Number, min: 0, max: 24, default: 0 },
    attachments: [String],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Submitted', 'Approved', 'Rejected'], default: 'Submitted' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export const Report = mongoose.model('Report', reportSchema);
