// server/controllers/announcementController.js
import Announcement from '../models/Announcement.js';

// Create a new announcement (Admin only)
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, severity, isActive } = req.body;
    // Assuming req.session.user.id is available from 'protect' middleware
    const newAnnouncement = new Announcement({
      title,
      content,
      severity: severity || 'info',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.session.user.id // Link to the admin who created it
    });
    const savedAnnouncement = await newAnnouncement.save();
    res.status(201).json(savedAnnouncement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Server error creating announcement.' });
  }
};

// Get all active announcements (for all users)
export const getAllActiveAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    res.status(500).json({ message: 'Server error fetching announcements.' });
  }
};

// Get all announcements (Admin only - including inactive)
export const getAllAnnouncementsAdmin = async (req, res) => {
  try {
    const announcements = await Announcement.find({}).sort({ createdAt: -1 }).populate('createdBy', 'username'); // Populate who created it
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching all announcements (Admin):', error);
    res.status(500).json({ message: 'Server error fetching announcements.' });
  }
};

// Update an announcement (Admin only)
export const updateAnnouncement = async (req, res) => {
  try {
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedAnnouncement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    res.json(updatedAnnouncement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ message: 'Server error updating announcement.' });
  }
};

// Delete an announcement (Admin only)
export const deleteAnnouncement = async (req, res) => {
  try {
    const deletedAnnouncement = await Announcement.findByIdAndDelete(req.params.id);
    if (!deletedAnnouncement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    res.json({ message: 'Announcement deleted successfully.' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ message: 'Server error deleting announcement.' });
  }
};