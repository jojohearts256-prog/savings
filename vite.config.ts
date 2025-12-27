import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Reduce number of watched files by ignoring common large folders.
  server: {
    watch: {
      // ignore node_modules, git metadata and supabase migrations/functions
      ignored: ['**/node_modules/**', '**/.git/**', '**/supabase/**'],
    },
  },
});
