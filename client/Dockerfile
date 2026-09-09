FROM node:22-alpine

WORKDIR /client

COPY package*.json .

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD [ "npm", "start" ]
