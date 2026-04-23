# Simple API-Sports Integration (No SSE Required)

## Approach: Simple Frontend Polling

Just like your DraftRoom component already does, we'll poll your API endpoint which fetches from API-Sports.

## Architecture

```
Frontend Component
  ↓ (polls every 15-30 seconds)
Your API Route (/api/stats/live)
  ↓ (fetches from API-Sports)
API-Sports API
  ↓ (returns data)
Your API Route
  ↓ (updates your database)
Your API Route
  ↓ (returns to frontend)
Frontend Component (updates UI)
```

## Implementation Steps

### 1. Create API-Sports Service
```typescript
// lib/stats/apiSports.ts
export class APISportsService {
  private apiKey: string
  private baseUrl = 'https://v3.baseball.api-sports.io' // or football

  async getLiveGames(date: string) {
    const response = await fetch(
      `${this.baseUrl}/fixtures?date=${date}&live=all`,
      {
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v3.baseball.api-sports.io'
        }
      }
    )
    return response.json()
  }

  async getGameStats(fixtureId: string) {
    // Get detailed stats for a game
  }

  async getPlayerStats(playerId: string, season: string) {
    // Get player statistics
  }
}
```

### 2. Create Stats Update API Route
```typescript
// app/api/stats/live/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { APISportsService } from '@/lib/stats/apiSports'
import { playerDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    
    const apiSports = new APISportsService()
    const liveGames = await apiSports.getLiveGames(date)
    
    // Update player stats in your database
    for (const game of liveGames.response) {
      // Process game data and update players
      // Update playerDB with new stats
    }
    
    return NextResponse.json({ 
      success: true, 
      games: liveGames.response,
      updated: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch live stats' },
      { status: 500 }
    )
  }
}
```

### 3. Add Polling to Frontend Component
```typescript
// In your component (similar to DraftRoom)
useEffect(() => {
  const updateStats = async () => {
    try {
      const response = await fetch('/api/stats/live')
      if (response.ok) {
        const data = await response.json()
        // Update your UI with new stats
        // Refresh player data
        loadRoster() // or update specific players
      }
    } catch (error) {
      console.error('Error updating stats:', error)
    }
  }

  // Poll every 30 seconds during games
  updateStats() // Initial load
  const interval = setInterval(updateStats, 30000) // 30 seconds
  
  return () => clearInterval(interval)
}, [])
```

## That's It!

No SSE needed. Just:
1. ✅ API-Sports service
2. ✅ API route that fetches and updates
3. ✅ Frontend polling (like you already do in DraftRoom)

## When to Add SSE Later

Consider SSE if:
- You have 10+ concurrent users
- You're hitting API-Sports rate limits
- You want to reduce backend API calls
- You need sub-second updates

For MVP with 1-5 users, simple polling is perfect!
