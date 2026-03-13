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
  // League settings context — stat categories, roster positions, etc.
  yahooLeagueSettingsContext?: string
  // Whether the user has Yahoo connected (affects fallback messaging)
  hasYahooConnection?: boolean
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

## CRITICAL RESPONSE RULES
- NEVER give a canned "I'm here to help! You can ask me to:" bullet-point menu. This is lazy and unhelpful.
- NEVER say "Give me a moment..." or "Let me analyze..." and then stop. Actually DO the analysis inline.
- ALWAYS attempt to answer the user's actual question, even if you need to make reasonable assumptions.
- If you have league settings data below, USE IT to answer questions about stats, categories, scoring, etc.
- If you have roster data below, USE IT to give personalized analysis rather than generic advice.
- If you genuinely don't have the data to answer, say specifically what data is missing — don't redirect to a menu.
- Be conversational. Respond naturally to conversational messages. If someone says "hey" or "what's up", respond warmly.
- When the user asks about their league (stats, categories, format, settings), look at the League Settings section below for the actual answer.
- You can and should answer general fantasy baseball knowledge questions directly, without needing league-specific data.

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
- NEVER respond with a generic capabilities menu. Always try to answer the actual question.
- If the user asks about league stats/categories/settings, look at the League Settings section above.
- Answer conversationally — you're a knowledgeable friend, not a robotic menu system.`

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
          message: responseText || 'Let me look into that for you.',
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
        message: context.league
          ? `Here are the current standings for **${context.league.name}**:`
          : "Here are your league standings:",
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
        message: `Here are your league's settings and scoring categories:\n\n${context.yahooLeagueSettingsContext}`,
      }
    }

    if (context.league) {
      return {
        message: `Your league **${context.league.name}** uses **${context.league.scoringType}** scoring with ${context.league.numTeams} teams. Connect your Yahoo account for full scoring category details.`,
      }
    }

    return {
      message: "I'd love to show you your league settings, but I don't have your league data loaded yet. Make sure your Yahoo Fantasy account is connected so I can pull in your league's scoring categories and roster positions.",
    }
  }

  private buildContextAwareDefault(userMessage: string, context: AIContext): AIResponse {
    const parts: string[] = []

    // Try to be helpful based on what we know
    if (context.yahooRosterContext || context.yahooLeagueSettingsContext) {
      parts.push(`I'm not sure I understood that. I have your league data loaded, so feel free to ask me things like:`)
      parts.push('')
      parts.push('- "What stats does my league count?"')
      parts.push('- "Who should I start this week?"')
      parts.push('- "Show my matchup"')
      parts.push('- "Who should I pick up on waivers?"')
      parts.push('- "Compare Player A vs Player B"')
      parts.push('- Or ask about any specific player by name')
    } else if (context.hasYahooConnection) {
      parts.push("I'm having trouble loading your league data right now, but I'm still here to help with general fantasy baseball questions. Try asking again in a moment, or ask me about strategy, player analysis, or draft advice.")
    } else {
      parts.push("I'm your fantasy baseball assistant! Connect your Yahoo Fantasy account to get personalized advice about your team, league settings, and roster moves.")
      parts.push('')
      parts.push("In the meantime, I can help with general fantasy baseball strategy, player evaluations, and draft advice. What would you like to know?")
    }

    return { message: parts.join('\n') }
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
      return {
        message: `Here's your current roster. ${isSet ? 'I\'ve highlighted the optimal starters based on your league format.' : 'Take a look and let me know if you want lineup advice.'}`,
        action: {
          type: actionType,
          data: { teamId: context.teamId },
        },
      }
    }

    if (!context.roster && !context.hasYahooConnection) {
      return {
        message: "I don't see your roster yet. Connect your Yahoo Fantasy account so I can pull in your team and help you set the best lineup.",
      }
    }

    if (!context.roster) {
      return {
        message: "I'm having trouble loading your roster right now. Let me try to pull it up.",
        action: {
          type: 'show_lineup',
          data: { teamId: context.teamId },
        },
      }
    }

    return {
      message: `Here's your lineup. ${isSet ? 'I\'ve set it to the optimal configuration based on matchups and projections.' : 'Let me know if you\'d like me to optimize it.'}`,
      action: {
        type: actionType,
        data: { teamId: context.teamId },
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
