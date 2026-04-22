import '@testing-library/jest-dom/vitest';

if (typeof process.env.BACKEND_URL === 'undefined') {
  process.env.BACKEND_URL = 'http://backend.test';
}
