import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep the authenticated course usable on older still-supported Safari,
    // iOS, Chromium, Firefox and Edge releases instead of shipping esnext
    // syntax that only the newest browsers can parse.
    target: ['es2019', 'chrome80', 'edge80', 'firefox78', 'safari13.1', 'ios13.4'],
    minify: 'esbuild',
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !dep.includes('video-engine') && !dep.includes('dash') && !dep.includes('hls'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('aws-amplify') || id.includes('@aws-amplify')) {
              return 'vendor-amplify';
            }
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
  },
})
