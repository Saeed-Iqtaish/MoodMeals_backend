import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pgclient from '../db.js';

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Hash password
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare password
export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// Extract token from request
const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
};

// Check JWT middleware
export const checkJwt = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const userResult = await pgclient.query(
      'SELECT id, username, email, is_admin FROM "user" WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    req.user = userResult.rows[0];
    next();

  } catch (error) {
    console.error('JWT verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please log in again'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to verify token'
    });
  }
};

// Extract user info (for logging)
export const extractUser = (req, res, next) => {
  if (req.user) {
    console.log('Authenticated user:', {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      isAdmin: req.user.is_admin
    });
  }
  next();
};

// Require admin middleware
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};