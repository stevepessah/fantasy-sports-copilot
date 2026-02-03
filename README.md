# Fantasy Sports Copilot

A conversational fantasy sports management platform that replaces traditional click-heavy interfaces with an AI-powered chat experience.

## 🎯 Vision

Instead of clicking → filtering → sorting → cross-referencing → guessing, you get:

**"Hey, what should I do this week?"**

## 🚀 MVP Features

### Core Functionality
- ✅ **Chat-first interface** - Primary UI is a conversational chat thread
- ✅ **Multi-sport support** - Football 🏈 and Baseball ⚾ with easy toggle
- ✅ **League creation** - "Create a 12-team PPR league" or "Create a 12-team roto league"
- ✅ **Draft room** - Live snake draft with AI assistant (sport-aware)
- ✅ **Lineup management** - "Set my best lineup" (works for both sports)
- ✅ **Player management** - Add/drop players via chat
- ✅ **Smart cards** - Contextual lineup/player/matchup cards

### AI Capabilities
- Conversational league setup
- Draft recommendations with explanations
- Lineup optimization with reasoning
- Trade evaluation
- Proactive injury/bye week alerts

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4 (with fallback rule-based system)
- **Database**: In-memory store (MVP) - ready for PostgreSQL/MongoDB

## 📦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key (optional - falls back to rule-based system)

### Installation

1. **Clone and install dependencies:**
```bash
cd fantasy-sports-copilot
npm install
```

2. **Set up environment variables:**
Create a `.env.local` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

3. **Run the development server:**
```bash
npm run dev
```

4. **Open your browser:**
Navigate to [http://localhost:3000](http://localhost:3000)

## 💬 Usage Examples

### Sport Toggle
Use the sport toggle at the top of the chat to switch between Football 🏈 and Baseball ⚾

### League Creation
**Football:**
```
You: "Create a 12-team PPR league"
AI: "Got it! I'll create a 12-team PPR league for you..."
```

**Baseball:**
```
You: "Create a 12-team roto league"
AI: "Got it! I'll create a 12-team roto league for you..."
```

### Lineup Management
```
You: "Set my best lineup"
AI: "I'll analyze your roster and set your optimal lineup..."
```

### Draft Help
**Football:**
```
You: "Who should I draft?"
AI: "Based on your current roster, I recommend..."
```

**Baseball:**
```
You: "Best SP available?"
AI: "Starting pitchers are the foundation. Let me find the best available..."
```

### Player Management
```
You: "Drop Player X for Player Y"
AI: "I'll help you make that swap. Here's why this makes sense..."
```

## 📁 Project Structure

```
fantasy-sports-copilot/
├── app/
│   ├── api/              # API routes
│   │   ├── chat/         # Chat endpoint
│   │   ├── leagues/      # League management
│   │   ├── draft/        # Draft operations
│   │   └── players/      # Player data
│   ├── page.tsx          # Main chat interface
│   └── layout.tsx        # Root layout
├── components/
│   ├── ChatInterface.tsx # Main chat UI
│   ├── DraftRoom.tsx     # Draft interface
│   └── SmartCards.tsx    # Contextual cards
├── lib/
│   ├── ai.ts             # AI integration
│   ├── db.ts             # Database layer
│   └── league.ts         # League logic
└── types/
    └── index.ts          # TypeScript types
```

## 🎯 MVP Scope

### ✅ In Scope
- **Fantasy Football** 🏈
  - Redraft leagues (10-12 teams)
  - Snake draft
  - Standard/PPR/Half-PPR scoring
  - Head-to-head matchups
- **Fantasy Baseball** ⚾
  - Redraft leagues (10-12 teams)
  - Snake draft
  - Roto/Points/Head-to-head scoring
  - Full position set (C, 1B, 2B, 3B, SS, OF, SP, RP, UTIL)
- Chat-based actions for both sports
- Sport toggle for easy switching

### ❌ Out of Scope (for MVP)
- Dynasty/Keeper leagues
- Auction drafts
- Best Ball
- Custom scoring beyond presets

## 🔮 Roadmap

### Phase 1 (30 days) - ✅ Current
- League creation
- Chat interface
- Read-only advice

### Phase 2 (30 days) - 🚧 Next
- Draft execution
- Lineup setting
- Adds/drops

### Phase 3 (30 days)
- Trades
- Commissioner tools
- Polish + onboarding

## 🤝 Contributing

This is an MVP build. Key areas for improvement:
- Real database integration
- Enhanced AI prompts
- More player data
- Better draft logic
- Trade negotiation features

## 📝 License

MIT

---

**Built with ❤️ to make fantasy sports management conversational and delightful.**
