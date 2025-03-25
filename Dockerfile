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

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "start"] 