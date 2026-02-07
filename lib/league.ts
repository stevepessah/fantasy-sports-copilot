// League management and business logic

import { League, Team, Roster, Player } from '@/types'
import { leagueDB, teamDB, rosterDB, playerDB } from '@/lib/db'
import { getLineupSlots, getPositionGroup } from '@/lib/sports'

export interface LineupSlot {
  position: string
  playerId?: string
  isLocked: boolean
}

export interface OptimalLineupResult {
  starters: { position: string; playerId: string; projectedPoints: number }[]
  bench: { playerId: string; projectedPoints: number }[]
  totalProjected: number
  explanation: string
}

export class LeagueManager {
  static getLineupSlots(league: League): LineupSlot[] {
    const positions = getLineupSlots(league.sport)
    return positions.map((pos) => ({
      position: pos,
      isLocked: false,
    }))
  }

  static optimizeLineup(
    teamId: string,
    league: League
  ): OptimalLineupResult {
    const roster = rosterDB.get(teamId)
    if (!roster) {
      throw new Error('Roster not found')
    }

    // Get player details - filter by sport
    const players = roster.players
      .map((rp) => {
        const player = playerDB.get(rp.playerId)
        if (!player || player.sport !== league.sport) return null
        return {
          ...player,
          slot: rp.slot,
          isStarter: rp.isStarter,
        }
      })
      .filter((p): p is Player & { slot: string | undefined; isStarter: boolean } => p !== null)

    // Filter out injured/out players
    const healthyPlayers = players.filter(
      (p) => p.injuryStatus !== 'out' && p.injuryStatus !== 'IL'
    )

    // Sort by projected points
    const sorted = [...healthyPlayers].sort(
      (a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0)
    )

    const slots = this.getLineupSlots(league)
    const starters: { position: string; playerId: string; projectedPoints: number }[] = []
    const bench: { playerId: string; projectedPoints: number }[] = []
    const used = new Set<string>()
    const positionGroups = getPositionGroup(league.sport)

    // Fill position-specific slots first
    for (const slot of slots) {
      // Skip flex/util slots for now
      if (slot.position === 'FLEX' || slot.position === 'UTIL') continue

      // Extract base position (RB1 -> RB, OF1 -> OF)
      const basePosition = slot.position.replace(/\d+/, '')
      const validPositions = positionGroups[basePosition] || [basePosition]

      const available = sorted.filter(
        (p) =>
          !used.has(p.id) &&
          validPositions.includes(p.position) &&
          p.injuryStatus !== 'out' &&
          p.injuryStatus !== 'IL'
      )

      if (available.length > 0) {
        const player = available[0]
        starters.push({
          position: slot.position,
          playerId: player.id,
          projectedPoints: player.projectedPoints || 0,
        })
        used.add(player.id)
      }
    }

    // Fill FLEX/UTIL slots
    if (league.sport === 'football') {
      const flexCandidates = sorted.filter(
        (p) =>
          !used.has(p.id) &&
          ['RB', 'WR', 'TE'].includes(p.position) &&
          p.injuryStatus !== 'out'
      )

      if (flexCandidates.length > 0) {
        const flexPlayer = flexCandidates[0]
        starters.push({
          position: 'FLEX',
          playerId: flexPlayer.id,
          projectedPoints: flexPlayer.projectedPoints || 0,
        })
        used.add(flexPlayer.id)
      }
    } else {
      // Baseball UTIL
      const utilCandidates = sorted.filter(
        (p) =>
          !used.has(p.id) &&
          ['C', '1B', '2B', '3B', 'SS', 'OF'].includes(p.position) &&
          p.injuryStatus !== 'out' &&
          p.injuryStatus !== 'IL'
      )

      if (utilCandidates.length > 0) {
        const utilPlayer = utilCandidates[0]
        starters.push({
          position: 'UTIL',
          playerId: utilPlayer.id,
          projectedPoints: utilPlayer.projectedPoints || 0,
        })
        used.add(utilPlayer.id)
      }
    }

    // Remaining players go to bench
    sorted.forEach((p) => {
      if (!used.has(p.id)) {
        bench.push({
          playerId: p.id,
          projectedPoints: p.projectedPoints || 0,
        })
      }
    })

    const totalProjected = starters.reduce(
      (sum, s) => sum + s.projectedPoints,
      0
    )

    const sportName = league.sport === 'football' ? 'football' : 'baseball'
    const explanation = `Set your optimal ${sportName} lineup with ${totalProjected.toFixed(1)} projected points. Key decisions: ${starters.length} starters selected based on matchups and projections.`

    return {
      starters,
      bench,
      totalProjected,
      explanation,
    }
  }

  static setLineup(teamId: string, league: League): Roster {
    const optimal = this.optimizeLineup(teamId, league)
    const roster = rosterDB.get(teamId)
    if (!roster) {
      throw new Error('Roster not found')
    }

    // Update roster with optimal lineup
    const updatedPlayers = roster.players.map((rp) => {
      const starter = optimal.starters.find((s) => s.playerId === rp.playerId)
      return {
        ...rp,
        isStarter: !!starter,
        slot: starter?.position || 'BN',
      }
    })

    const updatedRoster: Roster = {
      ...roster,
      players: updatedPlayers,
    }

    rosterDB.update(teamId, updatedRoster)
    return updatedRoster
  }
}
