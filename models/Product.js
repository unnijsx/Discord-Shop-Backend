// server/models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true // Product names should probably be unique
  },
  description: {
    type: String,
    required: true
  },
  longDescription: { // More detailed description for product details page
    type: String
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: { // Optional discounted price
    type: Number,
    min: 0
  },
  image: { // URL to product image
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Subscriptions', 'Boosts', 'Bots', 'Assets', 'Services', 'Roles'] // Enforce valid categories
  },
  tags: [String], // Array of strings for tags (e.g., Popular, Limited Time)
  isFeatured: { // For UserLanding featured products
    type: Boolean,
    default: false
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

// Update `updatedAt` field on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Product', productSchema);