import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
//
// GitHub Pages 项目页部署在子路径下（如 https://<user>.github.io/planote/），
// 资源必须以 /planote/ 为基准引用，否则会 404。
// 本地开发保持根路径 '/'，避免 dev server 被迫挂在 /planote/ 下。
// CI 中通过环境变量 GITHUB_PAGES=true 开启子路径 base。
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? '/planote/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
