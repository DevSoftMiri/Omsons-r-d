import mongoose from 'mongoose';

const projectModuleSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    module: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

projectModuleSchema.index({ project: 1, module: 1 }, { unique: true });

export const ProjectModule = mongoose.model('ProjectModule', projectModuleSchema);
