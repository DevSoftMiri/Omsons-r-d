import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: String,
    message: String,
    read: { type: Boolean, default: false },
    link: String
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
