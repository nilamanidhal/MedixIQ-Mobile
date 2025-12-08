const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  try {
    // 1. Get token from the Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // 2. Verify the token and get the userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Find the user in the database
    const user = await User.findById(decoded.userId);
    if (!user) {
        return res.status(401).json({ message: 'Invalid token. User not found.' });
    }
    
    // 4. Check if the user is an admin
    if (!user.isAdmin) {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    
    // 5. Attach user info to the request and proceed
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
