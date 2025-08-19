// server/controllers/productController.js
import Product from '../models/Product.js';

// Get all products (with optional search, filter, sort)
export const getAllProducts = async (req, res) => {
  try {
    const { searchTerm, filterOption, sortOption } = req.query; // Get query parameters

    let query = {};
    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i'); // Case-insensitive regex
      query.$or = [ // Search across multiple fields
        { name: regex },
        { description: regex },
        { longDescription: regex },
        { category: regex }
      ];
    }

    if (filterOption && filterOption !== 'all') {
      query.category = filterOption;
    }

    let sort = {};
    switch (sortOption) {
      case 'price-low':
        sort = { price: 1 }; // Sort by price ascending
        break;
      case 'price-high':
        sort = { price: -1 }; // Sort by price descending
        break;
      case 'name-az':
        sort = { name: 1 }; // Sort by name ascending
        break;
      case 'name-za':
        sort = { name: -1 }; // Sort by name descending
        break;
      default:
        sort = { createdAt: -1 }; // Default: newest first
        break;
    }

    const products = await Product.find(query).sort(sort);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error fetching products.' });
  }
};

// Get a single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ message: 'Server error fetching product.' });
  }
};

// Get featured products (for UserLanding)
export const getFeaturedProducts = async (req, res) => {
  try {
    const featuredProducts = await Product.find({ isFeatured: true }).limit(6); // Limit to 6 for a section
    res.json(featuredProducts);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ message: 'Server error fetching featured products.' });
  }
};

// --- Admin/Seed Functions (Optional, for populating data) ---

// Create a new product (requires admin or authentication)
export const createProduct = async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error creating product.' });
  }
};

// Update a product by ID (requires admin or authentication)
export const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error updating product.' });
  }
};

// Delete a product by ID (requires admin or authentication)
export const deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error deleting product.' });
  }
};