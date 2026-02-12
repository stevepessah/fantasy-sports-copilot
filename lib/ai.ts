// AI integration layer for conversational fantasy sports

import { AIResponse, League, Team, Player, Roster, Sport } from '@/types'

export interface AIContext {
  userId?: string
  leagueId?: string
  teamId?: string
  league?: League
  team?: Team
  roster?: Roster
  availablePlayers?: Player[]
  week?: number
  sport?: Sport
  // Injected Yahoo data context — structured text for the LLM
  yahooRosterContext?: string
  yahooLeagueKey?: string
}

// ─── Deep Fantasy Baseball Knowledge ────────────────────────────────────────
const FANTASY_BASEBALL_EXPERTISE = `
## Fantasy Baseball Expertise — Use This Framework for ALL Recommendations

### Scoring-Format Awareness (tailor every answer to the user's format)
**Rotisserie (Roto):**
- Cumulative stats across categories all season. Category balance is everything.
- Punting a category is very risky — you lose those points for the entire year.
- Marginal gains in categories you're trailing in are worth FAR more than adding 
  to categories you already lead. Always think about rank movement per category.
- At the trade deadline, overpay for categories you're close to gaining a rank in.

**Head-to-Head Categories (H2H Cats):**
- Weekly matchups. You only need to win the majority of categories each week.
- Streaming pitchers for 2-start weeks is extremely valuable.
- Consistency matters less than weekly upside — a player who's boom-or-bust 
  can still win you weeks.
- Late-season, target categories your opponent is weak in that week.

**Head-to-Head Points / Points League:**
- Volume is king. Plate appearances and innings pitched drive value.
- Two-start pitchers are gold. Prioritize pitchers with favorable schedules.
- Strikeouts (both hitting K and pitching K) swing points significantly.
- Daily lineup management matters more — fill every slot every day.

### Hitter Evaluation Framework
When analyzing a hitter, consider these metrics in order of importance:
1. **Barrel%** and **Exit Velocity (EV)** — These predict future power. A hitter 
   with 90+ mph avg EV and 8%+ Barrel% will hit for power regardless of current HR total.
2. **xBA / xSLG / xwOBA** — Expected stats based on batted-ball quality. Compare to 
   actual stats: if xBA >> BA, the hitter is UNLUCKY and due for regression UP (buy low).
   If BA >> xBA, the hitter is LUCKY and due for regression DOWN (sell high).
3. **BB% and K%** — Discipline and contact. BB% > 10% is elite patience. K% < 20% is 
   excellent contact. High K% hitters are volatile in AVG leagues.
4. **Sprint Speed** — For stolen base evaluation. 28+ ft/s is elite speed. 
   Combined with opportunity (batting order slot, team philosophy), predicts SB upside.
5. **BABIP** — Batting average on balls in play. League average is ~.300. 
   Sustained BABIP > .350 often regresses down; sustained < .260 often regresses up. 
   Exceptions: elite speed guys sustain high BABIP; slow ground-ball hitters sustain low BABIP.
6. **wRC+** — Weighted runs created plus, park- and league-adjusted. 100 is average. 
   120+ is very good. 140+ is elite. Best single-number summary of hitting production.
7. **Lineup slot / Team context** — Leadoff hitters score more Runs. 3-4-5 hitters get 
   more RBI. Hitters on good offenses get more R and RBI regardless of individual talent.
8. **Platoon splits** — Some hitters have extreme L/R splits. If a hitter only starts 
   vs RHP, their counting stats have a ~60% ceiling. Full-time players are more valuable.

### Pitcher Evaluation Framework
When analyzing a pitcher, consider these metrics in order of importance:
1. **Stuff+ / pitching+ / Location+** — Modern pitch-quality metrics. Stuff+ > 110 
   indicates elite pitch quality that will sustain strikeout rates.
2. **FIP / xFIP / SIERA** — Better predictors of future ERA than actual ERA.
   A pitcher with 4.50 ERA but 3.20 FIP is a BUY — their defense/luck was bad.
   A pitcher with 2.80 ERA but 4.10 FIP is a SELL — regression is coming.
3. **SwStr% (Swinging Strike Rate)** — League average is ~11%. Above 12% = above-average 
   K upside. Above 14% = elite strikeout pitcher. This is the #1 K predictor.
4. **K% and K-BB%** — K% > 25% is very good. K-BB% > 15% is elite.
   K-BB% is the single best quick-look stat for pitcher quality.
5. **GB% (Ground Ball Rate)** — GB% > 50% helps suppress HR. Fly-ball pitchers in 
   small parks (Coors, Yankee Stadium, Great American) are riskier.
6. **HR/FB% (Home Run per Fly Ball)** — League average is ~12%. If a pitcher has 
   HR/FB > 15%, their ERA is likely inflated and may regress down. If < 8%, their 
   ERA is likely deflated and may regress up.
7. **WHIP components** — A high WHIP from walks (BB) is more concerning than from hits, 
   because walk rates are more stable. A pitcher who walks many will continue to.
8. **Workload & Innings limit** — Young pitchers may have innings caps. A pitcher 
   shut down in September has zero value in roto finishes.
9. **Team context** — Pitchers on teams with good offenses get more Win opportunities. 
   Closers on bad teams may lose their job or get fewer save chances.

### Trade Evaluation Principles
ALWAYS apply these principles when evaluating or suggesting trades:

1. **Replacement Level Thinking** — Value players based on how much better they are 
   than what's freely available on waivers. A top-5 SP is worth more than a top-5 OF 
   because replacement-level SPs (~4.50 ERA) are much worse than replacement-level OF 
   (~.240 AVG, 18 HR). The gap above replacement is what matters.

2. **Positional Scarcity** — Positions with fewer elite options are more valuable:
   - Most scarce: C, SS, 2B (fewest elite options)
   - Medium scarcity: 3B, SP (moderate depth)
   - Least scarce: OF, 1B, RP (deep talent pools)
   Always factor this in. An elite SS is worth more than an equally-performing OF.

3. **Category Need / Format Fit** — A trade that improves your 2 weakest categories by 
   2 ranks each while costing you 1 rank in a strong category is a GREAT trade in roto. 
   Always frame trade value relative to the user's team needs.

4. **Buy Low / Sell High Signals:**
   - BUY LOW: Player with poor surface stats but strong underlying metrics 
     (xBA >> BA, FIP << ERA, high Barrel%, low BABIP). The market undervalues them.
   - SELL HIGH: Player with great surface stats but weak underlyings 
     (BA >> xBA, ERA << FIP, high BABIP, low Barrel%). Sell before regression.

5. **Consolidation Wins** — In 2-for-1 trades, the side getting the single best player 
   usually wins. Roster spots have value — the 2-for-1 side gains a streaming slot.

6. **Rest-of-Season (ROS) vs Year-to-Date (YTD)** — Never value a player purely on 
   YTD stats. Weight the last 30 days more heavily than full season for trend detection,
   but use 2-3 year track records for true talent estimation.

7. **Age Curve** — Hitters typically peak at 27-29. Pitchers are riskier after 32+.
   Young breakouts (age 24-26 with elite metrics) often have their best years ahead.
   Aging veterans with declining metrics should be sold, not held.

### Team Management Principles
- **Daily Lineup Management:** Fill every roster slot every day. Even a mediocre hitter 
  playing > an empty slot. This is the #1 mistake casual players make.
- **Streaming:** In H2H formats, stream pitchers on favorable matchups (vs bad lineups, 
  in pitcher-friendly parks). In roto, stream cautiously — bad starts hurt ratios all year.
- **IL Stashes:** Stash high-upside injured players when IL slots are available. 
  A top-30 player returning in 3 weeks is worth an IL slot over a marginal roster player.
- **Roster Flexibility:** Multi-position eligible players (2B/SS, OF/1B, SP/RP) are 
  more valuable than single-position players because they give lineup flexibility.
- **Waiver Priority:** Don't burn high waiver claims on marginal upgrades. Save them for 
  breakout players or closer promotions. In FAAB leagues, spend 15-25% on clear impact adds.
- **Schedule Awareness:** Players with more games in a week are more valuable in H2H. 
  Check the weekly schedule before setting lineups.

### Communication Style for Recommendations
- Always state your recommendation clearly first, then explain WHY
- Reference specific stats to justify your reasoning
- Acknowledge uncertainty — "Based on his underlying metrics, I expect..." not "He WILL..."
- If the user's roster context is available, personalize advice to THEIR specific team needs
- When comparing players, use a structured format: strengths, weaknesses, verdict
- Proactively flag injury risks, platoon concerns, and schedule notes
`

