FROM node:20-alpine

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY src/ ./src/

# 构建项目
RUN npm run build

# 清理开发依赖
RUN npm prune --production

# 复制环境配置文件
COPY .env.example .env
COPY k8s_config.yaml ./

# 如果 .env 文件不存在，则创建默认配置
RUN if [ ! -f .env ]; then \
      if [ -f .env.example ]; then \
        cp .env.example .env; \
      else \
        echo "PORT=3000\nNODE_ENV=production" > .env; \
      fi \
    fi

# 设置默认环境变量
ENV PORT=3000 \
    NODE_ENV=production \
    SMITHERY=false

# 暴露端口
EXPOSE 3000

# 使用 shell 形式的 ENTRYPOINT，允许环境变量覆盖
ENTRYPOINT ["node", "-r", "dotenv/config", "dist/index.js"] 