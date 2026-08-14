#!/bin/sh
set -e
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
esac
backend_authority=${BACKEND_URL#*://}
case "$backend_authority" in
  ''|*/*|*\?*|*\#*|*@*) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
esac
envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
