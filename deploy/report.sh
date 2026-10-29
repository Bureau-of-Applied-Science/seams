#!/bin/sh
# Regenerates the private reports from the Caddy access log. Runs as root from /etc/cron.d.
# LOG_GLOB and OUT can be overridden to test without root.
#   index.html    GoAccess traffic report
#   arrivals.txt  visits and unfurls per industry link (?start=<id>), split by an optional &src=<channel>
LOG_GLOB=${LOG_GLOB:-/var/log/caddy/seams.access.log*}
OUT=${OUT:-/var/www/seams-report}
ERR=/dev/null
[ -n "$DEBUG" ] && ERR=/dev/stderr
mkdir -p "$OUT"

# Both reports read the log through this filter, which drops any line that is not valid JSON, such as a
# half-written line at the tail of the live log. One bad line must not empty a report.
lines() { cat $LOG_GLOB 2>/dev/null | jq -R -c 'fromjson?' 2>"$ERR"; }

# GoAccess 1.5.5 cannot parse Caddy 2.11 JSON, so convert to combined log format first.
lines | jq -r 'select(.request and .status and .request.uri != "/b") |
  "\(.request.remote_ip) - - [\(.ts|floor|strftime("%d/%b/%Y:%H:%M:%S +0000"))] \"\(.request.method) \(.request.uri) \(.request.proto)\" \(.status) \(.size) \"\((.request.headers.Referer[0] // "-")|gsub("\"";""))\" \"\((.request.headers["User-Agent"][0] // "-")|gsub("\"";""))\""' 2>"$ERR" |
  goaccess - --log-format=COMBINED --no-query-string --ignore-panel=KEYPHRASES --ignore-panel=GEO_LOCATION \
    --html-report-title='SEAMS traffic' -o "$OUT/new.html" 2>"$ERR" &&
  mv "$OUT/new.html" "$OUT/index.html"

# GoAccess drops query strings, so the industry links are counted here.
# visits  = page requests for /?start=<id> from anything that is not a bot or a script.
# unfurls = image requests for /og?start=<id>. Chat and social apps fetch it to build a link preview.
# The source is the optional &src=<channel> on the link, lowercase letters, digits and hyphens only.
# The id list below is the PRESETS keys in seams.html. Add a new preset id here when one is added.
lines | jq -r -s '
  def isbot: (.request.headers["User-Agent"][0] // "") | test("bot|crawl|spider|slack|facebookexternalhit|whatsapp|preview|curl|python|go-http|headless|scanner"; "i");
  def src: (try (.request.uri | capture("[?&]src=(?<s>[a-z0-9-]{1,20})(?:&|$)").s) catch null) // "-";
  [ .[]
    | select(.request and .status == 200 and .request.method == "GET")
    | . as $e
    | (try ($e.request.uri | capture("^/(?<og>og)?\\?(?:[^ ]*&)?start=(?<id>[a-z]+)(?:&|$)")) catch null) as $m
    | select($m != null and ($m.id | IN("restaurant","salon","trades","therapist","hotel","store","course","consultancy")))
    | { id: $m.id, og: ($m.og != null), bot: ($e | isbot), src: ($e | src), ts: $e.ts } ] as $rows
  | if ($rows | length) == 0 then "no industry link requests yet"
    else
      ( ($rows | map(.ts) | min | floor | strftime("%Y-%m-%d")) + " to " + ($rows | map(.ts) | max | floor | strftime("%Y-%m-%d")) ),
      "",
      ( ["industry", "visits", "unfurls", "visits by source"] | @tsv ),
      ( $rows | group_by(.id)[]
        | . as $g
        | ($g | map(select(.og | not) | select(.bot | not))) as $v
        | [ $g[0].id,
            ($v | length),
            ($g | map(select(.og)) | length),
            ( $v | group_by(.src) | map(.[0].src + " " + (length | tostring)) | join(", ") ) ]
        | @tsv )
    end' 2>"$ERR" > "$OUT/arrivals.tmp" && mv "$OUT/arrivals.tmp" "$OUT/arrivals.txt"

[ "$(id -u)" = 0 ] && chown -R ubuntu:ubuntu "$OUT"
exit 0
