import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    // 绑定到 0.0.0.0，允许局域网其他设备访问
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // 如果需要在局域网手机/其它设备上启用 HMR，
    // 可将 hmr.host 设置为本机局域网 IP
    // hmr: { host: '192.168.x.x' },
    cors: true, // 启用 CORS
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8088',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
