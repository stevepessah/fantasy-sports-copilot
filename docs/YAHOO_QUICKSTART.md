# Yahoo Fantasy Sports API - Quick Start

## 🚀 Get Started in 5 Minutes

### 1. Get Yahoo API Credentials

1. Go to https://developer.yahoo.com/
2. Sign in → "My Apps" → "Create an App"
3. Fill in:
   - **Application Name**: Fantasy Sports Copilot
   - **Application Type**: Web Application
   - **Callback Domain**: `localhost:3000`
   - **API Permissions**: Fantasy Sports (Read)
4. Copy your **Consumer Key** and **Consumer Secret**

### 2. Add Environment Variables

Create `.env.local` in your project root:

```env
YAHOO_CONSUMER_KEY=your_key_here
YAHOO_CONSUMER_SECRET=your_secret_here
YAHOO_CALLBACK_URL=http://localhost:3000/api/yahoo/callback
```

### 3. Install XML Parser (Optional but Recommended)

```bash
npm install xml2js @types/xml2js
```

**Note**: Yahoo returns XML, not JSON. The current implementation works but proper XML parsing is recommended for production.

### 4. Start Your App

```bash
npm run dev
```

### 5. Connect Your Yahoo Account

1. Open http://localhost:3000
2. Look for **"Connect Yahoo Fantasy League"** button in the sidebar
3. Click it → Authorize with Yahoo → Done!

### 6. Test It

Your app is now connected to your Yahoo fantasy baseball league! 

Try fetching your data:
- Leagues: `/api/yahoo/leagues?game=mlb`
- Teams: `/api/yahoo/teams?leagueKey=YOUR_LEAGUE_KEY`
- Roster: `/api/yahoo/roster?teamKey=YOUR_TEAM_KEY`

## ✅ What's Working

- ✅ OAuth authentication flow
- ✅ Fetch your leagues
- ✅ Fetch teams and rosters
- ✅ Fetch matchups
- ✅ All API routes ready

## 📝 Next Steps

1. **Integrate Yahoo data into your UI** - Replace mock data with real Yahoo data
2. **Add XML parsing** - Install xml2js for better data parsing
3. **Map Yahoo players to your Player type** - Convert Yahoo data format to your app's format

See `YAHOO_INTEGRATION_SUMMARY.md` for detailed implementation guide.

## 🐛 Issues?

See `YAHOO_SETUP.md` for troubleshooting.
