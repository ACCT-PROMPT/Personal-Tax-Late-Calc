import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  // path แบบสัมพัทธ์ ให้เสิร์ฟได้ทั้งที่ root (subdomain) และใต้ path ย่อย (GitHub Pages: /Personal-Tax-Late-Calc/)
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
