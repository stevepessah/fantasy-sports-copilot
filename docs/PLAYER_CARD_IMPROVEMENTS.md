# Player Card Improvements

## Overview
Enhanced the player cards to display comprehensive player information and statistics as requested.

## What's New

### Player Information Section
The player card now displays:
1. **Player Name** - Prominently displayed at the top
2. **MLB Team** - The team abbreviation (e.g., "NYY", "LAD")
3. **Position(s)** - All eligible positions the player can play (e.g., "1B, OF, UTIL")
4. **Fantasy League Status** - Shows whether the player is:
   - **Free Agent** (green badge) - Available to pick up
   - **Taken** (red badge) - Owned by another team, with team name displayed
   - **Unknown** - Status couldn't be determined

### Player Statistics Section
The player card now shows comprehensive statistics:

#### Current Season Stats
1. **Season Stats** - All stats for the entire current season
2. **This Week** - Current week performance (when available)

#### Historical Seasons
- **Last 3 Seasons** - Full season stats from the previous 3 years
- Displays stats for each season simultaneously for easy comparison

> **Note**: Yahoo Fantasy API provides season-total and current-week stats. More granular date ranges (last 7/14/30 days) are not consistently available from Yahoo's API, so we focus on the data that's reliably provided.

### Stats Display
For each time period, the component intelligently displays:
- **Hitting Stats**: AB, H, R, HR, RBI, SB, AVG, OBP, SLG, OPS
- **Pitching Stats**: W, L, SV, IP, ER, BB, K, ERA, WHIP, K/9, HA

Stats are formatted appropriately (3 decimals for averages, 2 for others).

## Technical Implementation

### New Files Created
1. **`app/api/yahoo/player-stats-ranges/route.ts`** - API endpoint to fetch stats for multiple date ranges
2. **`app/api/yahoo/player-stats-seasons/route.ts`** - API endpoint to fetch stats for multiple seasons

### Modified Files
1. **`lib/yahoo/playerSearch.ts`** - Added `getPlayerOwnership()` function to get player ownership information
2. **`lib/yahoo/api.ts`** - Enhanced `getPlayerStats()` to support date ranges and added `getPlayerStatsMultipleRanges()` method
3. **`app/api/chat/route.ts`** - Updated player lookup to fetch ownership information and eligible positions
4. **`components/EnhancedCards.tsx`** - Enhanced player card UI to display new information
5. **`components/PlayerStats.tsx`** - Completely rewritten to fetch and display multiple time periods and historical seasons

### New Features
- **Parallel API Calls** - Stats for different time periods are fetched in parallel for better performance
- **Error Handling** - Graceful fallbacks when historical stats aren't available
- **Smart Display** - Only shows stat sections that have data
- **Organized Layout** - Stats are grouped by time period and category (hitting/pitching)

## Usage

When a user asks about a player (e.g., "Tell me about Aaron Judge"), the player card will now show:

1. Complete player profile with MLB team, all eligible positions, and fantasy league status
2. Current season performance across multiple time periods
3. Historical performance from the last 3 seasons
4. All stats properly formatted and organized

## Example Player Card

```
┌─────────────────────────────────────┐
│ Player Snapshot                     │
├─────────────────────────────────────┤
│ Aaron Judge                         │
│ MLB Team: NYY                       │
│ Position(s): OF, UTIL               │
│ Fantasy Status: [Free Agent]        │
│                                     │
│ Projected Points: 28.5              │
│ ADP: 5                              │
│                                     │
│ 2026 Season                         │
│ ├─ Season Total                     │
│ │  AB: 450  H: 135  HR: 45  ...    │
│ ├─ Last 30 Days                     │
│ │  AB: 95   H: 28   HR: 9   ...    │
│ ├─ Last 14 Days                     │
│ │  AB: 42   H: 13   HR: 4   ...    │
│ ├─ Last 7 Days                      │
│ │  AB: 21   H: 7    HR: 2   ...    │
│ └─ Today                            │
│    AB: 4    H: 2    HR: 1   ...    │
│                                     │
│ Historical Seasons                  │
│ ├─ 2025 Season                      │
│ │  AB: 550  H: 165  HR: 52  ...    │
│ ├─ 2024 Season                      │
│ │  AB: 520  H: 156  HR: 48  ...    │
│ └─ 2023 Season                      │
│    AB: 490  H: 147  HR: 45  ...    │
└─────────────────────────────────────┘
```

## Benefits

1. **Comprehensive View** - Users can see all relevant player information in one place
2. **Trend Analysis** - Multiple time periods help identify hot/cold streaks
3. **Historical Context** - Past seasons help evaluate player consistency
4. **Informed Decisions** - More data leads to better roster decisions
5. **League Integration** - Real-time ownership status from Yahoo Fantasy

## Notes

- Stats are fetched from Yahoo Fantasy API
- Requires Yahoo authentication to display stats
- Historical stats may not be available for all players or all seasons
- Date range calculations are based on current date
- Stats are cached and fetched on component mount for performance
