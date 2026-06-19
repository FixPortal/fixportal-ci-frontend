FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/ci-frontend/package.json packages/ci-frontend/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci
COPY . .
RUN npm run build:lib
RUN npm run build:app

FROM nginx:alpine
LABEL org.opencontainers.image.source="https://github.com/FixPortal/fixportal-ci-frontend"
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chown -R nginx:nginx /usr/share/nginx/html /etc/nginx/conf.d /var/cache/nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid /docker-entrypoint.sh \
    && chmod +x /docker-entrypoint.sh
EXPOSE 8080
USER nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
