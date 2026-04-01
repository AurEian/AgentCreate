# Glass Blog - Docker 镜像
# 基于 Node.js 官方镜像

FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 先复制 package.json 安装依赖（利用 Docker 缓存层）
COPY package*.json ./
RUN npm install --production

# 复制项目代码
COPY . .

# 创建上传目录
RUN mkdir -p public/uploads

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
