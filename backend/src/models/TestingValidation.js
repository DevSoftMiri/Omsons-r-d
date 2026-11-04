import mongoose from 'mongoose';

const testingValidationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    tables: { type: mongoose.Schema.Types.Mixed, default: [] },
    reviewStatus: { type: String, enum: ['draft', 'completed'], default: 'draft' },
    completedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export const TestingValidation = mongoose.model('TestingValidation', testingValidationSchema);
