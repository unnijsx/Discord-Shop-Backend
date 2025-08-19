import mongoose from 'mongoose';

const redemptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reward: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward',
    required: true
  },
  rewardName: { // Snapshot name
    type: String,
    required: true
  },
  creditCost: { // Snapshot cost
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  adminRemarks: { // Reason for rejection or approval notes
    type: String
  },
  processedBy: { // Admin/Staff who processed it
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  redeemedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  }
});

export default mongoose.model('Redemption', redemptionSchema);