import mongoose from 'mongoose';

const bomWorkspaceSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export const BomWorkspace = mongoose.model('BomWorkspace', bomWorkspaceSchema);
