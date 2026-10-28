#!/bin/sh
# Regenerates the private GoAccess report from the Caddy access log. Runs as root from /etc/cron.d.
# GoAccess 1.5.5 cannot parse Caddy 2.11 JSON, so convert to combined log format first.
OUT=/var/www/seams-report
mkdir -p "$OUT"
cat /var/log/caddy/seams.access.log* 2>/dev/null | jq -r 'select(.request and .status) |
  "\(.request.remote_ip) - - [\(.ts|floor|strftime("%d/%b/%Y:%H:%M:%S +0000"))] \"\(.request.method) \(.request.uri) \(.request.proto)\" \(.status) \(.size) \"\((.request.headers.Referer[0] // "-")|gsub("\"";""))\" \"\((.request.headers["User-Agent"][0] // "-")|gsub("\"";""))\""' 2>/dev/null |
  goaccess - --log-format=COMBINED --no-query-string --ignore-panel=KEYPHRASES --ignore-panel=GEO_LOCATION \
    --html-report-title='SEAMS traffic' -o "$OUT/new.html" 2>/dev/null &&
  mv "$OUT/new.html" "$OUT/index.html"
chown -R ubuntu:ubuntu "$OUT"
