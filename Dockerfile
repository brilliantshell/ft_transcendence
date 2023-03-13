FROM node:18.15-bullseye-slim AS frontend-builder

COPY ./frontend/package.json /frontend/package.json

WORKDIR /frontend

RUN npm install -g npm@9

RUN npm install 

COPY ./frontend /frontend

RUN npm run build

FROM node:18.15-bullseye-slim AS backend-builder

COPY ./backend/package.json /backend/package.json

WORKDIR /backend

RUN npm install -g npm@9

RUN npm install

COPY ./backend /backend

RUN npm run build

FROM node:18.15-bullseye-slim

WORKDIR /app

COPY --from=backend-builder /backend/package.json /app/package.json

RUN npm install -g npm@9

COPY --from=frontend-builder /frontend/dist /app/frontend/dist
COPY --from=backend-builder /backend/dist /app/dist
COPY --from=backend-builder /backend/node_modules /app/node_modules
COPY --from=backend-builder /backend/package.json /app/package.json

EXPOSE 3000

ENV NODE_ENV=production

ENV HOST=${HOST}

CMD [ "npm", "run", "start:prod" ]
