import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const getJwtSecret = () => process.env.JWT_SECRET || 'your-fallback-secret-for-dev';
const getJwtExpire = () => process.env.JWT_EXPIRE || '7d';

// Enforce JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && (!getJwtSecret() || getJwtSecret() === 'your-secret-key')) {
  throw new Error('FATAL ERROR: JWT_SECRET is not set or is insecure in production.');
}

// Generate JWT Token
export const generateToken = (userId) => {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: getJwtExpire() });
};

// Verify JWT Token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
};

// Hash Password
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare Password
export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// Middleware: Verify Auth Token
export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication error'
    });
  }
};

export default {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  authMiddleware
};
