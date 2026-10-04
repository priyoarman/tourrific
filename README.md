# Trip-Weave

Trip-Weave is an AI travel planner. You describe a trip in plain English
("direct flights from Copenhagen to London next Friday, with a checked bag,
under 1500 kr") and it finds real flights, with no airport codes or date
pickers. The interface is branded **Tourrific**.

A chat message is turned into a structured search by an LLM (Groq), the search
runs against the Duffel Flights API, and the results stream back into a
three-column planner: chat, flights, hotels.

## Features

- Flight search in natural language, with follow-ups ("a little later", "somewhere else", "stops are fine")
- Filters that are really applied: direct only, time of day, checked bag, airlines, maximum price, cabin class, number of travellers
- Vague destinations: a country, a region ("south of Spain") or a mood ("somewhere with beaches")
- Live progress while searching, streamed with server-sent events
- Sort by best, cheapest or fastest without re-running the search
- Accounts: sign up, sign in, save flights, and chat history that survives a reload
- Departure airport guessed from the visitor's location when they don't name one
- Sample flights as a fallback when Duffel is unreachable (`DUFFEL_USE_MOCK=true`)

Hotels and road trips in the UI are sample data, and are labelled as such.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript, for both the UI and the API
- Tailwind CSS 4
- PostgreSQL with Prisma 6
- [Groq](https://groq.com) through the AI SDK, for turning messages into searches
- [Duffel](https://duffel.com) for flight offers
- JWT login tokens, bcrypt password hashes, Zod request validation

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
  lib/server/               Server-only logic: Groq extraction, Duffel, filters, auth
prisma/                     Database schema and migrations
bruno/, postman/            API collections
render.yaml                 Render deployment
```

## API

All routes live under `app/api/`. Protected routes expect
`Authorization: Bearer <token>`, where the token comes from logging in.

| Method and path | Login | What it does |
| --- | --- | --- |
| `GET /api/health` | | Health check |
| `POST /api/auth/signup` | | Create an account |
| `POST /api/auth/login` | | Get a token (valid for 1 hour) |
| `GET /api/auth/verify` | yes | Check a token |
| `POST /api/flights/search-stream` | | Chat message in, streamed search out |
| `GET /api/saved-flights/saved` | yes | List saved flights |
| `POST /api/saved-flights/save` | yes | Save a flight |
| `DELETE /api/saved-flights/save/:id` | yes | Remove a saved flight |
| `GET /api/conversations/current` | yes | The user's conversation |
| `GET`, `POST /api/conversations/:id/messages` | yes | Read or add chat messages |
| `POST /api/groq/extract` | yes | Test: show the search Groq extracts |
| `POST /api/flights/search` | yes | Test: search Duffel directly |
| `POST /api/flights/ai-search` | yes | Test: extract and search without streaming |

### Trying the API

The `postman/` and `bruno/` folders hold the same 14 requests. Run **Sign up**
once, then **Log in**: it stores the token that the protected requests use.
Both collections point at `http://localhost:3000`.

## Deploying to Render

`render.yaml` describes one free web service that builds and runs the app, with
`/api/health` as the health check. Each deploy applies pending migrations
before the new version starts.

1. Create a PostgreSQL database. Render's free database expires after about a
   month, so a provider with a lasting free plan (for example
   [Neon](https://neon.tech)) is the safer choice. Use its direct, non-pooled
   connection string.
2. In Render, choose **New > Blueprint** and pick this repository.
3. Fill in the environment variables it asks for (the ones in the table above).
4. Deploy, then open `/api/health` on the Render URL. It should return `"ok": true`.

To apply migrations by hand instead, from your own machine:

```bash
DATABASE_URL="<production connection string>" npm run db:deploy
```

## Testing

`npm test` runs the unit tests with Node's built-in test runner: the
Duffel-to-UI converter, the filters, the date and follow-up logic, and login
tokens. They use a saved sample of real Duffel offers, so they need no network.

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
