# Yahoo OAuth with HTTPS for Localhost

Yahoo requires HTTPS for redirect URIs. For local development, we'll use **ngrok** to create an HTTPS tunnel.

## Option 1: Use ngrok (Recommended)

### Step 1: Install ngrok

```bash
# macOS (using Homebrew)
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start your Next.js dev server

```bash
npm run dev
```

Your app should be running on `http://localhost:3000`

### Step 3: Start ngrok tunnel

In a **new terminal window**, run:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 4: Update Yahoo Developer Console

1. Go to your Yahoo Developer Console
2. Update **Redirect URI(s)** to:
   ```
   https://abc123.ngrok.io/api/yahoo/callback
   ```
   (Replace `abc123.ngrok.io` with your actual ngrok URL)
3. Save changes

### Step 5: Update .env.local

Update your `.env.local`:

```env
YAHOO_CONSUMER_KEY=dj0yJmk9aENxNmdMVVlKbW1UJmQ9WVdrOVVFVkRVSFo1Y2xjbWNHbzlNQT09JnM9Y29uc3VtZXJzZWNyZXQmc3Y9MCZ4PTE0
YAHOO_CONSUMER_SECRET=f6d8351365a6a4a371d204cbc6aff6574a9c23f5
YAHOO_CALLBACK_URL=https://abc123.ngrok.io/api/yahoo/callback
```

(Replace `abc123.ngrok.io` with your actual ngrok URL)

### Step 6: Restart your dev server

```bash
# Stop and restart
npm run dev
```

### Step 7: Access via ngrok URL

Open your browser to: `https://abc123.ngrok.io` (not localhost)

Now try connecting Yahoo again!

## Option 2: Use ngrok with a fixed domain (Free tier)

If you sign up for a free ngrok account, you can get a fixed domain:

1. Sign up at https://dashboard.ngrok.com
2. Get your authtoken
3. Run: `ngrok config add-authtoken YOUR_TOKEN`
4. Use: `ngrok http 3000 --domain=your-fixed-domain.ngrok-free.app`

This way your URL won't change each time.

## Important Notes

- **ngrok URL changes**: Free ngrok URLs change each time you restart ngrok. You'll need to update Yahoo Developer Console each time.
- **Fixed domain**: Consider ngrok's paid plan or free account for a fixed domain.
- **Production**: When deploying to production (Vercel), use your production URL: `https://fantasy-sports-copilot.vercel.app/api/yahoo/callback`

## Alternative: Check if Yahoo allows localhost exception

Some OAuth providers allow `http://localhost` exceptions. Check Yahoo's documentation or try:
- `http://127.0.0.1:3000/api/yahoo/callback`
- Or contact Yahoo support about localhost development
