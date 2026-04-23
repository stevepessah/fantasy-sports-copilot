# Yahoo Fantasy Sports API Setup Guide

This guide will help you set up Yahoo Fantasy Sports API integration to use your existing Yahoo fantasy baseball league data.

## Prerequisites

1. A Yahoo account with a fantasy baseball league
2. A Yahoo Developer Network account

## Step 1: Register Your Application

1. Go to [Yahoo Developer Network](https://developer.yahoo.com/)
2. Sign in with your Yahoo account
3. Navigate to **"My Apps"** or **"Create an App"**
4. Click **"Create an App"** or **"Get API Key"**

### Application Details

- **Application Name**: Fantasy Sports Copilot (or your preferred name)
- **Application Type**: Web Application
- **Description**: Fantasy sports management app
- **Home Page URL**: `http://localhost:3000` (for development)
- **Callback Domain**: `localhost:3000` (for development)
- **API Permissions**: 
  - ✅ Select **"Fantasy Sports"**
  - ✅ Choose **"Read"** access (or "Read/Write" if you want to make transactions)

5. Click **"Create App"** or **"Create"**

## Step 2: Get Your Credentials

After creating your app, you'll receive:

- **Consumer Key** (also called Client ID)
- **Consumer Secret** (also called Client Secret)

**Important**: Keep these credentials secure! Never commit them to version control.

## Step 3: Configure Environment Variables

Create or update `.env.local` in your project root:

```env
# Yahoo OAuth Credentials
YAHOO_CONSUMER_KEY=your_consumer_key_here
YAHOO_CONSUMER_SECRET=your_consumer_secret_here

# OAuth Callback URL (for development)
YAHOO_CALLBACK_URL=http://localhost:3000/api/yahoo/callback

# Optional: OpenAI API Key (if you're using it)
OPENAI_API_KEY=your_openai_key_here
```

### For Production

When deploying to production (e.g., Vercel):

1. Update `YAHOO_CALLBACK_URL` to your production URL:
   ```
   YAHOO_CALLBACK_URL=https://your-domain.com/api/yahoo/callback
   ```

2. Update your Yahoo app settings:
   - Go back to Yahoo Developer Network
   - Edit your app
   - Update **Callback Domain** to your production domain
   - Update **Home Page URL** to your production URL

3. Add environment variables in your hosting platform:
   - **Vercel**: Project Settings → Environment Variables
   - Add all three variables for Production, Preview, and Development

## Step 4: Test the Integration

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Open your app**: `http://localhost:3000`

3. **Click "Connect Yahoo Fantasy League"** button

4. **You'll be redirected to Yahoo** to authorize the app:
   - Sign in with your Yahoo account
   - Review permissions
   - Click **"Agree"** or **"Allow"**

5. **You'll be redirected back** to your app with `?yahoo_connected=true`

6. **Test fetching data**:
   - The app should now be able to fetch your leagues, teams, and rosters

## Step 5: Verify It's Working

You can test the API endpoints:

```bash
# Check authentication status
curl http://localhost:3000/api/yahoo/status

# Get your leagues
curl http://localhost:3000/api/yahoo/leagues?game=mlb

# Get teams (replace with your league key)
curl "http://localhost:3000/api/yahoo/teams?leagueKey=YOUR_LEAGUE_KEY"
```

## Troubleshooting

### Error: "Yahoo OAuth credentials not configured"

**Solution**: Make sure `.env.local` exists and contains:
- `YAHOO_CONSUMER_KEY`
- `YAHOO_CONSUMER_SECRET`

### Error: "Invalid callback URL"

**Solution**: 
1. Check that `YAHOO_CALLBACK_URL` in `.env.local` matches your app's callback domain in Yahoo Developer Network
2. For localhost, use: `http://localhost:3000/api/yahoo/callback`
3. Make sure the callback domain in Yahoo settings is exactly `localhost:3000` (no http://)

### Error: "Failed to get request token"

**Possible causes**:
1. Invalid consumer key or secret
2. Callback URL mismatch
3. Network/firewall issues

**Solution**:
1. Double-check your credentials in `.env.local`
2. Verify callback URL matches exactly
3. Check Yahoo Developer Network for any app status issues

### Error: "Not authenticated" when fetching data

**Solution**:
1. Make sure you completed the OAuth flow (clicked "Connect" and authorized)
2. Check browser cookies - you should have `yahoo_access_token` cookie
3. Try disconnecting and reconnecting

### XML Parsing Issues

**Note**: Yahoo API returns XML, not JSON. The current implementation includes basic XML parsing. For production, you may want to:

1. Install a proper XML parser:
   ```bash
   npm install xml2js
   ```

2. Update `lib/yahoo/api.ts` to use xml2js for proper parsing

## Next Steps

Once connected, you can:

1. **View your leagues**: The app will fetch your Yahoo leagues
2. **View teams and rosters**: See all teams and players in your league
3. **View matchups**: See current week matchups and scores
4. **Integrate with your app**: Use Yahoo data instead of mock data

## Security Notes

- ✅ Never commit `.env.local` to git (it's in `.gitignore`)
- ✅ Use environment variables in production
- ✅ Consider using encrypted session storage for tokens (current implementation uses cookies)
- ✅ Implement token refresh logic for production (tokens expire after 30 days)

## API Rate Limits

Yahoo doesn't publish specific rate limits, but:
- Be respectful with API calls
- Cache data when possible
- Don't poll more than every 15-30 seconds
- Consider implementing request throttling

## Support

- [Yahoo Fantasy Sports API Documentation](https://developer.yahoo.com/fantasysports/guide/)
- [Yahoo Developer Network](https://developer.yahoo.com/)
- Check the console for detailed error messages
