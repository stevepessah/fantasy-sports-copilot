# Real-Time Data Update Options for Fantasy Sports Copilot

This document outlines several approaches to feed real-time game data into your fantasy sports app so that stats update as games happen.

## Overview

Your app currently uses:
- In-memory database (`lib/db.ts`)
- Polling in DraftRoom (every 2 seconds)
- Static/mock player data
- Next.js 14 with API routes

## Option 1: Enhanced Polling with Sports Data API (Recommended for MVP)

**Approach**: Poll a sports data API at regular intervals (15-30 seconds during games) and update player stats.

### Data Sources:
- **SportsData.io** (Baseball/Football) - $10-50/month, good documentation
- **TheSportsDB** - Free tier available, community-driven
- **API-Sports** - Free tier (100 requests/day), paid tiers available
- **ESPN API** (Unofficial) - Free but rate-limited, may break
- **MySportsFeeds** - $10-40/month, comprehensive stats

### Implementation:
1. Create a background job/API route that fetches live game data
2. Update player records in your database
3. Frontend polls for updates or uses Server-Sent Events (SSE)

**Pros:**
- Simple to implement
- Works with your current architecture
- No WebSocket infrastructure needed
- Easy to add rate limiting and caching

**Cons:**
- Slight delay (15-30 seconds)
- More API calls = higher costs
- Not truly "real-time"

**Estimated Cost:** $10-50/month depending on API

---

## Option 2: WebSockets with Real-Time Sports Feed

**Approach**: Use WebSockets to push updates from a sports data provider that supports real-time feeds.

### Data Sources:
- **SportsData.io WebSocket API** - Real-time play-by-play
- **FanGraphs API** - Baseball-specific, some real-time features
- **Custom WebSocket Server** - Connect to multiple sources and aggregate

### Implementation:
1. Set up WebSocket server (Next.js API route or separate service)
2. Connect to sports data provider's WebSocket
3. Broadcast updates to connected clients
4. Update database as events come in

**Pros:**
- True real-time updates (< 1 second delay)
- Efficient (push-based, not polling)
- Great user experience

**Cons:**
- More complex infrastructure
- Requires WebSocket support
- Higher API costs typically
- Need to handle connection management

**Estimated Cost:** $50-200/month

---

## Option 3: Server-Sent Events (SSE) with Polling Backend

**Approach**: Use SSE to push updates from your backend, which polls the sports API.

### Implementation:
1. Create SSE endpoint (`/api/live-stats`)
2. Backend polls sports API every 15-30 seconds
3. When updates detected, push to connected clients via SSE
4. Frontend subscribes to SSE stream

**Pros:**
- Simpler than WebSockets (HTTP-based)
- Works well with Next.js
- Automatic reconnection
- Good balance of real-time feel and simplicity

**Cons:**
- Still polling on backend (not true real-time)
- One-way communication (server → client)
- Need to manage connections

**Estimated Cost:** $10-50/month (same as Option 1)

---

## Option 4: Webhook-Based Updates (If Available)

**Approach**: Some sports APIs support webhooks that push updates when events occur.

### Data Sources:
- **SportsData.io** - Webhook support for certain events
- **Custom Integration** - Build webhook receiver

### Implementation:
1. Register webhook endpoint with sports API
2. Receive POST requests when game events happen
3. Process and update database
4. Notify connected clients (via SSE or WebSocket)

**Pros:**
- True event-driven updates
- No polling needed
- Efficient and scalable

**Cons:**
- Limited API support for webhooks
- Requires public endpoint (ngrok for dev)
- More complex setup

**Estimated Cost:** $50-200/month

---

## Option 5: Hybrid Approach (Recommended for Production)

**Approach**: Combine multiple strategies based on game state.

### Implementation:
1. **Pre-game**: Poll every 5 minutes for lineup changes
2. **During games**: Use WebSocket/SSE for live updates (every 15-30 seconds)
3. **Post-game**: Final stat update after game completion
4. **Off-days**: Minimal polling (once per hour)

