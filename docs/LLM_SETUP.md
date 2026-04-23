# LLM Setup Guide

This guide walks you through setting up the LLM (Large Language Model) integration in Fantasy Sports Copilot.

## 🎯 Overview

Your app already has LLM integration built in! It uses **OpenAI's GPT-4** for natural language processing, with a smart fallback to a rule-based system if no API key is configured.

## 📋 Current Architecture

### How It Works

1. **Primary Path (with API key)**: Uses OpenAI GPT-4 Turbo for intelligent, conversational responses
2. **Fallback Path (no API key)**: Uses a rule-based system that recognizes keywords and patterns

The system automatically chooses the best path based on whether `OPENAI_API_KEY` is configured.

### Key Files

- **`lib/ai.ts`** - Main AI integration layer (`FantasyAI` class)
- **`app/api/chat/route.ts`** - API endpoint that processes chat messages
- **`components/ChatInterface.tsx`** - Frontend chat component

## 🚀 Setup Steps

### Step 1: Get an OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Click "Create new secret key"
4. Give it a name (e.g., "Fantasy Sports Copilot")
5. **Copy the key immediately** - you won't be able to see it again!

> ⚠️ **Important**: Keep your API key secret! Never commit it to git.

### Step 2: Create Environment File

Create a `.env.local` file in the root of your project:

```bash
# In your project root
touch .env.local
```

Add your API key:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Step 3: Verify Setup

1. **Restart your dev server** (if running):
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

2. **Test the integration**:
   - Open your app at `http://localhost:3000`
   - Try asking: "Create a 12-team PPR league"
   - If the LLM is working, you'll get a natural, conversational response
   - If not, you'll get the rule-based fallback (still functional, but less conversational)

## 🔍 How to Verify It's Working

### Check 1: Environment Variable Loading

The app reads the key in `lib/ai.ts`:

```typescript
constructor() {
  this.openaiApiKey = process.env.OPENAI_API_KEY || ''
}
```

### Check 2: API Call Flow

When a message is sent:
1. `ChatInterface.tsx` → sends POST to `/api/chat`
2. `app/api/chat/route.ts` → calls `fantasyAI.processMessage()`
3. `lib/ai.ts` → checks for API key:
   - ✅ **Has key**: Calls `processWithOpenAI()` → GPT-4
   - ❌ **No key**: Calls `processWithRules()` → Rule-based

### Check 3: Console Logs

Check your terminal/console for:
- ✅ **Success**: No errors, responses are natural and contextual
- ❌ **Error**: Look for "AI processing error" - API key might be invalid

## 🎛️ Configuration Options

### Current Model Settings

In `lib/ai.ts`, the OpenAI call uses:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',  // Model
  messages,
  temperature: 0.7,              // Creativity (0-1, higher = more creative)
  max_tokens: 1000,              // Response length limit
})
```

### Customizing the Model

You can change these settings in `lib/ai.ts`:

- **Model options**:
  - `gpt-4-turbo-preview` (current) - Best quality, more expensive
  - `gpt-4` - High quality
  - `gpt-3.5-turbo` - Faster, cheaper, good quality

- **Temperature** (0-1):
  - `0.3` - More deterministic, consistent
  - `0.7` (current) - Balanced
  - `1.0` - More creative, varied

- **Max tokens**:
  - `500` - Shorter responses
  - `1000` (current) - Balanced
  - `2000` - Longer, more detailed

## 🔐 Security Best Practices

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use different keys for dev/prod** - Create separate keys for each environment
3. **Set usage limits** - In OpenAI dashboard, set monthly spending limits
4. **Rotate keys regularly** - Especially if you suspect a leak

## 🌐 Production Deployment

### Vercel

When deploying to Vercel:

1. Go to your project settings → Environment Variables
2. Add `OPENAI_API_KEY` with your production key
3. Select all environments (Production, Preview, Development)
4. Redeploy

### Other Platforms

Set the `OPENAI_API_KEY` environment variable in your hosting platform's settings.

## 🐛 Troubleshooting

### Issue: "API key not found"

**Solution**: 
- Make sure `.env.local` is in the project root (same level as `package.json`)
- Restart your dev server after creating/modifying `.env.local`
- Check for typos in the variable name: `OPENAI_API_KEY` (not `OPENAI_KEY`)

### Issue: "Invalid API key"

**Solution**:
- Verify the key is correct (starts with `sk-`)
- Check if the key has expired or been revoked in OpenAI dashboard
- Make sure there are no extra spaces or quotes around the key

### Issue: "Rate limit exceeded"

**Solution**:
- You've hit OpenAI's rate limits
- Wait a few minutes and try again
- Consider upgrading your OpenAI plan
- Implement rate limiting in your app

### Issue: "App works but responses seem basic"

**Solution**:
- Check if the API key is actually being used (look for errors in console)
- The fallback system is active - verify `OPENAI_API_KEY` is set correctly
- Check network tab to see if API calls are being made

## 📊 Cost Considerations

OpenAI pricing (as of 2024):
- **GPT-4 Turbo**: ~$0.01 per 1K input tokens, ~$0.03 per 1K output tokens
- **GPT-3.5 Turbo**: ~$0.0005 per 1K input tokens, ~$0.0015 per 1K output tokens

A typical conversation might use:
- ~500 input tokens (system prompt + history + user message)
- ~200 output tokens (AI response)

**Estimated cost per message**: $0.01-0.02 with GPT-4 Turbo

## 🎯 Next Steps

Once your LLM is set up:

1. **Test different queries** - Try various fantasy sports questions
2. **Monitor usage** - Check OpenAI dashboard for usage and costs
3. **Customize prompts** - Edit `buildSystemPrompt()` in `lib/ai.ts` to refine behavior
4. **Add function calling** - Consider using OpenAI's function calling for structured actions

## 📚 Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Pricing](https://openai.com/pricing)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

---

**Need help?** Check the console logs or review the code in `lib/ai.ts` to understand the flow better.
