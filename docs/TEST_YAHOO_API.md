# Testing Yahoo Fantasy Sports API Endpoints

## Prerequisites
- ✅ OAuth 2.0 connection successful
- ✅ Access token stored in cookies

## Test Endpoints

### 1. Check Authentication Status
**URL**: `https://fantasy-sports-copilot.vercel.app/api/yahoo/status`

**Expected Response**:
```json
{
  "authenticated": true
}
```

### 2. Get Your Leagues
**URL**: `https://fantasy-sports-copilot.vercel.app/api/yahoo/leagues?game=mlb`

**Expected Response**:
```json
{
  "leagues": [...]
}
```

### 3. Get Teams in a League
**URL**: `https://fantasy-sports-copilot.vercel.app/api/yahoo/teams?leagueKey=YOUR_LEAGUE_KEY`

**Note**: You'll need to get a league key from step 2 first.

**Expected Response**:
```json
{
  "teams": [...]
}
```

### 4. Get Team Roster
**URL**: `https://fantasy-sports-copilot.vercel.app/api/yahoo/roster?teamKey=YOUR_TEAM_KEY`

**Note**: You'll need to get a team key from step 3 first.

**Expected Response**:
```json
{
  "roster": [...]
}
```

### 5. Get Matchups
**URL**: `https://fantasy-sports-copilot.vercel.app/api/yahoo/matchups?leagueKey=YOUR_LEAGUE_KEY&week=1`

**Expected Response**:
```json
{
  "matchups": [...]
}
```

## Testing Steps

1. **Test status endpoint** - Verify you're authenticated
2. **Test leagues endpoint** - Get your league keys
3. **Test teams endpoint** - Get team information
4. **Test roster endpoint** - Get player rosters
5. **Test matchups endpoint** - Get matchup data

## Common Issues

- **401 Unauthorized**: Token expired or not set - reconnect Yahoo
- **404 Not Found**: Invalid league/team key
- **500 Error**: Check server logs for details
