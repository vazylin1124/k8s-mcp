FROM node:20-alpine

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./
COPY tsconfig.json ./
COPY .env* ./

# 如果 .env 文件不存在，则使用 .env.example
RUN if [ ! -f .env ]; then \
      if [ -f .env.example ]; then \
        cp .env.example .env; \
      else \
        echo "PORT=3000\nNODE_ENV=production" > .env; \
      fi \
    fi

# 安装依赖
RUN npm install

# 复制源代码
COPY src/ ./src/

# 构建项目
RUN npm run build

# 清理开发依赖
RUN npm prune --production

# 设置环境变量
ENV PORT=3000
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "start"] 