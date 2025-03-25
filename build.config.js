module.exports = {
  // 服务配置
  service: {
    name: 'k8s-mcp',
    port: 8080,
    host: '0.0.0.0'
  },

  // 构建配置
  build: {
    entry: 'src/index.ts',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    minify: true
  },

  // TypeScript 配置
  typescript: {
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  },

  // 环境变量
  env: {
    PORT: '8080',
    NODE_ENV: process.env.NODE_ENV || 'development'
  }
}; 