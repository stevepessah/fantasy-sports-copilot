# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment (Optional)
Create `.env.local`:
```env
OPENAI_API_KEY=your_key_here
```

**Note:** The app works without OpenAI API key using a rule-based fallback system.

### 3. Start Development Server
```bash
npm run dev
```

### 4. Open Your Browser
Navigate to [http://localhost:3000](http://localhost:3000)

## 💬 Try These Commands

### Sport Toggle
Use the toggle at the top to switch between Football 🏈 and Baseball ⚾

### League Creation
**Football:**
```
"Create a 12-team PPR league"
```

**Baseball:**
```
"Create a 12-team roto league"
```

### Lineup Management
```
"Set my best lineup"
"Who should I start at flex?" (Football)
"Who should I start at utility?" (Baseball)
```

### Draft Help
**Football:**
```
"Who should I draft?"
"Best RB available?"
```

**Baseball:**
```
"Who should I draft?"
"Best SP available?"
```

### Player Management
```
"Drop Player X for Player Y"
"Who's the best WR on waivers?" (Football)
"Who's the best OF on waivers?" (Baseball)
```

### Trade Evaluation
```
"Is this trade fair?"
"Should I trade Player X for Player Y?"
```

## 🎯 What's Working

✅ **Chat Interface** - Full conversational UI
✅ **League Creation** - Natural language league setup
✅ **Draft Room** - Live draft with AI assistant
✅ **Lineup Optimization** - AI-powered lineup setting
✅ **Waivers** - Add/drop players via chat
✅ **Trades** - Trade evaluation and proposals
✅ **Smart Cards** - Contextual lineup/player/matchup cards

## 📝 Next Steps

1. **Add Real Player Data** - Integrate with NFL API or data source
2. **Database** - Replace in-memory store with PostgreSQL/MongoDB
3. **Authentication** - Add user accounts and sessions
4. **Real-time Updates** - WebSocket support for live drafts
5. **Enhanced AI** - Better prompts and function calling

## 🐛 Troubleshooting

**Port already in use?**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Module not found?**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**AI not responding?**
- Check your OpenAI API key in `.env.local`
- App will fall back to rule-based system if no key provided

## 🎉 You're Ready!

Start chatting with your fantasy copilot and see how conversational fantasy sports management works!
