# Build Frontend
FROM node:18.15-bullseye-slim AS frontend-builder

COPY ./frontend/package.json /frontend/package.json

WORKDIR /frontend

RUN npm install -g npm@9

RUN npm install 

COPY ./frontend /frontend

RUN npm run build

# Build Backend
FROM node:18.15-bullseye-slim AS backend-builder

COPY ./backend/package.json /backend/package.json

WORKDIR /backend

RUN npm install -g npm@9

RUN npm install

COPY ./backend /backend

RUN npm run build

# Build Production Image
FROM node:18.15-bullseye-slim

COPY --from=backend-builder /backend/package.json /app/package.json

WORKDIR /app

RUN npm install -g npm@9

RUN npm install

COPY --from=frontend-builder /frontend/dist /app/public

COPY --from=backend-builder /backend/asset/ /app/public/assets/

COPY --from=backend-builder /backend/dist /app/dist

EXPOSE 3000

ENV NODE_ENV=production

CMD [ "npm", "run", "start:prod" ]
