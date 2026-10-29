# SEAMS

SEAMS is an instrument from the Bureau of Applied Science. It scores the seams between the software an organization runs, from 0 to 100. You tap the tools you use and say who finds out first when a connection breaks. It returns a seam load, a grade, a list of named failure points with a check for each, and a card you can share.

Software rarely fails inside a tool. It fails in the gap between two of them.

The severities are judgment from operating real stacks, not measurements. There are no accounts. The result is a link: the state is encoded in the URL.

Live: https://seams.bureauofapplied.science
Specification: https://bureauofapplied.science/instruments/seams

## Layout

| Path | What it is |
|---|---|
| `seams.html` | The whole assessment: markup, styles, knowledge base and scoring logic in one file. The source of truth. |
| `deploy/build.js` | Builds `deploy/page.html` and `deploy/logic.js` from `seams.html`. |
| `deploy/server.js` | Node server. Serves the page with per-result Open Graph tags, renders share cards at `/og`, and takes a small first-party event beacon at `/b`. |
| `deploy/card.js` | Share card renderer (satori and resvg). |
| `deploy/events-summary.js` | Counts events from the beacon log. |
| `deploy/report.sh` | Builds traffic and per-link reports from a Caddy JSON access log. |
| `deploy/ecosystem.config.js`, `deploy/*.conf` | Example PM2 and Caddy configuration. |
| `deploy/fonts` | Self-hosted fonts, with their licenses. |
| `seams_check2.js`, `seams_domtest.js`, `deploy/server-check.js` | Checks. |

## Run

Developed and run on Node 22.

```
cd deploy
npm install
node build.js
node server.js
```

The server listens on `127.0.0.1:3010`. Set `PORT`, `HOST` and `ORIGIN` (the public URL used in meta tags) to change that. Events are appended to `deploy/data/events.ndjson`, or the file named by `EVENTS_FILE`. An event is an hour, an event name, a grade and a preset id. No IP address or selection is stored.

## Test

```
node seams_check2.js            # knowledge base consistency; "problems" must be []
npm install --no-save jsdom     # once
node seams_domtest.js           # DOM behavior; 0 failed
cd deploy && node build.js && node server-check.js   # server; 0 failed
```

## License

Code: MIT, see `LICENSE`. Fonts (IBM Plex Mono, Libre Franklin): SIL Open Font License 1.1, see `deploy/fonts/LICENSE-*.txt`. Product and company names in the knowledge base belong to their owners and are used only to name the tools.
