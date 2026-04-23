# Yahoo Fantasy Sports API Analysis

## Can You Use Yahoo's API? **YES!** ✅

Since you already have a Yahoo fantasy baseball league, using their API makes a lot of sense. Here's what you need to know:

---

## What Yahoo Fantasy Sports API Provides

Based on the [Yahoo Fantasy Sports API documentation](https://developer.yahoo.com/fantasysports/guide/):

### ✅ League & Team Data
- **League information**: Settings, scoring rules, roster positions
- **Team data**: All teams in your league, rosters, standings
- **User data**: Your teams across all leagues
- **Matchups**: Current week matchups, scores, standings

### ✅ Player Data
- **Rostered players**: All players on teams in your league
- **Available players**: Free agents, waiver wire
- **Player stats**: Stats calculated for your league's scoring system
- **Player information**: Names, positions, teams

### ✅ Transactions
- **Add/Drop players**: Can perform transactions via API
- **Trades**: Propose, accept, reject trades
- **Waiver claims**: Place waiver claims with FAAB bids
- **Transaction history**: View all league transactions

### ✅ Draft Data
- **Draft results**: All picks from your league's draft
- **Draft order**: Draft positions and rounds

---

## What Yahoo API Might NOT Provide

### ⚠️ Real-Time Game Stats
- Yahoo's API focuses on **fantasy league data**, not live game play-by-play
- Player stats are likely updated **after games complete** or at intervals
- May not provide sub-15-second updates during live games
- No play-by-play data (e.g., "Player X just hit a home run")

### ⚠️ Historical Game Data
- May not have detailed game logs or play-by-play history
- Stats are aggregated for fantasy scoring, not raw game events

---

## Recommended Approach: Hybrid Strategy

### Use Yahoo API for:
1. **League structure** - Teams, rosters, settings
2. **Roster management** - Who's on which team
3. **Matchups** - Current week matchups and scores
4. **Transactions** - Add/drop players, trades
5. **League-specific stats** - Points calculated for your scoring system

### Use API-Sports (or similar) for:
1. **Real-time game updates** - Live stats during games (15-second updates)
2. **Play-by-play data** - Detailed game events
3. **Historical game logs** - Past game performance
4. **Player projections** - Future game predictions

---

## Implementation Complexity

### Yahoo API Requirements:
1. **OAuth 2.0 Setup** - More complex than API key
   - Need to register app with Yahoo Developer Network
   - OAuth flow for user authentication
   - Token management and refresh
2. **User Authentication** - Users must log in with Yahoo
3. **Rate Limits** - Unknown limits (need to test)

### API-Sports Requirements:
1. **Simple API Key** - Just add header to requests
2. **No OAuth** - Straightforward integration
3. **Known Limits** - 100 requests/day free, more on paid plans

---

## Comparison Table

| Feature | Yahoo API | API-Sports | Hybrid (Both) |
|--------|-----------|------------|---------------|
| **Your League Data** | ✅ Direct access | ❌ No | ✅ Best |
| **Real-Time Stats** | ⚠️ Limited | ✅ 15-second updates | ✅ Best |
| **Roster Management** | ✅ Full control | ❌ No | ✅ Best |
| **Add/Drop Players** | ✅ Via API | ❌ No | ✅ Best |
| **Setup Complexity** | ⚠️ OAuth required | ✅ Simple API key | ⚠️ Both |
| **Cost** | ✅ Free | ⚠️ $10-50/month | ⚠️ $10-50/month |
| **Play-by-Play** | ❌ No | ✅ Yes | ✅ Yes |

---

## Recommendation

### Option 1: Start with Yahoo API Only (MVP)
**Best if:** You want to test with your existing league first

**Pros:**
- Free
- Direct access to your league
- Can manage rosters and transactions
- No additional API costs

**Cons:**
- May not have real-time updates during games
- OAuth setup is more complex
- Limited to Yahoo leagues only

**Implementation:**
1. Set up OAuth with Yahoo
2. Fetch your league data
3. Poll for matchup/score updates
4. See if update frequency is acceptable

### Option 2: Hybrid Approach (Recommended for Production)
**Best if:** You want the best of both worlds

**Pros:**
- Your actual league data from Yahoo
- Real-time stats from API-Sports
- Can manage rosters via Yahoo API
- Live updates during games

**Cons:**
- More complex (two APIs)
- API-Sports costs $10-50/month
- Need to sync player IDs between APIs

**Implementation:**
1. Use Yahoo API for league structure and rosters
2. Use API-Sports for real-time game stats
3. Match players by name/team between APIs
4. Update your database with live stats

---

## Code Example: Yahoo API Integration

```typescript
// lib/yahoo/yahooAPI.ts
export class YahooFantasyAPI {
  private accessToken: string
  private baseUrl = 'https://fantasysports.yahooapis.com/fantasy/v2'

  async getLeagues() {
    // Get all leagues for logged-in user
    const response = await fetch(
      `${this.baseUrl}/users;use_login=1/games;game_keys=mlb/leagues`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    return response.json()
  }

  async getLeagueTeams(leagueKey: string) {
    // Get all teams in a league
    const response = await fetch(
      `${this.baseUrl}/league/${leagueKey}/teams`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    return response.json()
  }

  async getTeamRoster(teamKey: string) {
    // Get roster for a specific team
    const response = await fetch(
      `${this.baseUrl}/team/${teamKey}/roster`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    return response.json()
  }

  async getMatchups(leagueKey: string, week: number) {
    // Get matchups for a specific week
    const response = await fetch(
      `${this.baseUrl}/league/${leagueKey}/scoreboard;week=${week}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    return response.json()
  }
}
```

---

## Next Steps

1. **Test Yahoo API First**
   - Register app at Yahoo Developer Network
   - Set up OAuth flow
   - Fetch your league data
   - Check update frequency for stats

2. **Evaluate Real-Time Needs**
   - If Yahoo updates are frequent enough → Use Yahoo only
   - If you need faster updates → Add API-Sports

3. **Implement Hybrid (If Needed)**
   - Use Yahoo for league/roster data
   - Use API-Sports for real-time game stats
   - Sync data between both

---

## My Recommendation

**Start with Yahoo API only** for MVP:
- You already have the league
- It's free
- You can test if update frequency is acceptable
- Can always add API-Sports later if needed

**Add API-Sports later** if:
- Yahoo updates aren't frequent enough
- You need play-by-play data
- You want sub-15-second updates during games

Would you like me to help you set up the Yahoo OAuth integration first?
