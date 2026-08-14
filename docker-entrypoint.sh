#!/bin/sh
set -e
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
esac
backend_authority=${BACKEND_URL#*://}
case "$backend_authority" in
  ''|*/*|*\?*|*\#*|*@*|*[!A-Za-z0-9.:-]*|:*|*:|*:*:*) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
  *:*)
    backend_port=${backend_authority#*:}
    case "$backend_port" in
      ''|*[!0-9]*) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
    esac
    while [ "${backend_port#0}" != "$backend_port" ]; do backend_port=${backend_port#0}; done
    [ -n "$backend_port" ] || backend_port=0
    case "$backend_port" in
      ??????*) echo "Error: BACKEND_URL must be a bare http(s) origin" >&2; exit 1 ;;
    esac
    if [ "$backend_port" -eq 0 ] || [ "$backend_port" -gt 65535 ]; then
      echo "Error: BACKEND_URL must be a bare http(s) origin" >&2
      exit 1
    fi
    ;;
esac
# shellcheck disable=SC2016 # envsubst must receive the literal placeholder.
envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
