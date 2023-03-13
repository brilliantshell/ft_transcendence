FROM node:18.13.0-bullseye AS frontend-builder

COPY ./frontend/package.json /frontend/package.json

WORKDIR /frontend

RUN npm install -g npm@9

RUN npm install 

COPY ./frontend /frontend

RUN npm run build

FROM node:18.13.0-bullseye AS backend-builder

COPY ./backend/package.json /backend/package.json

WORKDIR /backend

RUN npm install -g npm@9

RUN npm install

COPY ./backend /backend

RUN npm run build

FROM node:18.13.0-bullseye

WORKDIR /app

COPY --from=backend-builder /backend/package.json /app/package.json

RUN npm install -g npm@9

RUN npm install

COPY --from=frontend-builder /frontend/dist /app/frontend/dist
COPY --from=backend-builder /backend/dist /app/dist
# COPY --from=backend-builder /backend/node_modules /app/node_modules
COPY --from=backend-builder /backend/package.json /app/package.json

EXPOSE 3000

ENV NODE_ENV=production

CMD [ "npm", "run", "start:prod" ]
