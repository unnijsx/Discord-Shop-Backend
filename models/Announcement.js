// server/models/Announcement.js
import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  severity: { // e.g., 'info', 'warning', 'error', 'success' (for frontend display)
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  isActive: { // Admin can activate/deactivate
    type: Boolean,
    default: true
  },
  createdBy: { // Who created the announcement (Admin ID)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

announcementSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Announcement', announcementSchema);