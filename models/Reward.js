// server/models/Reward.js
import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String, // URL to reward image
    default: 'https://via.placeholder.com/150'
  },
  creditCost: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['Subscriptions', 'Assets', 'Boosts', 'Roles', 'Other'],
    default: 'Other'
  },
  isAvailable: { // Admin can hide/show rewards
    type: Boolean,
    default: true
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

rewardSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Reward', rewardSchema);