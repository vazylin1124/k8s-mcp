FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY src/ ./src/
COPY k8s_config.yaml ./

# 构建
RUN npm run build

# 设置环境变量
ENV NODE_ENV=production
ENV SMITHERY=false
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "run", "start:http"] 