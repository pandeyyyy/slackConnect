import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { TokenManager } from '../services/TokenManager';
import * as dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

export interface AuthRequest extends express.Request {
  user?: any;
}

export const authenticateToken = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    const user = await User.findOne({ slackUserId: decoded.slackUserId });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const needsReauth = await TokenManager.needsReAuthentication(user.slackUserId);
    if (needsReauth) {
      return res.status(401).json({ 
        error: 'Re-authentication required',
        needsReauth: true 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
