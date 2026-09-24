import mongoose from 'mongoose';
import { PROCUREMENT_STAGES } from '../constants/workflow.js';

const bomItemSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    materialName: { type: String, required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    quantity: { type: Number, default: 1, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 0, min: 0 },
    procurementStage: { type: String, enum: PROCUREMENT_STAGES, default: 'Called' },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const BomItem = mongoose.model('BomItem', bomItemSchema);
