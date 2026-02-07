// Load MLB players from CSV file
import { readFileSync } from 'fs'
import { join } from 'path'
import { Player, BaseballPosition } from '@/types'

// Map CSV positions to app positions
function normalizePosition(csvPosition: string): BaseballPosition {
  const pos = csvPosition.trim().toUpperCase()
  
  // Direct matches
  if (['C', '1B', '2B', '3B', 'SS'].includes(pos)) {
    return pos as BaseballPosition
  }
  
  // Outfield positions -> OF
  if (['CF', 'RF', 'LF', 'OF'].includes(pos)) {
    return 'OF'
  }
  
  // Pitcher positions -> SP (default, could be enhanced to distinguish SP vs RP)
  if (['P', 'TWP'].includes(pos)) {
    return 'SP'
  }
  
  // Designated hitter -> UTIL
  if (pos === 'DH') {
    return 'UTIL'
  }
  
  // Default to SP for unknown positions
  return 'SP'
}

// Generate a unique ID from player name
function generatePlayerId(name: string, index: number): string {
  // Create a simple ID from name (lowercase, no spaces/special chars) + index for uniqueness
  const baseId = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20)
  return `mlb_${baseId}_${index}`
}

export function loadMLBPlayersFromCSV(): Player[] {
  try {
    const csvPath = join(process.cwd(), 'mlb_players.csv')
    const csvContent = readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())
    
    // Skip header
    const dataLines = lines.slice(1)
    
    const players: Player[] = []
    
    dataLines.forEach((line, index) => {
      // Parse CSV line (handle quoted names with commas)
      // Split by comma, but respect quoted fields
      const parts: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      parts.push(current.trim()) // Add last part
      
      if (parts.length < 2) return
      
      const name = parts[0].replace(/^"|"$/g, '').trim()
      const position = parts[1].replace(/^"|"$/g, '').trim()
      
      if (!name || !position || name === 'name' || position === 'position') return
      
      const normalizedPosition = normalizePosition(position)
      
      // Create player object
      const player: Player = {
        id: generatePlayerId(name, index),
        name: name,
        sport: 'baseball',
        position: normalizedPosition,
        team: 'FA', // Free Agent - teams can be added later if needed
        // Set default projected points based on position
        projectedPoints: getDefaultProjectedPoints(normalizedPosition),
      }
      
      // Add position-specific projected stats
      if (normalizedPosition === 'SP' || normalizedPosition === 'RP') {
        player.projectedStats = {
          wins: normalizedPosition === 'SP' ? 12 : 0,
          era: normalizedPosition === 'SP' ? 3.5 : 3.0,
          whip: normalizedPosition === 'SP' ? 1.15 : 1.10,
          strikeouts: normalizedPosition === 'SP' ? 180 : 70,
          saves: normalizedPosition === 'RP' ? 25 : 0,
        }
      } else {
        player.projectedStats = {
          avg: 0.265,
          hr: 20,
          rbi: 70,
          runs: 75,
          sb: 10,
        }
      }
      
      players.push(player)
    })
    
    return players
  } catch (error) {
    console.error('Error loading MLB players from CSV:', error)
    return []
  }
}

function getDefaultProjectedPoints(position: BaseballPosition): number {
  // Default projected points by position (can be enhanced with real projections)
  const defaults: Record<BaseballPosition, number> = {
    C: 10.0,
    '1B': 12.0,
    '2B': 11.0,
    '3B': 12.5,
    SS: 12.0,
    OF: 13.0,
    SP: 15.0,
    RP: 12.0,
    UTIL: 11.0,
  }
  return defaults[position] || 10.0
}
