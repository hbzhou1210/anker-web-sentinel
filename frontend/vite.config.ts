import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // 使用绝对路径,部署在根路径
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/discount-rule-output': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/discount-rule-tool': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
    // 代码分割 - 将依赖分离成独立的 chunk
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // React Query
          'vendor-query': ['@tanstack/react-query'],
          // UI 库
          'vendor-ui': ['lucide-react'],
          // 工具库
          'vendor-utils': ['axios'],
        },
      },
    },
    // 生产环境压缩 - 使用 esbuild (更快且内置)
    minify: 'esbuild',
    // esbuild 压缩选项
    esbuildOptions: {
      drop: ['console', 'debugger'], // 移除 console 和 debugger
    },
    // chunk 大小警告阈值 (KB)
    chunkSizeWarningLimit: 500,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 构建后生成 source map (方便调试)
    sourcemap: false, // 生产环境关闭 sourcemap
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
