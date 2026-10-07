# Tourrific

Tourrific is an AI travel planner. You describe a trip in plain English
("direct flights from Copenhagen to London next Friday, with a checked bag,
under 1500 kr") and it finds real flights, with no airport codes or date
pickers. The interface is branded **Tourrific**.

A chat message is turned into a structured search by an LLM (Groq), the search
runs against the Duffel Flights API, and the results stream back into a
three-column planner: chat, flights, hotels.

Try it live here: [Tourrific Live Demo](https://tourrific-iowv.onrender.com/)

## Features

- Flight search in natural language, with follow-ups ("a little later", "somewhere else", "stops are fine")
- Filters that are really applied: direct only, time of day, checked bag, airlines, maximum price, cabin class, number of travellers
- Vague destinations: a country, a region ("south of Spain") or a mood ("somewhere with beaches")
- Live progress while searching, streamed with server-sent events
- Sort by best, cheapest or fastest without re-running the search
- Accounts: sign up, sign in, save flights, and chat history that survives a reload
- Search without an account, protected against abuse: rate limits per visitor and overall, input limits, provider timeouts and a short-lived cache (see [Abuse protection](#abuse-protection))
- Departure airport guessed from the visitor's location when they don't name one
- Sample flights as a fallback when Duffel is unreachable (`DUFFEL_USE_MOCK=true`)

Hotels and road trips in the UI are sample data, and are labelled as such.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript, for both the UI and the API
- Tailwind CSS 4
- PostgreSQL with Prisma 6
- [Groq](https://groq.com) through the AI SDK, for turning messages into searches
- [Duffel](https://duffel.com) for flight offers
- JWT logins kept in an HttpOnly session cookie, bcrypt password hashes, Zod request validation

## Getting started

You need Node.js 22 or newer, npm, and a PostgreSQL database.

```bash
git clone https://github.com/priyoarman/trip-weave.git
cd trip-weave
npm install
cp .env.example .env.local   # then fill in the values
npm run db:deploy            # creates the tables
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

Set these in `.env.local` (never commit it):

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Groq model, e.g. `openai/gpt-oss-120b` |
| `DUFFEL_TOKEN` | Duffel access token (a test-mode token works) |
| `DUFFEL_API_URL` | `https://api.duffel.com` |
| `DUFFEL_USE_MOCK` | Optional. `true` returns sample flights when a Duffel request fails |

These are optional and tune the [abuse protection](#abuse-protection). Each
falls back to its default when unset.

| Variable | Default | What it limits |
| --- | --- | --- |
| `SEARCH_LIMIT_PER_MINUTE` | `5` | Searches per visitor per minute |
| `SEARCH_LIMIT_GUEST_PER_DAY` | `10` | Searches per day for a visitor who isn't logged in, counted by IP address |
| `SEARCH_LIMIT_USER_PER_DAY` | `50` | Searches per day for a logged-in user, counted by account |
| `SEARCH_LIMIT_GLOBAL_PER_DAY` | `500` | Searches per day across all visitors |
| `AUTH_LIMIT_SIGNUPS_PER_DAY` | `5` | Sign-up attempts per IP address per day |
| `AUTH_LIMIT_LOGINS_PER_15_MIN` | `10` | Login attempts per IP address per 15 minutes |
| `GROQ_TIMEOUT_MS` | `10000` | How long to wait for Groq |
| `DUFFEL_TIMEOUT_MS` | `20000` | How long to wait for Duffel |
| `DUFFEL_CACHE_MINUTES` | `10` | How long a Duffel answer is reused for the same search. `0` switches the cache off |

Run locally, every request comes from the same address and counts as one
guest. Raise `SEARCH_LIMIT_GUEST_PER_DAY` in `.env.local` while developing;
restarting the dev server also resets the counts.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app in development |
| `npm run build` / `npm start` | Build, then run the production server |
| `npm test` | Unit tests. No network or database needed |
| `npm run test:extract` | One live extraction through Groq. Needs `GROQ_API_KEY` and spends a little quota |
| `npm run lint` | ESLint |
| `npm run db:deploy` | Apply pending database migrations |
| `npm run db:status` | Show which migrations are applied |

## Project structure

```
app/
  page.tsx, components/     Landing page
  plan/                     The planner: chat, flights and hotels columns
  roadtrip/                 Road trip planner (sample data)
  api/                      The API (route handlers)
  lib/                      Code shared by the UI: types, formatting, API clients
  lib/server/               Server-only logic: Groq extraction, Duffel, filters, auth, rate limits
prisma/                     Database schema and migrations
bruno/, postman/            API collections
render.yaml                 Render deployment
```

## API

All routes live under `app/api/`. Protected routes expect the `session` cookie
that logging in sets; see [Login sessions](#login-sessions).

| Method and path | Login | What it does |
| --- | --- | --- |
| `GET /api/health` | | Health check |
| `POST /api/auth/signup` | | Create an account. Rate limited |
| `POST /api/auth/login` | | Sign in: sets the session cookie (valid for 1 hour). Rate limited |
| `POST /api/auth/logout` | | Sign out: removes the session cookie |
| `GET /api/auth/verify` | yes | Check the login and return its user |
| `POST /api/flights/search-stream` | optional | Chat message in, streamed search out. Rate limited; logging in gives a larger allowance |
| `GET /api/saved-flights/saved` | yes | List saved flights |
| `POST /api/saved-flights/save` | yes | Save a flight |
| `DELETE /api/saved-flights/save/:id` | yes | Remove a saved flight |
| `GET /api/conversations/current` | yes | The user's conversation |
| `GET`, `POST /api/conversations/:id/messages` | yes | Read or add chat messages |
| `POST /api/groq/extract` | yes | Test: show the search Groq extracts |
| `POST /api/flights/search` | yes | Test: search Duffel directly |
| `POST /api/flights/ai-search` | yes | Test: extract and search without streaming |

### Trying the API

The `postman/` and `bruno/` folders hold the same 15 requests. Run **Sign up**
once, then **Log in**: it sets the session cookie, which both tools keep in
their cookie jar and send with the protected requests. Both collections point
at `http://localhost:3000`. The notes on **Sign up**, **Log in** and
**Search (streaming)** describe their `429` responses.

### Login sessions

Logging in signs a JWT that lasts 1 hour and sends it to the browser as a
cookie:

```
Set-Cookie: session=<jwt>; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax; Secure
```

- **`HttpOnly`** keeps the token out of reach of JavaScript. It is never in a
  response body or in `localStorage`, so a script injected into the page (XSS)
  cannot read it and send it elsewhere. The browser stores only the user's
  name, email and currency, to show who is signed in, and checks them against
  `GET /api/auth/verify` on each page load.
- **`Secure`** (in production) keeps it off plain http.
- **`SameSite=Lax`** stops other sites from sending it with their requests.

A cookie is sent by the browser on its own, which a token in a header is not,
so another site could try to make a signed-in visitor's browser act for them
(CSRF). Besides `SameSite`, every `POST` and `DELETE` whose `Origin` header
names another site answers `403`. Requests without an `Origin`, as tools like
curl send them, are let through: they hold no visitor's cookie.

What this does not do: a script injected into the page could still make
requests as the visitor while the page is open, and the token is not kept on
the server, so logging out removes the cookie but a copy of the token would
stay valid until its hour is up.

The code is in `app/lib/server/auth.ts` (cookie and token) and
`app/lib/server/http.ts` (the cross-site check).

## Abuse protection

Searching needs no account, and every search spends Groq and Duffel quota. So
that a script can't use that quota up, the search endpoint is protected in
five ways.

**Rate limits.** Every chat message counts as one search, since each costs a
Groq call. The limits are checked in this order, and a request over any of
them is turned away before either provider is called:

| Limit | Counted per | Default | `reason` |
| --- | --- | --- | --- |
| Everyone together | the whole app | 500 a day | `busy` |
| Burst | IP address, or account when logged in | 5 a minute | `burst` |
| Guest allowance | IP address | 10 a day | `guest_limit` |
| Account allowance | account | 50 a day | `user_limit` |

A blocked search answers `429` with a `Retry-After` header and a JSON body:

```json
{
  "success": false,
  "reason": "guest_limit",
  "message": "You've used your free searches for today. Sign in or sign up to keep going.",
  "retryAfterSeconds": 85200
}
```

In the app, a guest who reaches their allowance is shown the sign-in dialog,
and the search that was turned away is sent again once they have signed in.

Accounts are free and need no email verification, so signing in is a nudge
rather than a barrier. What keeps it from being a way around the limits is
that sign-up and login are rate limited too (5 sign-up attempts a day and 10
login attempts per 15 minutes, per IP address), and that the daily budget for
everyone together holds whatever else happens.

**Input limits.** A message can be at most 500 characters and a request body
8 KB. The previous search that the browser sends back with a follow-up is
checked field by field before it reaches the Groq prompt. Anything else
answers `400`.

**Timeouts.** Groq gets 10 seconds and Duffel 20. A provider that hangs ends
the search with a message saying so. Groq is not asked a second time after a
timeout or when its own quota is used up.

**Cancellation.** When the visitor leaves or starts a newer search, the calls
to Groq and Duffel in progress are dropped and later ones are never made.

**Cache.** A Duffel answer is reused for 10 minutes when the same search comes
in again (same route, dates, passengers, cabin and stops), so repeats cost a
Groq call but no Duffel call. Failures and sample flights are never kept.

### Where the counts are kept

The limiter keeps its counts in the server's memory, which is correct for the
single instance `render.yaml` describes and needs no extra service. Two things
follow from that:

- The counts reset when the server restarts, or wakes up after Render's free
  plan has put it to sleep.
- Several instances would each count on their own.

Both are solved by a shared store such as Redis, and that is a one-file
change: `app/lib/server/rate-limit.ts` defines a small `RateLimiter` interface
with a single `consume(rules)` method, and the routes only ever use the
`rateLimiter` it exports. A Redis-backed limiter that implements the interface
replaces the in-memory one there, and no route changes.

The per-IP limits read the visitor's address from the `X-Forwarded-For` header
set by the host's proxy. They are only as trustworthy as that header, which is
one more reason the limit for everyone together exists.

The code is in `app/lib/server/`: `rate-limit.ts` (the limiter),
`search-limits.ts` and `auth-limits.ts` (the limits), `schemas.ts` (input
limits), `ttl-cache.ts` and `duffel.ts` (cache and Duffel timeout), and
`groq/extractor.ts` (Groq timeout).

## Deploying to Render

`render.yaml` describes one free web service that builds and runs the app, with
`/api/health` as the health check. Each deploy applies pending migrations
before the new version starts.

1. Create a PostgreSQL database. Render's free database expires after about a
   month, so a provider with a lasting free plan (for example
   [Neon](https://neon.tech)) is the safer choice. Use its direct, non-pooled
   connection string.
2. In Render, choose **New > Blueprint** and pick this repository.
3. Fill in the environment variables it asks for (the ones in the first table
   above). The optional ones can be added later under the service's
   **Environment** tab.
4. Deploy, then open `/api/health` on the Render URL. It should return `"ok": true`.

To apply migrations by hand instead, from your own machine:

```bash
DATABASE_URL="<production connection string>" npm run db:deploy
```

## Testing

`npm test` runs the unit tests with Node's built-in test runner: the
Duffel-to-UI converter, the filters, the date and follow-up logic, login
sessions and the cross-site check, and the abuse protection (rate limits,
input limits, provider timeouts, cancellation and the cache). They use a saved
sample of real Duffel offers and a stand-in for the network, so they need none.

## Origins and credits

Trip-Weave began as a team project. The original version, an Express API with
an HTML, CSS and JavaScript frontend, was built by:

| Name | GitHub |
| --- | --- |
| **Abikrithika** | [@abikrithika](https://github.com/abikrithika) |
| **Annamani** | [@annamani](https://github.com/annamani) |
| **Priyo Arman** | [@priyoarman](https://github.com/priyoarman) |
| **Ftshn84** | [@ftshn84](https://github.com/ftshn84) |

That version lives at
[abikrithika/trip-weave](https://github.com/abikrithika/trip-weave), and in
this repository's history before the Next.js migration. The Groq extraction
prompt, the destination resolver, the follow-up handling and the database
schema here are ports of the team's work.

The Next.js and TypeScript rewrite, the Tourrific interface and the working
filters are by [Priyo Arman](https://github.com/priyoarman).

- Original project board: <https://trello.com/b/2veKRbtH/trip-weave>
