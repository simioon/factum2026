FROM node:26-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./
RUN npm install --omit=dev

COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["node", "server.js"]
