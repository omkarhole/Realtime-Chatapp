import jwt from 'jsonwebtoken';
import { AUTH } from '../constants/index.js';

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: AUTH.TOKEN_EXPIRY
  });
  
  res.cookie(AUTH.COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: AUTH.COOKIE_MAX_AGE,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production"
  });
  
  return token;
};
