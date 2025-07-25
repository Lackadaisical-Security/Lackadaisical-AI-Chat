# Testing Lackadaisical AI Chat Frontend

**Date:** 25/07/2025
**Project:** Lackadaisical AI Chat by Lackadaisical Security

## Test Frameworks
- Jest (unit/integration)
- React Testing Library (component/UI)
- @testing-library/react-hooks (Zustand store)

## How to Run Tests

1. Install all dependencies:
   ```sh
   cd frontend
   npm install
   ```
   (If you see missing module errors, ensure you have installed: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `jest`, `@types/jest`, `ts-jest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/react-hooks`, `identity-obj-proxy`)

2. Run all tests:
   ```sh
   npm test
   ```

## Test Coverage
- `tests/App.test.tsx`: Renders main app, checks for title.
- `tests/store.test.ts`: Zustand store logic (add/update messages, context window).
- Add more tests in `tests/` as needed for components, hooks, and utilities.

## Notes
- All tests are local and require no network/cloud.
- For best results, use Node.js v18+ and npm v9+.
- If you add new features, add corresponding tests in `tests/`.

---
© 2025 Lackadaisical Security. All rights reserved.
