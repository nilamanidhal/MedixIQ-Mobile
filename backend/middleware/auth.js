const admin = require('../config/firebase'); // Your Firebase Admin SDK setup
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // 🔥 Ask Firebase to verify the token
    const decoded = await admin.auth().verifyIdToken(token);
    
    // 🔥 Find the user using their secure Firebase UID instead of MongoDB _id
    const user = await User.findOne({ firebaseUid: decoded.uid }).select('-password');
    
    // Attach data to the request. 
    // Note: 'user' might be null if they just signed up and haven't created their profile yet.
    req.firebaseUid = decoded.uid;
    req.firebaseEmail = decoded.email;
    req.user = user; 
    
    next();
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(401).json({ message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;















// const jwt = require('jsonwebtoken');
// const User = require('../models/User');


// const authMiddleware = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization')?.replace('Bearer ', '');
    
//     if (!token) {
//       return res.status(401).json({ message: 'Access denied. No token provided.' });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.userId).select('-password');
    
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid token. User not found.' });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Invalid token.' });
//     }
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Token expired.' });
//     }
//     res.status(500).json({ message: 'Server error during authentication.' });
//   }
// };

// module.exports = authMiddleware;