# Nami — frontend

A single-page search UI for the [Nami](https://github.com/samartiwari/nami) Wikipedia
search engine. Plain HTML + CSS + vanilla JavaScript — no build step, no dependencies.

Calls the Nami backend's `GET /search` endpoint and renders results, "did you mean?"
suggestions, and pagination. Result titles link out to the original Wikipedia article.

## Files

- `index.html` — markup
- `style.css` — styling (clean, Google-like)
- `app.js` — search logic (calls the API, renders results)

## Configure the backend URL

Open `app.js` and set `API_URL` (top of the file) to your backend:

```js
const API_URL = "http://localhost:8080";        // local testing
// const API_URL = "https://your-backend.com";  // production
```

## Run locally

The backend (the Spring app) must be running first. Then just open `index.html` — or
serve it with any static server, e.g.:

```bash
python3 -m http.server 3000
# open http://localhost:3000
```

> If you open `index.html` directly (file://) and the backend has CORS restrictions,
> use a static server instead so the origin is a normal `http://` URL.

## Deploy to Cloudflare Pages

1. Push this folder to its own GitHub repo.
2. In Cloudflare Pages, create a project from that repo.
3. Build settings: **no build command**, output directory = `/` (it's already static).
4. Deploy — you get a `https://<project>.pages.dev` URL.
5. Set `API_URL` in `app.js` to your deployed backend URL and redeploy.

## Notes

- Results are rendered with `textContent` (never `innerHTML`), so crawled titles or
  snippets can't inject scripts (XSS-safe).
- `?q=<query>` in the URL runs that search on load, so searches are shareable.
