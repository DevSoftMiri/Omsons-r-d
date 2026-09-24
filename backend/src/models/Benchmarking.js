import mongoose from 'mongoose';

const benchmarkingColumnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }
  },
  { _id: false }
);

const benchmarkingRowSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    cells: { type: Map, of: String, default: {} }
  },
  { _id: false }
);

const benchmarkingTableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    columns: { type: [benchmarkingColumnSchema], default: [] },
    rows: { type: [benchmarkingRowSchema], default: [] }
  },
  { timestamps: true }
);

const benchmarkingSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    tables: { type: [benchmarkingTableSchema], default: [] },
    reviewStatus: { type: String, enum: ['draft', 'completed'], default: 'draft' },
    completedAt: Date
  },
  { timestamps: true }
);

export const Benchmarking = mongoose.model('Benchmarking', benchmarkingSchema);
