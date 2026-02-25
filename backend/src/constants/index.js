// Authentication constants
export const AUTH = {
  SALT_ROUNDS: 10,
  TOKEN_EXPIRY: '7d',
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  COOKIE_NAME: 'jwt'
};

// Message constants
export const MESSAGE = {
  DELETE_TIMEOUT_HOURS: 24,
  DELETE_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  SEARCH_LIMIT: 50,
  EXPORT_LIMIT: 1000
};

// Pagination constants
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Upload constants
export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf', 'audio/mp3'],
  JSON_LIMIT: "10mb"
};

// Server constants
export const SERVER = {
  DEFAULT_PORT: 5001,
  DEV_FRONTEND_URL: "http://localhost:5173"
};
