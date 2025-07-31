FROM node:20.18.1

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# เปิดพอร์ต 188 ตามที่ server.js ใช้งาน
EXPOSE 188

CMD ["node", "server.js"]
