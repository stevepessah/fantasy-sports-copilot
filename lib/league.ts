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
      // Skip flex/util/pitcher/il/na/bench slots for now - handle separately
      const basePosition = slot.position.replace(/\d+/, '')
      if (['FLEX', 'UTIL', 'P', 'IL', 'NA', 'BN'].includes(basePosition)) continue

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
      // Baseball UTIL slots (UTIL1, UTIL2)
      const utilSlots = slots.filter(s => s.position.startsWith('UTIL'))
      for (const utilSlot of utilSlots) {
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
            position: utilSlot.position,
            playerId: utilPlayer.id,
            projectedPoints: utilPlayer.projectedPoints || 0,
          })
          used.add(utilPlayer.id)
        }
      }

      // Fill All Pitcher slots (P1, P2, P3, P4) - can be SP or RP
      const pitcherSlots = slots.filter(s => s.position.startsWith('P') && s.position !== 'RP1' && s.position !== 'RP2' && s.position !== 'SP1' && s.position !== 'SP2')
      for (const pitcherSlot of pitcherSlots) {
        const pitcherCandidates = sorted.filter(
          (p) =>
            !used.has(p.id) &&
            ['SP', 'RP'].includes(p.position) &&
            p.injuryStatus !== 'out' &&
            p.injuryStatus !== 'IL'
        )

        if (pitcherCandidates.length > 0) {
          const pitcher = pitcherCandidates[0]
          starters.push({
            position: pitcherSlot.position,
            playerId: pitcher.id,
            projectedPoints: pitcher.projectedPoints || 0,
          })
          used.add(pitcher.id)
        }
      }
    }

    // Handle IL, NA, and Bench slots for baseball
    if (league.sport === 'baseball') {
      // IL slots - for injured players
      const ilSlots = slots.filter(s => s.position.startsWith('IL'))
      const ilPlayers = sorted.filter(p => p.injuryStatus === 'IL' || p.injuryStatus === 'out')
      for (let i = 0; i < Math.min(ilSlots.length, ilPlayers.length); i++) {
        if (!used.has(ilPlayers[i].id)) {
          starters.push({
            position: ilSlots[i].position,
            playerId: ilPlayers[i].id,
            projectedPoints: 0, // IL players don't score
          })
          used.add(ilPlayers[i].id)
        }
      }

      // NA slot - for not active players
      const naSlot = slots.find(s => s.position === 'NA')
      if (naSlot) {
        const naCandidates = sorted.filter(
          (p) => !used.has(p.id) && p.injuryStatus === 'out'
        )
        if (naCandidates.length > 0) {
          starters.push({
            position: 'NA',
            playerId: naCandidates[0].id,
            projectedPoints: 0,
          })
          used.add(naCandidates[0].id)
        }
      }

      // Bench slots
      const benchSlots = slots.filter(s => s.position.startsWith('BN'))
      const benchCandidates = sorted.filter(p => !used.has(p.id))
      for (let i = 0; i < Math.min(benchSlots.length, benchCandidates.length); i++) {
        bench.push({
          playerId: benchCandidates[i].id,
          projectedPoints: benchCandidates[i].projectedPoints || 0,
        })
        used.add(benchCandidates[i].id)
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
