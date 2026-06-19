FROM node:22-alpine@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/ci-frontend/package.json packages/ci-frontend/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci
COPY . .
RUN npm run build:lib
RUN npm run build:app

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
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
