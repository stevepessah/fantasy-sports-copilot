# Multi-Sport Support

Fantasy Sports Copilot now supports both **Football** 🏈 and **Baseball** ⚾!

## 🎯 How It Works

### Sport Toggle
The sport toggle appears at the top of the chat interface, allowing you to switch between Football and Baseball seamlessly.

### Sport-Aware Features

#### League Creation
- **Football**: "Create a 12-team PPR league"
- **Baseball**: "Create a 12-team roto league"

The AI automatically detects which sport you're working with based on:
1. The current sport toggle setting
2. The scoring type mentioned (PPR = football, roto = baseball)
3. Context from your conversation

#### Draft Room
- Football: Shows QB, RB, WR, TE, K, DEF positions
- Baseball: Shows C, 1B, 2B, 3B, SS, OF, SP, RP, UTIL positions

#### Lineup Management
- **Football**: Optimizes for QB, 2 RB, 3 WR, TE, FLEX, K, DEF
- **Baseball**: Optimizes for C, 1B, 2B, 3B, SS, 3 OF, UTIL, 2 SP, 2 RP

#### Player Data
- **Football**: 29 sample players (QBs, RBs, WRs, TEs, Ks, DEFs)
- **Baseball**: 32 sample players (Catchers, Infielders, Outfielders, Starting Pitchers, Relief Pitchers)

## 🏈 Football Features

### Positions
- QB (Quarterback)
- RB (Running Back)
- WR (Wide Receiver)
- TE (Tight End)
- K (Kicker)
- DEF (Defense)

### Scoring Types
- **Standard**: Traditional scoring
- **PPR**: Point Per Reception
- **Half-PPR**: 0.5 points per reception

### Lineup
- 1 QB, 2 RB, 3 WR, 1 TE, 1 FLEX, 1 K, 1 DEF
- 5 Bench spots
- Total: 15 players

## ⚾ Baseball Features

### Positions
- C (Catcher)
- 1B (First Base)
- 2B (Second Base)
- 3B (Third Base)
- SS (Shortstop)
- OF (Outfield)
- SP (Starting Pitcher)
- RP (Relief Pitcher)
- UTIL (Utility - any hitter)

### Scoring Types
- **Roto**: Category-based scoring (AVG, HR, RBI, R, SB, W, ERA, WHIP, K, SV)
- **Points**: Point-based scoring
- **Head-to-Head**: Weekly head-to-head matchups

### Lineup
- 1 C, 1 1B, 1 2B, 1 3B, 1 SS, 3 OF, 1 UTIL, 2 SP, 2 RP
- 5 Bench spots
- Total: 18 players

## 🔄 Switching Sports

1. Click the sport toggle at the top of the chat
2. The AI context automatically updates
3. All player queries filter by the selected sport
4. League creation uses the correct sport

## 💡 AI Context

The AI is fully aware of which sport you're working with:
- Provides sport-appropriate advice
- Uses correct terminology (RB vs SP, PPR vs Roto)
- Understands position requirements
- Suggests relevant strategies

## 🚀 Example Conversations

### Football
```
You: "Create a 12-team PPR league"
AI: "Got it! I'll create a 12-team PPR football league..."

You: "Who should I draft?"
AI: "For fantasy football, I'd recommend focusing on RBs early..."

You: "Best RB available?"
AI: "Here are the top available running backs..."
```

### Baseball
```
You: [Switch to Baseball] "Create a 12-team roto league"
AI: "Got it! I'll create a 12-team roto baseball league..."

You: "Who should I draft?"
AI: "For fantasy baseball, balance is key. I'd recommend..."

You: "Best SP available?"
AI: "Starting pitchers are crucial. Here are the top available SPs..."
```

## 📊 Data Separation

- Players are tagged with their sport
- Leagues specify their sport
- All queries automatically filter by sport
- No cross-sport contamination

## 🎯 Future Sports

The architecture is designed to easily add more sports:
- Basketball 🏀
- Hockey 🏒
- Soccer ⚽

Just add the sport type, positions, and scoring rules!
