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
}

export class FantasyAI {
  private openaiApiKey: string

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || ''
  }

  async processMessage(
    userMessage: string,
    context: AIContext,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> {
    // For MVP, we'll use a rule-based system with OpenAI for natural language
    // In production, this would be more sophisticated

    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      // If OpenAI key is available, use it for natural language processing
      if (this.openaiApiKey) {
        return await this.processWithOpenAI(userMessage, systemPrompt, conversationHistory, context)
      } else {
        // Fallback to rule-based system
        return this.processWithRules(userMessage, context)
      }
    } catch (error) {
      console.error('AI processing error:', error)
      return this.processWithRules(userMessage, context)
    }
  }

  private buildSystemPrompt(context: AIContext): string {
    const sport = context.sport || 'baseball'
    
    let prompt = `You are Fantasy Baseball Copilot, an AI assistant for fantasy baseball. 
You help users manage their fantasy teams through natural conversation.

Core principles:
- Be conversational, helpful, and explain your reasoning
- Always explain WHY you're recommending something
- Use plain English, not fantasy jargon unless the user does
- Be proactive about potential issues (injuries, schedule, matchups)
- When suggesting actions, explain the impact
- Remember you're helping with baseball
- Understand user intent even when phrased differently - be flexible with language
- If a user asks about "teams", "standings", "who's in my league", etc., they want to see all teams
- If a user asks "who should I start", "set my lineup", "best lineup", they want lineup optimization
- If a user asks about "matchup", "opponent", "who am I playing", they want matchup info

Current context:
- Sport: baseball
`

    if (context.league) {
      prompt += `- League: ${context.league.name} (${context.league.numTeams} teams, ${context.league.scoringType} scoring)\n`
      prompt += `- Status: ${context.league.status}\n`
    }

    if (context.team) {
      prompt += `- Your team: ${context.team.name} (${context.team.wins}-${context.team.losses})\n`
    }

    if (context.week) {
      prompt += `- Current week: ${context.week}\n`
    }

    prompt += `
Available actions and their conversational variations:
- View teams/standings: 
  * "show teams", "show all teams", "view teams", "list teams", "who's in my league", 
    "what teams are in my league", "show standings", "league standings", "standings"
- Set lineup: 
  * "set my lineup", "set optimal lineup", "who should I start", "best lineup", 
    "optimize lineup", "set my best lineup"
- View lineup: 
  * "show my lineup", "view lineup", "current lineup", "my lineup"
- Matchup: 
  * "show matchup", "my matchup", "who am I playing", "who am I facing", "opponent"
- Waivers: 
  * "waiver wire", "who should I pick up", "free agents", "available players"
- Add/drop: 
  * "drop Player X for Player Y", "add Player X", "pick up Player X"
- Draft help: 
  * "who should I draft", "draft advice", "best SP available"
- Trade evaluation: 
  * "is this trade fair", "evaluate trade", "suggest a trade"
- Create league: 
  * "create a 12-team roto league"
- General questions: Answer about fantasy baseball strategy, players, matchups

IMPORTANT: Understand user intent from natural language. Don't require exact phrases. 
If someone says "show teams" or "what teams are in my league" or "standings", they want to see all teams.
If someone says "who should I start" or "set my lineup", they want lineup help.
Be flexible and conversational!`

    prompt += `\n\nAlways respond in a friendly, conversational tone. Explain your reasoning clearly.`

    return prompt
  }

  private async processWithOpenAI(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: AIContext
  ): Promise<AIResponse> {
    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: this.openaiApiKey })

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user' as const, content: userMessage },
    ]

    // Define functions for structured actions
    const functions = [
      {
        name: 'view_teams',
        description: 'Show all teams in the league with standings',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_lineup',
        description: 'Set or optimize the user\'s lineup',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'show_lineup',
        description: 'Show the user\'s current lineup',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'show_matchup',
        description: 'Show the user\'s current matchup/opponent',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'show_waivers',
        description: 'Show available players on waivers or free agents',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    ]

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        functions,
        function_call: 'auto', // Let the model decide when to call functions
        temperature: 0.7,
        max_tokens: 1000,
      })

      const responseMessage = completion.choices[0]?.message
      const responseText = responseMessage?.content || ''

      // Check if the model wants to call a function
      if (responseMessage?.function_call) {
        const functionName = responseMessage.function_call.name
        const action = this.mapFunctionToAction(functionName, context)
        
        // Generate a natural language response based on the function call
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
      // Fallback to rule-based
      return this.processWithRules(userMessage, context)
    }
  }

  private mapFunctionToAction(functionName: string, context: AIContext): AIResponse['action'] {
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
        return {
          type: 'show_waivers',
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
