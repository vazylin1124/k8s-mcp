module.exports = {
  // 服务配置
  service: {
    name: 'k8s-mcp',
    version: '1.0.0',
    protocol: 'MCP/2.0',
    port: 3000,
    host: '0.0.0.0'
  },

  // 构建配置
  build: {
    entry: 'src/index.ts',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    minify: false
  },

  // TypeScript 配置
  typescript: {
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    declaration: true
  },

  // 环境变量
  env: {
    PORT: '3000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    SMITHERY: process.env.SMITHERY || 'false'
  }
}; 