// server/middleware/admin.js
const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    // FIX: Your JWT payload has nested structure
    const userId = req.user.user ? req.user.user.id : req.user.id;
    console.log('Admin middleware - User ID:', userId);
    console.log('Admin middleware - Full req.user:', req.user);
    
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('Admin middleware - User not found for ID:', userId);
      return res.status(404).json({ msg: 'User not found' });
    }
    
    if (!user.isAdmin) {
      console.log('Admin middleware - User is not admin:', user.email);
      return res.status(403).json({ msg: 'Admin authorization denied' });
    }
    
    console.log('Admin middleware - Access granted for:', user.email);
    next();
  } catch (err) {
    console.error('Admin middleware error:', err.message);
    res.status(500).json({ error: 'Server error in admin middleware' });
  }
};