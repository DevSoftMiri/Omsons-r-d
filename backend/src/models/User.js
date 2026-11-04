import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['Admin', 'Staff', 'Auditor'], default: 'Staff' },
    department: String,
    designation: String,
    isActive: { type: Boolean, default: true },
    notificationPreferences: {
      projectAssignment: { type: Boolean, default: true },
      stageCompleted: { type: Boolean, default: true },
      stageChanged: { type: Boolean, default: true },
      projectDeadlineApproaching: { type: Boolean, default: true },
      projectOverdue: { type: Boolean, default: true },
      certificateExpiring: { type: Boolean, default: true },
      certificateExpired: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
