FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY shared ../shared
COPY frontend .
ARG VITE_API_URL=
ARG VITE_FASTAPI_URL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_FASTAPI_URL=${VITE_FASTAPI_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
