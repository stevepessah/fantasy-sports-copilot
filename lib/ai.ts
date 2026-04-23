// AI integration layer for conversational fantasy sports

import { AIResponse, League, Team, Player, Roster, Sport } from '@/types'
import { detectArchetype } from '@/lib/statArchetypes'

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
  // League settings context — stat categories, roster positions, etc.
  yahooLeagueSettingsContext?: string
  // Whether the user has Yahoo connected (affects fallback messaging)
  hasYahooConnection?: boolean
  // Which tab the user was viewing when they started the chat
  originTab?: string
  // Detected stat archetype for the current message (e.g. "power", "speed")
  archetypeContext?: string
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

### Understanding User Intent — Stat Archetypes
When users use casual baseball language, you KNOW what they mean. Translate immediately:
- "power" / "power hitter" / "I need power" / "slugger" / "masher" → HR, SLG, OPS, extra-base hits
- "speed" / "fast guy" / "steals" / "stolen bases" → SB, R, sprint speed
- "contact hitter" / "high average" / "need average" → AVG, OBP, low K%
- "ace" / "top arm" / "elite pitcher" / "frontline starter" → K, low ERA, low WHIP, Stuff+, QS
- "closer" / "saves" → SV, HLD, late-inning relief
- "strikeout pitcher" / "swing and miss" → K rate, SwStr%, whiff rate
- "ratios" / "low ERA" / "low WHIP" → ERA, WHIP, FIP
- "all-around" / "five-category" / "five-tool" → OPS, HR, SB, R, RBI balance

NEVER ask "what do you mean by power?" — just recommend players who hit home runs and slug.
When recommending based on archetypes, name SPECIFIC PLAYERS and cite their relevant stats.
If the user has roster data, identify which players on their team or on waivers fit the archetype.

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
- Talk like a knowledgeable fantasy baseball friend, not a customer service bot or textbook
- If a user's message is vague or casual, make your best guess and run with it — never punt to a menu
- Short, punchy responses for simple questions; go deep only when the user asks for detail
- Mirror the user's energy and language ("you want power? here's who's mashing right now...")

## CRITICAL RESPONSE RULES
- NEVER give a canned "I'm here to help! You can ask me to:" bullet-point menu. This is the #1 thing to avoid.
- NEVER list your capabilities or suggest example prompts. Just answer the question.
- NEVER say "Give me a moment..." or "Let me analyze..." and then stop. Actually DO the analysis inline.
- ALWAYS attempt to answer the user's actual question, even if you need to make reasonable assumptions.
- If you have league settings data below, USE IT to answer questions about stats, categories, scoring, etc.
- If you have roster data below, USE IT to give personalized analysis rather than generic advice.
- If you genuinely don't have the data to answer, say specifically what data is missing — don't redirect to a menu.
- Be conversational and natural. If someone says "hey" or "what's up", respond warmly. If they say "power", recommend power hitters.
- When the user asks about their league (stats, categories, format, settings), look at the League Settings section below for the actual answer.
- You can and should answer general fantasy baseball knowledge questions directly, without needing league-specific data.
- If the user asks for a type of player (power, speed, etc.), give concrete player names and stats — not a definition of what power means.

## LINEUP & ACTION REQUESTS — ALWAYS GIVE REAL ANALYSIS
When the user asks to "set my lineup", "optimize lineup", "who should I start", "best lineup", etc.:
- Look at the roster data in the "User's Actual Roster & Statistics" section below.
- Identify SPECIFIC players who should start vs sit, WITH reasoning for each decision.
- Reference matchups, recent performance, platoon splits, and stats to justify your choices.
- If a player is injured or on the IL, flag it and suggest alternatives.
- Give a concrete, actionable lineup — not a vague promise to "analyze" it.
- If no roster data is available, say so clearly and suggest connecting Yahoo.

When the user asks to view standings, matchups, or waivers:
- If you have the relevant data, summarize key insights (who's hot, who's trending, matchup edges).
- Provide actual analysis, not just "here are your standings" — tell them what matters.

${FANTASY_BASEBALL_EXPERTISE}

