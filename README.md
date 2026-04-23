# Fantasy Sports Copilot

A conversational fantasy baseball platform that replaces traditional click-heavy interfaces with an AI-powered chat experience. Connect your Yahoo Fantasy account and manage your league through natural language.

## Features

### Chat-First Interface
The primary UI is a conversational chat thread. Ask questions, get recommendations, and take actions — all through natural language.

```
"Who should I start this week?"
"Show me the best available pitchers"
"Compare Ohtani vs Acuna"
"What does my matchup look like?"
```

### Yahoo Fantasy Integration
Connect your Yahoo Fantasy account (read-only OAuth) to pull in real league data:
- **Roster & Lineup** — view your roster with live stats, probable starters, and BvP matchup data
- **Matchups** — head-to-head category breakdowns for the current week
- **Standings** — full league standings
- **League Players** — browse the player pool with filters (free agents, position, etc.)
- **Draft Results** — see your league's draft board
- **Season History** — browse past seasons and league history
- **League Settings** — scoring categories, roster positions, trade rules

### AI-Powered Analysis
- Lineup optimization with reasoning
- Player comparisons (head-to-head stat breakdowns)
- Trade evaluation
- Waiver wire recommendations with stat archetype filters (power hitters, aces, saves, speed, etc.)
- AI-generated matchup and roster recaps
- Works without an API key via a rule-based fallback system

### Smart Cards
Contextual UI cards appear alongside chat responses — lineup grids, player stat cards, matchup breakdowns, standings tables, and comparison views.

## Tech Stack

- **Framework**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4 (with rule-based fallback when no API key is set)
- **Data**: Yahoo Fantasy API (OAuth 2.0, read-only), in-memory store for local/demo leagues
- **Testing**: Vitest (unit), Playwright (E2E)

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/stevepessah/fantasy-sports-copilot.git
cd fantasy-sports-copilot
npm install
```

### Environment Setup

Copy the example env file:

```bash
cp .env.example .env.local
```

The app works with **zero API keys** — AI falls back to a rule-based system and Yahoo features gracefully degrade. To enable full functionality:

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | No | Enables GPT-4 chat responses (falls back to rule-based NLP) |
| `YAHOO_CONSUMER_KEY` | No | Yahoo Fantasy OAuth — needed for live league data |
| `YAHOO_CONSUMER_SECRET` | No | Yahoo Fantasy OAuth — needed for live league data |

For Yahoo setup details, see [docs/YAHOO_SETUP.md](docs/YAHOO_SETUP.md).

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
fantasy-sports-copilot/
├── app/
│   ├── api/
│   │   ├── chat/            # Main chat endpoint (intent parsing, AI, cards)
│   │   ├── yahoo/           # Yahoo Fantasy API proxy routes (OAuth, roster, matchups, etc.)
│   │   ├── leagues/         # Local league creation & Yahoo league hydration
│   │   ├── lineup/          # Lineup optimization
│   │   ├── draft/           # Draft operations
│   │   ├── trades/          # Trade proposals
│   │   ├── waivers/         # Add/drop operations
│   │   ├── matchup-recap/   # AI matchup narratives
│   │   ├── roster-recap/    # AI roster summaries
│   │   └── players/         # Local player database
│   ├── page.tsx             # Main app entry
│   └── layout.tsx           # Root layout
├── components/              # React components (chat, cards, roster, matchups, etc.)
├── contexts/                # React contexts (league, theme, Yahoo auth)
├── hooks/                   # SWR hooks for Yahoo API data fetching
├── lib/
│   ├── ai.ts                # AI integration (OpenAI + rule-based fallback)
│   ├── commandParser.ts     # Natural language intent parsing
│   ├── yahoo/               # Yahoo API client, OAuth, XML parsing
│   ├── chat/                # Card builders for structured chat responses
│   ├── db.ts                # In-memory data store
│   ├── league.ts            # League management logic
│   ├── rosterContext.ts     # Roster context builder for AI prompts
│   └── ...                  # MLB stats, formatters, utilities
├── data/                    # Static data files (MLB player lists)
├── docs/                    # Development notes and setup guides
├── scripts/                 # Utility scripts (data scraping, deployment)
├── __tests__/               # Unit and component tests
├── e2e/                     # Playwright E2E tests
└── types/                   # TypeScript type definitions
```

## Development

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| E2E tests | `npx playwright install chromium --with-deps && npm run test:e2e` |
| Format | `npm run format` |
| Build | `npm run build` |

## Contributing

Contributions are welcome. Key areas for improvement:

- Persistent database (PostgreSQL/Redis)
- Write-back to Yahoo (lineup setting, add/drops via API)
- NFL / football support (data layer exists, UI is baseball-first)
- Enhanced AI prompts and function calling
- More player data sources and projections

## License

MIT
