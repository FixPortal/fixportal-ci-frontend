#!/bin/sh
set -e
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) echo "Error: BACKEND_URL must start with http:// or https://" >&2; exit 1 ;;
esac
backend_authority=${BACKEND_URL#*://}
case "$backend_authority" in
  ''|*/*|*\?*|*\#*|*@*)
    echo "Error: BACKEND_URL must be a bare origin: no path, query, fragment, or userinfo" >&2
    exit 1
    ;;
  # '_' is legal here: underscores are valid Docker network aliases and common
  # in compose-derived hostnames. Bracketed IPv6 literals are deliberately NOT
  # supported (the ':'-based port split below cannot parse them) — say so,
  # because an operator who passed a bare IPv6 origin must learn that, not be
  # told to "pass a bare origin".
  *[!A-Za-z0-9._:-]*)
    echo "Error: BACKEND_URL host contains characters outside [A-Za-z0-9._-] (bracketed IPv6 literals are not supported)" >&2
    exit 1
    ;;
  :*|*:*:*)
    echo "Error: BACKEND_URL must be host or host:port (multiple colons mean an IPv6 literal, which is not supported)" >&2
    exit 1
    ;;
  *:*)
    backend_port=${backend_authority#*:}
    case "$backend_port" in
      '') echo "Error: BACKEND_URL has a trailing ':' but no port" >&2; exit 1 ;;
      *[!0-9]*) echo "Error: BACKEND_URL port must be numeric" >&2; exit 1 ;;
    esac
    while [ "${backend_port#0}" != "$backend_port" ]; do backend_port=${backend_port#0}; done
    [ -n "$backend_port" ] || backend_port=0
    case "$backend_port" in
      ??????*) echo "Error: BACKEND_URL port must be between 1 and 65535" >&2; exit 1 ;;
    esac
    if [ "$backend_port" -eq 0 ] || [ "$backend_port" -gt 65535 ]; then
      echo "Error: BACKEND_URL port must be between 1 and 65535" >&2
      exit 1
    fi
    ;;
esac
# shellcheck disable=SC2016 # envsubst must receive the literal placeholder.
envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
