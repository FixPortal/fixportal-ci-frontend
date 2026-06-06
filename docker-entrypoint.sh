#!/bin/sh
set -e
if [ -z "$BACKEND_URL" ]; then
  echo "Error: BACKEND_URL must be set (e.g. -e BACKEND_URL=http://backend:3000)" >&2
  exit 1
fi
envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
