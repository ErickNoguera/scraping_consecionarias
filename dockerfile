FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build || true
CMD ["node", "dist/index.js"]
