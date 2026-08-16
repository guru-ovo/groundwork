import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly rather than drifting to 5174.
    //
    // The backend allows exactly one dev origin (http://localhost:5173). When
    // Vite finds 5173 busy it silently takes the next free port, the browser
    // then sends an Origin the API has never heard of, and every request dies
    // in CORS preflight with a 400 — which reads as a broken backend rather
    // than as a second dev server nobody meant to leave running.
    //
    // Refusing to start says that in one line, at the moment it happens.
    strictPort: true,
  },
})
