import Tailwindcss from '@tailwindcss/vite';
import React from '@vitejs/plugin-react';
import Path from 'path';
import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // This makes process.env.GEMINI_API_KEY available in your client-side code
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    plugins: [
      React(),
      Tailwindcss(),
    ],
    resolve: {
      alias: {
        // Allows you to use '@/' to refer to your src directory
        '@': Path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      open: true, // Automatically opens the browser on server start
      proxy: {
        // Useful if you eventually need to bypass CORS for API calls
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