**Pros:**
- Optimizes API usage and costs
- Best user experience
- Efficient resource usage

**Cons:**
- More complex to implement
- Need to track game states

**Estimated Cost:** $20-100/month (varies by usage)

---

## Recommended Implementation Plan

### Phase 1: Enhanced Polling (Quick Win)
1. Integrate SportsData.io or API-Sports
2. Create `/api/stats/update` endpoint
3. Set up cron job or scheduled function to poll during games
4. Update player `actualPoints` and stats
5. Frontend polls `/api/players` every 30 seconds when games are live

### Phase 2: Server-Sent Events
1. Create `/api/live-stats` SSE endpoint
2. Backend polls sports API and pushes updates
3. Frontend subscribes to SSE stream
4. Update UI reactively when stats change

### Phase 3: WebSocket (If Needed)
1. Upgrade to WebSocket for true real-time
2. Add connection management
3. Implement reconnection logic

---

## Code Structure Suggestions

### 1. Create Stats Update Service
```
lib/stats/
  ├── providers/
  │   ├── sportsData.ts      # SportsData.io integration
  │   ├── apiSports.ts        # API-Sports integration
  │   └── base.ts             # Base provider interface
  ├── updater.ts              # Stats update logic
  └── types.ts                # Stats data types
```

### 2. API Routes
```
app/api/
  ├── stats/
  │   ├── update/route.ts     # Manual trigger for stats update
  │   ├── live/route.ts       # SSE endpoint for live updates
  │   └── sync/route.ts       # Sync all active games
  └── games/
      └── live/route.ts       # Get currently live games
```

### 3. Frontend Hooks
```
hooks/
  ├── useLiveStats.ts         # Hook for subscribing to live stats
  ├── useGameStatus.ts        # Hook for checking if games are live
  └── usePlayerStats.ts       # Hook for player stat updates
```

### 4. Background Jobs
```
lib/jobs/
  ├── updateStats.ts          # Cron job to update stats
  └── scheduler.ts            # Job scheduler
```

---

## Next Steps

1. **Choose a data provider** - Start with API-Sports free tier or SportsData.io
2. **Implement Option 1** (Enhanced Polling) - Quickest to get working
3. **Add SSE endpoint** - Improve user experience
4. **Monitor API usage** - Track costs and optimize
5. **Upgrade to WebSocket** - If real-time becomes critical

---

## Example API Integration (SportsData.io)

```typescript
// lib/stats/providers/sportsData.ts
export class SportsDataProvider {
  private apiKey: string
  private baseUrl = 'https://api.sportsdata.io/v3'

  async getLiveGameStats(gameId: string) {
    const response = await fetch(
      `${this.baseUrl}/mlb/scores/json/BoxScore/${gameId}`,
      { headers: { 'Ocp-Apim-Subscription-Key': this.apiKey } }
    )
    return response.json()
  }

  async getPlayerGameStats(playerId: string, date: string) {
    // Fetch player's stats for specific game
  }
}
```

---

## Example SSE Implementation

```typescript
// app/api/stats/live/route.ts
export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Send updates every 30 seconds
      const interval = setInterval(async () => {
        const updates = await fetchLiveStats()
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(updates)}\n\n`)
        )
      }, 30000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

---

## Cost Comparison

| Option | Monthly Cost | Complexity | Real-time Quality |
|--------|-------------|------------|-------------------|
| Enhanced Polling | $10-50 | Low | Good (15-30s delay) |
| SSE | $10-50 | Medium | Good (15-30s delay) |
| WebSocket | $50-200 | High | Excellent (<1s delay) |
| Webhooks | $50-200 | High | Excellent (<1s delay) |
| Hybrid | $20-100 | High | Excellent (optimized) |

---

## Recommendation

**Start with Option 1 (Enhanced Polling)** for MVP, then upgrade to **Option 3 (SSE)** for better UX. This gives you:
- Quick implementation
- Low cost
- Good user experience
- Room to grow

Would you like me to implement one of these options?
