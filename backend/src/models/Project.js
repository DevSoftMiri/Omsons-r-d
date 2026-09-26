import mongoose from 'mongoose';
import { WORKFLOW_STAGES } from '../constants/workflow.js';

const stageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ['Locked', 'Pending', 'In Progress', 'Submitted', 'Completed'], default: 'Locked' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    completedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminOverride: { type: Boolean, default: false },
    checklist: [
      {
        label: String,
        done: { type: Boolean, default: false }
      }
    ]
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    productCode: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true },
    description: String,
    startDate: { type: Date, required: true },
    targetDate: { type: Date, required: true },
    reportTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Running', 'On Hold', 'Completed', 'Delayed'], default: 'Running' },
    currentStage: { type: String, default: 'Prerequisites' },
    stages: { type: [stageSchema], default: [] },
    design: {
      description: String,
      images: [String],
      cadDrawings: [String],
      versions: [
        {
          version: String,
          notes: String,
          changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          changedAt: { type: Date, default: Date.now }
        }
      ]
    },
    programmingChecklist: [
      {
        label: String,
        done: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

projectSchema.pre('validate', function applyWorkflowDefaults(next) {
  if (!this.stages?.length) {
    this.stages = WORKFLOW_STAGES.map((name, index) => ({
      name,
      status: index === 0 ? 'Pending' : 'Locked',
      progress: 0
    }));
  }

  if (!this.programmingChecklist?.length) {
    this.programmingChecklist = ['Machine Parameters', 'PLC Logic', 'Testing Code', 'Final Validation'].map((label) => ({
      label,
      done: false
    }));
  }

  next();
});

projectSchema.virtual('overallProgress').get(function progress() {
  if (!this.stages?.length) return 0;
  return Math.round(this.stages.reduce((sum, stage) => sum + stage.progress, 0) / this.stages.length);
});

projectSchema.set('toJSON', { virtuals: true });

export const Project = mongoose.model('Project', projectSchema);