// ─── AI Class ───────────────────────────────────────────────────────────────

export class FantasyAI {
  private openaiApiKey: string
  private _openaiClient: any | null = null

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || ''
  }

  /** Lazily create and cache a single OpenAI client instance. */
  private async getOpenAIClient() {
    if (!this._openaiClient) {
      const { OpenAI } = await import('openai')
      this._openaiClient = new OpenAI({ apiKey: this.openaiApiKey })
    }
    return this._openaiClient
  }

  async processMessage(
    userMessage: string,
    context: AIContext,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      if (this.openaiApiKey) {
        return await this.processWithOpenAI(userMessage, systemPrompt, conversationHistory, context)
      } else {
        return this.processWithRules(userMessage, context)
      }
    } catch (error) {
      console.error('AI processing error:', error)
      return this.processWithRules(userMessage, context)
    }
  }

  private buildSystemPrompt(context: AIContext): string {
    let prompt = `You are Fantasy Baseball Copilot — an expert-level AI assistant for fantasy baseball.
You combine deep sabermetric knowledge with practical fantasy strategy to help users 
win their leagues through natural conversation.

## Core Principles
- Lead with your recommendation, then explain the reasoning using specific stats
- Always explain WHY you're recommending something — cite the metrics
- Tailor advice to the user's scoring format (roto, H2H cats, points) when known
- Be proactive about risks: injuries, innings limits, platoon concerns, cold streaks
- When the user's roster is available, personalize ALL advice to their specific team needs
- Understand user intent from natural language — be flexible, not rigid
- Be conversational and confident, but acknowledge uncertainty when projecting

${FANTASY_BASEBALL_EXPERTISE}

## Current Context
- Sport: Baseball
`

    if (context.league) {
      prompt += `- League: ${context.league.name} (${context.league.numTeams} teams, ${context.league.scoringType} scoring)\n`
      prompt += `- Scoring Format: ${context.league.scoringType} — TAILOR ALL ADVICE to this format\n`
      prompt += `- Status: ${context.league.status}\n`
    }

    if (context.team) {
      prompt += `- User's team: ${context.team.name} (Record: ${context.team.wins}-${context.team.losses})\n`
    }

    if (context.week) {
      prompt += `- Current week: ${context.week}\n`
    }

    // Inject real Yahoo roster + stats context if available
    if (context.yahooRosterContext) {
      prompt += `\n## User's Actual Roster & Statistics (from Yahoo Fantasy)\n`
      prompt += `USE THIS DATA to give personalized, data-driven advice.\n`
      prompt += `When evaluating trades, compare against THESE players.\n`
      prompt += `When suggesting pickups, identify weaknesses in THIS roster.\n\n`
      prompt += context.yahooRosterContext
      prompt += `\n`
    }

    prompt += `
## Available Actions (understand flexibly from natural language)
- View teams/standings: "show teams", "standings", "who's in my league"
- Set lineup: "set my lineup", "who should I start", "best lineup", "optimize lineup"
- View lineup: "show my lineup", "view lineup", "current lineup"
- Matchup: "show matchup", "who am I playing", "my opponent"
- Waivers: "waiver wire", "who should I pick up", "free agents"
- Add/drop: "drop Player X for Player Y", "add Player X"
- Draft help: "who should I draft", "draft advice"
- Trade evaluation: "should I trade X for Y", "evaluate trade", "suggest a trade"
- Player analysis: "tell me about [player]", "how is [player] doing"
- Create league: "create a 12-team roto league"
- General strategy: Answer any fantasy baseball strategy question with expert analysis

IMPORTANT: Be flexible with user intent. Don't require exact phrases.
When roster data is available, ALWAYS reference it in your analysis.
For trade questions, evaluate using replacement level, positional scarcity, and category need.`

    return prompt
  }

  private async processWithOpenAI(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: AIContext
  ): Promise<AIResponse> {
    const openai = await this.getOpenAIClient()

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user' as const, content: userMessage },
    ]

    // Define functions for structured actions
    const functions = [
      {
        name: 'view_teams',
        description: 'Show all teams in the league with standings',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'set_lineup',
        description: 'Set or optimize the user\'s lineup',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'show_lineup',
        description: 'Show the user\'s current lineup',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'show_matchup',
        description: 'Show the user\'s current matchup/opponent',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'show_waivers',
        description: 'Show available players on waivers or free agents',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'evaluate_trade',
        description: 'Evaluate a proposed trade between players. Use when the user asks about trading, whether a trade is fair, or wants trade advice. Analyze using replacement level, positional scarcity, category need, and underlying metrics.',
        parameters: {
          type: 'object',
          properties: {
            giving_players: {
              type: 'string',
              description: 'Comma-separated names of players the user would give away',
            },
            receiving_players: {
              type: 'string',
              description: 'Comma-separated names of players the user would receive',
            },
            analysis: {
              type: 'string',
              description: 'Your detailed analysis of the trade, referencing specific stats and the user\'s roster needs',
            },
          },
          required: ['analysis'],
        },
      },
      {
        name: 'suggest_roster_move',
        description: 'Suggest an add/drop, waiver claim, or roster management move. Use when the user asks for roster advice, who to pick up, or who to drop.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add', 'drop', 'add_drop', 'stream', 'stash'],
              description: 'Type of roster move',
            },
            player_name: {
              type: 'string',
              description: 'Player to add, stream, or stash',
            },
            drop_player_name: {
              type: 'string',
              description: 'Player to drop (for add/drop swaps)',
            },
            reasoning: {
              type: 'string',
              description: 'Detailed reasoning for the roster move',
            },
          },
          required: ['action', 'reasoning'],
        },
      },
    ]

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        functions,
        function_call: 'auto',
        temperature: 0.6, // Slightly lower for more consistent analytical reasoning
        max_tokens: 1500, // More room for detailed analysis
      })

      const responseMessage = completion.choices[0]?.message
      const responseText = responseMessage?.content || ''

      // Check if the model wants to call a function
      if (responseMessage?.function_call) {
        const functionName = responseMessage.function_call.name
        let functionArgs: any = {}
        try {
          functionArgs = JSON.parse(responseMessage.function_call.arguments || '{}')
        } catch { /* ignore parse errors */ }

        const action = this.mapFunctionToAction(functionName, context, functionArgs)
        
        // For analytical functions, use the model's analysis as the response
        if (functionName === 'evaluate_trade' && functionArgs.analysis) {
          return {
            message: functionArgs.analysis,
            action,
          }
        }
        if (functionName === 'suggest_roster_move' && functionArgs.reasoning) {
          return {
            message: functionArgs.reasoning,
            action,
          }
        }

        const naturalResponse = this.generateResponseForAction(functionName, context)
        
        return {
          message: naturalResponse || responseText,
          action,
        }
      }

      // Parse response for actions as fallback
      const action = this.extractAction(userMessage, responseText, context)

      return {
        message: responseText,
        action,
      }
    } catch (error) {
      console.error('OpenAI API error:', error)
      return this.processWithRules(userMessage, context)
    }
  }

  private mapFunctionToAction(functionName: string, context: AIContext, args?: any): AIResponse['action'] {
    switch (functionName) {
      case 'view_teams':
        return { type: 'view_teams' }
      case 'set_lineup':
        return {
          type: 'set_lineup',
          data: { teamId: context.teamId },
        }
      case 'show_lineup':
        return {
          type: 'show_lineup',
          data: { teamId: context.teamId },
        }
      case 'show_matchup':
        return {
          type: 'show_matchup',
          data: { teamId: context.teamId, leagueId: context.leagueId },
        }
      case 'show_waivers':
        return { type: 'show_waivers' }
      case 'evaluate_trade':
        return {
          type: 'propose_trade',
          data: {
            player1: args?.giving_players,
            player2: args?.receiving_players,
            analysis: args?.analysis,
          },
        }
      case 'suggest_roster_move':
        return {
          type: 'add_player',
          data: {
            action: args?.action,
            addPlayer: args?.player_name,
            dropPlayer: args?.drop_player_name,
            reasoning: args?.reasoning,
          },
        }
      default:
        return undefined
    }
  }

  private generateResponseForAction(functionName: string, context: AIContext): string {
    switch (functionName) {
      case 'view_teams':
        return "I'll show you all the teams in your league. Check the card below for the full standings!"
      case 'set_lineup':
        return "I'll analyze your roster and set your optimal lineup based on matchups, projections, and recent performance. Give me a moment..."
      case 'show_lineup':
        return "Here's your current lineup:"
      case 'show_matchup':
        return "Let me show you your matchup for this week:"
      case 'show_waivers':
        return "I'll help you find the best available players. Let me check the waiver wire..."
      default:
        return ''
    }
  }

  private processWithRules(userMessage: string, context: AIContext): AIResponse {
    const lowerMessage = userMessage.toLowerCase()

    // League creation
    if (lowerMessage.includes('create') && lowerMessage.includes('league')) {
      return this.handleLeagueCreation(userMessage, context)
    }

    // Lineup management - more flexible
    if (
      lowerMessage.includes('lineup') || 
      lowerMessage.includes('start') || 
      lowerMessage.includes('bench') ||
      lowerMessage.includes('who should i start') ||
      lowerMessage.includes('who should i play') ||
      lowerMessage.includes('set my lineup') ||
      lowerMessage.includes('best lineup') ||
      lowerMessage.includes('optimal lineup')
    ) {
      return this.handleLineupManagement(userMessage, context)
    }

    // Draft help
    if (lowerMessage.includes('draft') || lowerMessage.includes('pick')) {
      return this.handleDraftHelp(userMessage, context)
    }

    // Add/drop
    if (lowerMessage.includes('drop') || lowerMessage.includes('add') || lowerMessage.includes('waiver')) {
      return this.handleAddDrop(userMessage, context)
    }

    // Trade
    if (lowerMessage.includes('trade')) {
      return this.handleTrade(userMessage, context)
    }

    // View teams - much more flexible matching
    if (
      lowerMessage.includes('teams') || 
      lowerMessage.includes('standings') ||
      lowerMessage.includes('who\'s in') ||
      lowerMessage.includes('who is in') ||
      lowerMessage.includes('what teams') ||
      (lowerMessage.includes('show') && (lowerMessage.includes('teams') || lowerMessage.includes('standings'))) ||
      (lowerMessage.includes('view') && (lowerMessage.includes('teams') || lowerMessage.includes('standings'))) ||
      (lowerMessage.includes('list') && lowerMessage.includes('teams'))
    ) {
      return {
        message: "I'll show you all the teams in your league. Check the card below for the full standings!",
      }
    }

    // Default response
    return {
      message: "I'm here to help with your fantasy team! You can ask me to:\n\n• Create a league\n• Set your lineup\n• View all teams\n• Help with drafting\n• Add or drop players\n• Evaluate trades\n\nWhat would you like to do?",
    }
  }

  private handleLeagueCreation(message: string, context: AIContext): AIResponse {
    const sport = context.sport || 'baseball'
    const numTeamsMatch = message.match(/(\d+)[\s-]?team/i)
    
    const scoringMatch = message.match(/(roto|points|head[\s-]?to[\s-]?head|h2h)/i)
    const scoringType = scoringMatch 
      ? (scoringMatch[1].toLowerCase().includes('roto') ? 'roto'
        : scoringMatch[1].toLowerCase().includes('point') ? 'points'
        : 'head-to-head')
      : 'roto'
    
    const numTeams = numTeamsMatch ? parseInt(numTeamsMatch[1]) : 12

    if (numTeams < 10 || numTeams > 12) {
      return {
        message: `I can create leagues with 10-12 teams. You mentioned ${numTeams} teams. Please specify a number between 10 and 12.`,
      }
    }

    const explanation = scoringType === 'roto'
      ? 'category-based scoring across multiple stats'
      : scoringType === 'points'
      ? 'point-based scoring'
      : 'head-to-head weekly matchups'

    return {
      message: `Got it! I'll create a ${numTeams}-team ${scoringType.toUpperCase()} baseball league for you. This league will reward ${explanation}. Ready to set it up?`,
      action: {
        type: 'create_league',
        data: {
          numTeams,
          scoringType,
          draftType: 'snake',
          sport: 'baseball',
        },
      },
    }
  }

  private handleLineupManagement(message: string, context: AIContext): AIResponse {
    if (!context.roster) {
      return {
        message: "I don't see your roster yet. Make sure you're in a league and have drafted your team.",
      }
    }

    return {
      message: "I'll analyze your roster and set your optimal lineup based on matchups, projections, and bye weeks. Give me a moment...",
      action: {
        type: 'set_lineup',
        data: {
          teamId: context.teamId,
        },
      },
    }
  }

  private handleDraftHelp(message: string, context: AIContext): AIResponse {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('sp') || lowerMessage.includes('starting pitcher') || lowerMessage.includes('pitcher')) {
      return {
        message: "Starting pitchers are the foundation of fantasy baseball. They provide wins, strikeouts, ERA, and WHIP. Let me find the best available SPs...",
        action: {
          type: 'draft_pick',
        },
      }
    }
    
    if (lowerMessage.includes('hitter') || lowerMessage.includes('batter') || lowerMessage.includes('position player')) {
      return {
        message: "Hitters provide the offensive categories: average, home runs, RBIs, runs, and stolen bases. Let me check the best available hitters...",
        action: {
          type: 'draft_pick',
        },
      }
    }
    
    return {
      message: "I'll help you with your baseball draft! Based on your current roster and available players, here are my recommendations...",
      action: {
        type: 'draft_pick',
      },
    }
  }

  private handleAddDrop(message: string, context: AIContext): AIResponse {
    const lowerMessage = message.toLowerCase()
    
    // Try to extract player names
    const dropMatch = lowerMessage.match(/drop\s+([^for]+?)(?:\s+for|\s*$)/i)
    const addMatch = lowerMessage.match(/(?:add|pick\s+up|get)\s+([^?]+?)(?:\s*\?|$)/i) || 
                     lowerMessage.match(/for\s+([^?]+?)(?:\s*\?|$)/i)

    if (dropMatch && addMatch) {
      return {
        message: `I'll help you drop ${dropMatch[1].trim()} and add ${addMatch[1].trim()}. Let me check if this makes sense for your roster...`,
        action: {
          type: 'add_player',
          data: {
            dropPlayer: dropMatch[1].trim(),
            addPlayer: addMatch[1].trim(),
          },
        },
      }
    }

    if (lowerMessage.includes('waiver') || lowerMessage.includes('available')) {
      return {
        message: "I'll help you find the best available players. Let me check the waiver wire...",
        action: {
          type: 'add_player',
        },
      }
    }

    return {
      message: "I'll help you find the best available players and suggest who to drop. Let me check the waiver wire...",
      action: {
        type: 'add_player',
      },
    }
  }

  private handleTrade(message: string, context: AIContext): AIResponse {
    const lowerMessage = message.toLowerCase()
    
    // Try to extract trade details
    const tradeMatch = lowerMessage.match(/(?:trade|give)\s+([^for]+?)\s+for\s+([^?]+?)(?:\s*\?|$)/i)
    
    if (tradeMatch) {
      const player1 = tradeMatch[1].trim()
      const player2 = tradeMatch[2].trim()
      
      return {
        message: `I'll evaluate trading ${player1} for ${player2}. Let me analyze the value, roster impact, and long-term implications...`,
        action: {
          type: 'propose_trade',
          data: {
            player1,
            player2,
          },
        },
      }
    }

    if (lowerMessage.includes('fair') || lowerMessage.includes('evaluate')) {
      return {
        message: "I'll evaluate this trade for you. Let me analyze the value, roster impact, and long-term implications...",
        action: {
          type: 'propose_trade',
        },
      }
    }

    return {
      message: "I'll help you with trades. You can ask me to evaluate a trade or suggest one. What would you like to do?",
    }
  }

  private extractAction(
    userMessage: string,
    aiResponse: string,
    context: AIContext
  ): AIResponse['action'] {
    // Enhanced action extraction with more flexible matching
    const lowerMessage = userMessage.toLowerCase()

    if (lowerMessage.includes('create') && lowerMessage.includes('league')) {
      return this.handleLeagueCreation(userMessage, context).action
    }

    // View teams
    if (
      lowerMessage.includes('teams') || 
      lowerMessage.includes('standings') ||
      lowerMessage.includes('who\'s in') ||
      lowerMessage.includes('who is in') ||
      lowerMessage.includes('what teams')
    ) {
      return { type: 'view_teams' }
    }

    // Set lineup
    if (
      lowerMessage.includes('lineup') && 
      (lowerMessage.includes('set') || lowerMessage.includes('optimize') || lowerMessage.includes('best') || lowerMessage.includes('optimal')) ||
      lowerMessage.includes('who should i start') ||
      lowerMessage.includes('who should i play')
    ) {
      return {
        type: 'set_lineup',
        data: { teamId: context.teamId },
      }
    }

    // Show lineup
    if (
      (lowerMessage.includes('lineup') && (lowerMessage.includes('show') || lowerMessage.includes('view') || lowerMessage.includes('see'))) ||
      lowerMessage === 'lineup' ||
      lowerMessage === 'my lineup'
    ) {
      return {
        type: 'show_lineup',
        data: { teamId: context.teamId },
      }
    }

    // Matchup
    if (
      lowerMessage.includes('matchup') ||
      lowerMessage.includes('who am i playing') ||
      lowerMessage.includes('who am i facing') ||
      lowerMessage.includes('opponent')
    ) {
      return {
        type: 'show_matchup',
        data: { teamId: context.teamId, leagueId: context.leagueId },
      }
    }

    return undefined
  }
}

export const fantasyAI = new FantasyAI()
