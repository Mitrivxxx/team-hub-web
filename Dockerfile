FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/team-hub-web/package.json ./
RUN npm install

COPY frontend/team-hub-web/ ./
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl bash

COPY scripts/generate-certs.sh /generate-certs.sh
COPY frontend/team-hub-web/docker-entrypoint.sh /docker-entrypoint.sh
COPY frontend/team-hub-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/team-hub-web/browser /usr/share/nginx/html
RUN chmod +x /generate-certs.sh /docker-entrypoint.sh

EXPOSE 4200
ENTRYPOINT ["/docker-entrypoint.sh"]
