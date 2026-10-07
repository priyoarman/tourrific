# Tourrific

Planning a trip usually means airport codes, date pickers and ten open tabs.
Tourrific asks for one sentence instead:

> "Direct flights from Copenhagen to London next Friday, with a checked bag, under 1500 kr."

It reads that, finds real flights, and finds hotels for the same trip.

**Try it:** [Tourrific live demo](https://tourrific-iowv.onrender.com/)

## Where it came from

Tourrific started as **TripWeave**, a team project at HackYourFuture Denmark.
That first version was an Express API with an HTML, CSS and JavaScript
frontend, built by four people:

| Who | Role | What they built |
| --- | --- | --- |
| **Abirame** ([@abikrithika](https://github.com/abikrithika)) | Scrum master and frontend lead | Express server and repository setup, database ERD, split-screen interface, dashboard, sign-in modals, chat history, frontend modules, steadier chat streaming, Swagger docs, most pull request merges |
| **Annamani** ([@annamani](https://github.com/annamani)) | Backend and API testing | Sign-up and log-in with bcrypt and JWT, saved flights (backend and frontend), pagination, Postman collection, testing instructions |
| **Arman** ([@priyoarman](https://github.com/priyoarman)) | AI integrations and API fetching | Groq setup and extraction schema, the link to Duffel, one-way, return and follow-up requests, origin detection by IP, flight filtering, detailed flight cards, Leaflet map, streamed AI chat |
| **Fatima** ([@ftshn84](https://github.com/ftshn84)) | Database and UI | Database schema with currencies and seeding, serving the frontend from Express, notifications, dashboard layout, destination resolution, access token checks |

Annamani and Arman built the Duffel flight search together, with its Zod
validation, central error handling and mock flights.

Then the project went solo. [Priyo Arman](https://github.com/priyoarman)
rewrote it in Next.js and TypeScript, gave it the Tourrific interface, and made
the filters really work. The Groq prompt, the destination resolver, the
follow-up handling and the database schema are ports of the team's work.

- Original version: [abikrithika/trip-weave](https://github.com/abikrithika/trip-weave/master), and this repository's history before the migration
- Original project board: <https://trello.com/b/2veKRbtH/trip-weave>

## What it can do

- **Talk, don't fill forms.** Search in plain English, then follow up: "a little later", "somewhere else", "stops are fine".
- **Filters that are really applied.** Direct only, time of day, checked bag, airlines, maximum price, cabin class, number of travellers.
- **Hotels in the same message.** Same city, nights and travellers as the flights. Add wishes: stars, price a night, free cancellation, rooms, a pool or parking.
- **Vague is fine.** A country, a region ("south of Spain") or a mood ("somewhere with beaches").
- **Watch it work.** Live progress while it searches. Sort by best, cheapest or fastest without searching again.
- **No account needed.** Sign up to save flights and keep your chat history.
- **Knows where you are.** It guesses your departure airport from your location.
- **Keeps going when Duffel is down.** Sample flights and hotels step in, clearly labelled (`DUFFEL_USE_MOCK=true`).

The road trip page and the complete plan page (`/complete-plan`) show sample
data for now.

## How one search travels

1. You type a message in the chat.
2. **Groq** (an LLM) turns it into a structured search.
3. **Duffel** searches flights and hotels side by side.
4. The results stream back into three columns: chat, flights, hotels.

## The tools

- [Next.js 16](https://nextjs.org) (App Router), React 19 and TypeScript, for the UI and the API
- Tailwind CSS 4
- PostgreSQL with Prisma 6
- [Groq](https://groq.com) through the AI SDK
- [Duffel](https://duffel.com) for flights and hotels
- [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) to find the city centre for a hotel search
- JWT logins in an HttpOnly cookie, bcrypt password hashes, Zod validation

## Run it yourself

You need Node.js 22 or newer, npm and a PostgreSQL database.

```bash
git clone https://github.com/priyoarman/tourrific.git
cd tourrific
npm install
cp .env.example .env.local   # then fill in the values
npm run db:deploy            # creates the tables
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

Put these in `.env.local`. Never commit it.

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string that signs login tokens |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Groq model, e.g. `openai/gpt-oss-120b` |
| `DUFFEL_TOKEN` | Duffel access token. A test-mode token works |
| `DUFFEL_API_URL` | `https://api.duffel.com` |
| `DUFFEL_USE_MOCK` | Optional. `true` shows sample flights and hotels when Duffel fails |

These are optional. Each one has a default.

| Variable | Default | What it limits |
| --- | --- | --- |
| `SEARCH_LIMIT_PER_MINUTE` | `5` | Searches per visitor per minute |
| `SEARCH_LIMIT_GUEST_PER_DAY` | `10` | Searches per day for a guest, by IP address |
| `SEARCH_LIMIT_USER_PER_DAY` | `50` | Searches per day for a logged-in user |
| `SEARCH_LIMIT_GLOBAL_PER_DAY` | `500` | Searches per day for everyone together |
| `AUTH_LIMIT_SIGNUPS_PER_DAY` | `5` | Sign-ups per IP address per day |
| `AUTH_LIMIT_LOGINS_PER_15_MIN` | `10` | Logins per IP address per 15 minutes |
| `GROQ_TIMEOUT_MS` | `10000` | How long to wait for Groq |
| `DUFFEL_TIMEOUT_MS` | `20000` | How long to wait for Duffel |
| `GEOCODER_TIMEOUT_MS` | `4000` | How long to wait for the city-centre lookup |
| `DUFFEL_CACHE_MINUTES` | `10` | How long a Duffel answer is reused. `0` turns the cache off |

On your own machine every request counts as one guest. Raise
`SEARCH_LIMIT_GUEST_PER_DAY` while developing. Restarting the dev server also
resets the counts.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app in development |
| `npm run build` / `npm start` | Build, then run the production server |
| `npm test` | Unit tests. No network or database needed |
| `npm run test:extract` | One live Groq extraction. Needs `GROQ_API_KEY` and spends a little quota |
| `npm run lint` | ESLint |
| `npm run db:deploy` | Apply pending database migrations |
| `npm run db:status` | Show which migrations are applied |

## A look inside

```
app/
  page.tsx, components/     Landing page
  plan/                     The planner: chat, flights and hotels columns
  complete-plan/            The whole trip on one page (sample data)
  roadtrip/                 Road trip planner (sample data)
  api/                      The API (route handlers)
  lib/                      Shared by the UI: types, formatting, API clients
  lib/server/               Server only: Groq, Duffel, filters, auth, rate limits
prisma/                     Database schema and migrations
bruno/, postman/            API collections
render.yaml                 Render deployment
```

## The API

Protected routes need the `session` cookie that logging in sets.

| Method and path | Login | What it does |
| --- | --- | --- |
| `GET /api/health` | | Health check |
| `POST /api/auth/signup` | | Create an account. Rate limited |
| `POST /api/auth/login` | | Sign in and set the session cookie (1 hour). Rate limited |
| `POST /api/auth/logout` | | Sign out and remove the cookie |
| `GET /api/auth/verify` | yes | Check the login and return its user |
| `POST /api/flights/search-stream` | optional | Chat message in, streamed flights and hotels out. Rate limited |
| `GET /api/saved-flights/saved` | yes | List saved flights |
| `POST /api/saved-flights/save` | yes | Save a flight |
| `DELETE /api/saved-flights/save/:id` | yes | Remove a saved flight |
| `GET /api/conversations/current` | yes | The user's conversation |
| `GET`, `POST /api/conversations/:id/messages` | yes | Read or add chat messages |
| `POST /api/groq/extract` | yes | Test: show the search Groq extracts |
| `POST /api/flights/search` | yes | Test: search Duffel directly |
| `POST /api/flights/ai-search` | yes | Test: extract and search without streaming |

**Try it.** `postman/` and `bruno/` hold the same 15 requests, pointed at
`http://localhost:3000`. Run **Sign up** once, then **Log in**. Both tools keep
the cookie and send it for you.

### The search stream

`POST /api/flights/search-stream` answers with server-sent events, in this
order:

| Event | When | What it carries |
| --- | --- | --- |
| `status` | several times | A progress line |
| `message` | sometimes | A question, an explanation or an error |
| `complete` | when flights were searched | The flights, the extracted search and the filters applied |
| `hotels` | after `complete`, when there is a stay | The hotels, the stay and the hotel wishes applied |
| `done` | always last | Whether the assistant waits for an answer, and the context to send back |

The shapes are in `app/lib/types/stream-events.ts`.

## How hotels work

Every flight search is also a hotel search.

- **Where.** Within 5 km of the centre of the city the destination airport serves. If the city can't be found, 25 km around the airport.
- **When.** Check-in on the outbound day, check-out on the return day. A one-way trip gets 3 nights. A same-day return gets no hotels.
- **Who.** One guest per traveller, two to a room unless you say how many rooms.
- **Wishes.** Free cancellation and rooms are sent to Duffel. Stars, price a night and amenities are filtered afterwards. A price limit only counts for the hotel when you tie it to the hotel ("hotel under 150 euros a night").
- **How many.** The first 30 hotels, with the total.

A failed hotel search never costs you your flights.

Good to know:

- **Duffel must switch Stays on.** New accounts don't have it. [Ask Duffel for access](https://duffel.com/contact-us). Until then hotel searches answer `403` and you see the failure or the sample hotels.
- **The hotel follows the airport's town.** Tokyo Narita gives hotels in Narita, not Tokyo.
- **The Stays code is untested against real answers.** It was written from Duffel's API reference. Check `app/lib/types/duffel-stays.ts` and `app/lib/duffel-to-hotel.ts` once you have access.
- **Hotels can be searched and picked, not booked.**

Code: `duffel-stays.ts`, `stay-location.ts`, `hotel-search.ts` and
`hotel-filters.ts` in `app/lib/server/`.

## Staying safe

### Login sessions

Logging in puts a 1-hour JWT in a cookie:

```
Set-Cookie: session=<jwt>; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax; Secure
```

- **`HttpOnly`**: JavaScript can't read the token, so an injected script can't steal it.
- **`Secure`** (in production): never sent over plain http.
- **`SameSite=Lax`**: other sites can't send it with their requests.
- **Origin check**: a `POST` or `DELETE` whose `Origin` is another site answers `403`.

Two limits: a script injected into the page could still act as you while the
page is open, and a copied token stays valid until its hour is up, even after
logout.

Code: `app/lib/server/auth.ts` and `app/lib/server/http.ts`.

### Abuse protection

Searching needs no account, and every search spends Groq and Duffel quota. Five
things stop a script from using it all up.

**1. Rate limits.** Each chat message is one search. A request over any limit
is turned away before a provider is called.

| Limit | Counted per | Default | `reason` |
| --- | --- | --- | --- |
| Everyone together | the whole app | 500 a day | `busy` |
| Burst | IP address, or account when logged in | 5 a minute | `burst` |
| Guest allowance | IP address | 10 a day | `guest_limit` |
| Account allowance | account | 50 a day | `user_limit` |

A blocked search answers `429` with a `Retry-After` header:

```json
{
  "success": false,
  "reason": "guest_limit",
  "message": "You've used your free searches for today. Sign in or sign up to keep going.",
  "retryAfterSeconds": 85200
}
```

A guest who runs out sees the sign-in dialog, and the search is sent again
after signing in. Sign-up and login are rate limited too, so a new account is
not a way around the limits.

**2. Input limits.** A message is at most 500 characters, a request body 8 KB.
Anything else answers `400`.

**3. Timeouts.** Groq gets 10 seconds, Duffel 20, the city lookup 4. A hotel
search that hangs only costs the hotels.

**4. Cancellation.** Leave or start a new search, and the calls in progress are
dropped.

**5. Cache.** The same search within 10 minutes reuses Duffel's answer.
Failures and sample data are never kept.

**Where the counts live.** In the server's memory. That fits the single
instance in `render.yaml`, but the counts reset on a restart and several
instances would each count alone. Redis would fix both, and it is a one-file
change: `app/lib/server/rate-limit.ts` exports a small `RateLimiter` interface
that the routes use. The per-IP limits trust the `X-Forwarded-For` header from
the host's proxy.

Code: `rate-limit.ts`, `search-limits.ts`, `auth-limits.ts`, `schemas.ts` and
`ttl-cache.ts` in `app/lib/server/`.

## Deploying to Render

`render.yaml` describes one free web service, with `/api/health` as the health
check. Each deploy applies pending migrations first.

1. Create a PostgreSQL database. Render's free one expires after about a month,
   so [Neon](https://neon.tech) or similar is safer. Use the direct, non-pooled
   connection string.
2. In Render, choose **New > Blueprint** and pick this repository.
3. Fill in the environment variables from the first table above.
4. Deploy, then open `/api/health`. It should return `"ok": true`.

To apply migrations by hand:

```bash
DATABASE_URL="<production connection string>" npm run db:deploy
```

## Testing

`npm test` runs the unit tests with Node's built-in test runner. They cover the
converters, flight filters and hotel wishes, dates and follow-ups, the hotel
search and its fallback, login sessions, and the abuse protection. They use a
saved sample of real Duffel offers and need no network. The hotel tests use
hand-written answers shaped like Duffel's API reference.
