#!/bin/sh
# Regenerates the private GoAccess report from the Caddy access log. Run as root from /etc/cron.d.
OUT=/var/www/seams-report
mkdir -p "$OUT"
cat /var/log/caddy/seams.access.log* 2>/dev/null | grep -v '^$' | goaccess - \
  --log-format=CADDY --no-query-string --ignore-panel=KEYPHRASES --ignore-panel=GEO_LOCATION \
  --html-report-title='SEAMS traffic' -o "$OUT/index.html" 2>/dev/null
chown -R ubuntu:ubuntu "$OUT"