## Current Context
- Sport: Baseball
`

    if (context.originTab) {
      prompt += `- User was viewing: ${context.originTab} (tailor your response to be relevant to what they were looking at)\n`
    }

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

    // Inject league settings (stat categories, roster positions) if available
    if (context.yahooLeagueSettingsContext) {
      prompt += `\n## League Settings (from Yahoo Fantasy)\n`
      prompt += `THIS IS THE USER'S ACTUAL LEAGUE CONFIGURATION. Use this to answer questions about league stats, scoring, roster positions, etc.\n\n`
      prompt += context.yahooLeagueSettingsContext
      prompt += `\n`
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

    if (context.archetypeContext) {
      prompt += `\n## User's Current Request — Stat Archetype\n`
      prompt += context.archetypeContext
      prompt += `\nGive concrete player recommendations that fit this archetype. Name specific players and cite their relevant stats.\n`
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

IMPORTANT RULES:
- Be flexible with user intent. Don't require exact phrases.
- When roster data is available, ALWAYS reference it in your analysis.
- For trade questions, evaluate using replacement level, positional scarcity, and category need.
- NEVER respond with a generic capabilities menu or a list of things the user "can ask about". Always try to answer the actual question.
- If the user asks about league stats/categories/settings, look at the League Settings section above.
- Answer conversationally — you're a knowledgeable friend, not a robotic menu system.
- When the user asks for a type of player ("power hitter", "speed guy", "closer"), give real player recommendations with stats, not a definition.`

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

    // Structured function calling only for actions that need extracted parameters.
    // Simple actions (lineup, teams, matchup, waivers) are handled via extractAction
    // so the model can respond naturally with real analysis instead of canned strings.
    const functions = [
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

        return {
          message: responseText || 'On it — give me a sec to pull that together.',
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

  private processWithRules(userMessage: string, context: AIContext): AIResponse {
    const lowerMessage = userMessage.toLowerCase()

    // ── Archetype query — checked early so "power hitter" doesn't fall through ──
    const archetype = detectArchetype(userMessage)
    if (archetype) {
      const { label, description } = archetype.archetype
      return {
        message: `You're looking for ${label.toLowerCase()} — ${description}. Connect your Yahoo account so I can recommend specific players from your league's available pool, or ask me about any player and I'll tell you if they fit.`,
      }
    }

    // League creation
    if (lowerMessage.includes('create') && lowerMessage.includes('league')) {
      return this.handleLeagueCreation(userMessage, context)
    }

    // League settings / stat categories
    if (this.isLeagueSettingsQuestion(lowerMessage)) {
      return this.handleLeagueSettings(userMessage, context)
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

    // Draft help — "pick" alone is too broad ("pick up" = waivers, not draft)
    if (lowerMessage.includes('draft') || (lowerMessage.includes('pick') && !lowerMessage.includes('pick up'))) {
      return this.handleDraftHelp(userMessage, context)
    }

    // Add/drop / waivers — includes "pick up"
    if (lowerMessage.includes('drop') || lowerMessage.includes('add') || lowerMessage.includes('waiver') || lowerMessage.includes('pick up')) {
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
        message: context.league
          ? `Here's where things stand in **${context.league.name}**:`
          : "Pulling up your league standings now.",
        action: { type: 'view_teams' },
      }
    }

    // Context-aware default response instead of canned menu
    return this.buildContextAwareDefault(userMessage, context)
  }

  private isLeagueSettingsQuestion(msg: string): boolean {
    const settingsPatterns = [
      'what stats', 'which stats', 'what categories', 'which categories',
      'stat categories', 'scoring categories', 'league settings', 'league rules',
      'league scoring', 'league categories', 'league stats',
      'what does this league', 'what does my league',
      'how is scoring', 'how does scoring', 'how is this league scored',
      'what counts', 'stats count', 'stats matter', 'stats are tracked',
      'stats are scored', 'what are the categories', 'what are the stats',
      'roster positions', 'roster slots', 'what positions',
      'league format', 'league setup', 'league config',
      'how many roster', 'how many bench', 'how many il',
      'trade deadline', 'waiver rules', 'playoff format',
      'settings', 'categories', 'scoring',
    ]
    return settingsPatterns.some(p => msg.includes(p))
  }

  private handleLeagueSettings(_message: string, context: AIContext): AIResponse {
    if (context.yahooLeagueSettingsContext) {
      return {
        message: `Here's what your league is tracking:\n\n${context.yahooLeagueSettingsContext}`,
      }
    }

    if (context.league) {
      return {
        message: `Your league **${context.league.name}** is a ${context.league.numTeams}-team **${context.league.scoringType}** league. Connect your Yahoo account and I can show you the full breakdown of scoring categories.`,
      }
    }

    return {
      message: "I don't have your league data loaded yet — connect your Yahoo Fantasy account and I'll be able to tell you exactly which stats and categories your league uses.",
    }
  }

  private buildContextAwareDefault(userMessage: string, context: AIContext): AIResponse {
    if (context.yahooRosterContext || context.yahooLeagueSettingsContext) {
      return {
        message: "Hmm, I'm not quite sure what you're after there. Could you give me a bit more to work with — are you looking for a player recommendation, lineup help, or something about your matchup?",
      }
    }
    if (context.hasYahooConnection) {
      return {
        message: "I'm having a little trouble pulling your league data right now, but I can still talk strategy, player analysis, or draft advice. What's on your mind?",
      }
    }
    return {
      message: "Hey! I'm your fantasy baseball copilot. Connect your Yahoo Fantasy account and I can give you personalized advice on your roster, matchups, and trades. In the meantime, ask me anything about fantasy baseball strategy or player evaluations.",
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
    const lowerMsg = message.toLowerCase()
    const isSet = lowerMsg.includes('set') || lowerMsg.includes('optimize') || lowerMsg.includes('optimal') || lowerMsg.includes('best')
    const actionType = isSet ? 'set_lineup' : 'show_lineup'

    if (context.yahooRosterContext) {
      const msg = isSet
        ? "Alright, I've optimized your lineup based on today's matchups and your league format. Here's what I'm rolling with:"
        : "Here's your current roster — let me know if you want me to shuffle anything around."
      return {
        message: msg,
        action: { type: actionType, data: { teamId: context.teamId } },
      }
    }

    if (!context.roster && !context.hasYahooConnection) {
      return {
        message: "I'd need to see your roster first to help with lineups. Hook up your Yahoo Fantasy account and I'll be able to pull your team in.",
      }
    }

    if (!context.roster) {
      return {
        message: "Having a little trouble grabbing your roster right now — pulling it up.",
        action: { type: 'show_lineup', data: { teamId: context.teamId } },
      }
    }

    const msg = isSet
      ? "Done — I've set your lineup to what I think gives you the best shot this week."
      : "Here's your lineup. Want me to optimize it for you?"
    return {
      message: msg,
      action: { type: actionType, data: { teamId: context.teamId } },
    }
  }

  private handleDraftHelp(message: string, context: AIContext): AIResponse {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('sp') || lowerMessage.includes('starting pitcher') || lowerMessage.includes('pitcher')) {
      return {
        message: "Good call focusing on pitching — aces are tough to replace. Let me pull up the top arms available.",
        action: { type: 'draft_pick' },
      }
    }

    if (lowerMessage.includes('hitter') || lowerMessage.includes('batter') || lowerMessage.includes('position player')) {
      return {
        message: "Let's find you some bats. I'll pull up the best hitters still on the board.",
        action: { type: 'draft_pick' },
      }
    }

    return {
      message: "Let's figure out your best pick. What does your roster need most right now — pitching, hitting, or a specific category?",
      action: { type: 'draft_pick' },
    }
  }

  private handleAddDrop(message: string, context: AIContext): AIResponse {
    const lowerMessage = message.toLowerCase()

    const dropMatch = lowerMessage.match(/drop\s+([^for]+?)(?:\s+for|\s*$)/i)
    const addMatch = lowerMessage.match(/(?:add|pick\s+up|get)\s+([^?]+?)(?:\s*\?|$)/i) ||
                     lowerMessage.match(/for\s+([^?]+?)(?:\s*\?|$)/i)

    if (dropMatch && addMatch) {
      return {
        message: `Dropping ${dropMatch[1].trim()} for ${addMatch[1].trim()} — let me check how that shakes out for your roster.`,
        action: {
          type: 'add_player',
          data: { dropPlayer: dropMatch[1].trim(), addPlayer: addMatch[1].trim() },
        },
      }
    }

    if (lowerMessage.includes('waiver') || lowerMessage.includes('available')) {
      return {
        message: "Let's see who's out there. Pulling up the best available players for you.",
        action: { type: 'add_player' },
      }
    }

    return {
      message: "Let's scan the wire and see who could help your team. Pulling up available players now.",
      action: { type: 'add_player' },
    }
  }

  private handleTrade(message: string, context: AIContext): AIResponse {
    const lowerMessage = message.toLowerCase()

    const tradeMatch = lowerMessage.match(/(?:trade|give)\s+([^for]+?)\s+for\s+([^?]+?)(?:\s*\?|$)/i)

    if (tradeMatch) {
      const player1 = tradeMatch[1].trim()
      const player2 = tradeMatch[2].trim()
      return {
        message: `${player1} for ${player2} — interesting. Let me break down the value on both sides and how it fits your roster.`,
        action: {
          type: 'propose_trade',
          data: { player1, player2 },
        },
      }
    }

    if (lowerMessage.includes('fair') || lowerMessage.includes('evaluate')) {
      return {
        message: "Sure, walk me through the trade and I'll tell you who's getting the better end of it.",
        action: { type: 'propose_trade' },
      }
    }

    return {
      message: "I'm always down to talk trades. What's the deal — who's involved?",
    }
  }

  /**
   * Stream the AI response as an async generator of text chunks.
   * Falls back to the non-streaming path if OpenAI is not configured.
   */
  async *streamMessage(
    userMessage: string,
    context: AIContext,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): AsyncGenerator<string, AIResponse['action'] | undefined, unknown> {
    const systemPrompt = this.buildSystemPrompt(context)

    if (!this.openaiApiKey) {
      // No streaming for rule-based fallback — yield the full message
      const result = this.processWithRules(userMessage, context)
      yield result.message
      return result.action
    }

    try {
      const openai = await this.getOpenAIClient()

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory.slice(-10),
        { role: 'user' as const, content: userMessage },
      ]

      const stream = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.6,
        max_tokens: 1500,
        stream: true,
      })

      let fullText = ''
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          yield delta
        }
      }

      // Extract action from the completed text
      const action = this.extractAction(userMessage, fullText, context)
      return action
    } catch (error) {
      console.error('Streaming error, falling back to rules:', error)
      const result = this.processWithRules(userMessage, context)
      yield result.message
      return result.action
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

    // Waivers
    if (
      lowerMessage.includes('waiver') ||
      lowerMessage.includes('free agent') ||
      lowerMessage.includes('who should i pick up') ||
      lowerMessage.includes('available players')
    ) {
      return { type: 'show_waivers' }
    }

    return undefined
  }
}

export const fantasyAI = new FantasyAI()
