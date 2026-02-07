'use client'

import { useState, useEffect } from 'react'
import { DraftPick, Player, League, Sport } from '@/types'
import SportToggle from './SportToggle'

interface DraftRoomProps {
  leagueId: string
  userId: string
  teamId: string
}

export default function DraftRoom({ leagueId, userId, teamId }: DraftRoomProps) {
  const [picks, setPicks] = useState<DraftPick[]>([])
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [currentPick, setCurrentPick] = useState<number>(1)
  const [isYourTurn, setIsYourTurn] = useState(false)
  const [league, setLeague] = useState<League | null>(null)
  const [draftAssistant, setDraftAssistant] = useState<string>('')
  const [currentSport, setCurrentSport] = useState<Sport>('baseball')

  useEffect(() => {
      loadDraftData()
      // Poll for draft updates
      const interval = setInterval(loadDraftData, 2000)
      return () => clearInterval(interval)
  }, [leagueId, currentSport])

  const loadDraftData = async () => {
    try {
      const sportParam = league?.sport || currentSport
      const [picksRes, playersRes, leagueRes] = await Promise.all([
        fetch(`/api/draft?leagueId=${leagueId}`),
        fetch(`/api/players?sport=${sportParam}`),
        fetch(`/api/leagues?id=${leagueId}`),
      ])

      if (picksRes.ok) {
        const picksData = await picksRes.json()
        setPicks(picksData)
        calculateCurrentPick(picksData)
      }

      if (playersRes.ok) {
        const playersData = await playersRes.json()
        const draftedIds = new Set(picks.map((p: DraftPick) => p.playerId))
        const filtered = playersData.filter((p: Player) => !draftedIds.has(p.id) && p.sport === (league?.sport || currentSport))
        setAvailablePlayers(filtered)
      }

      if (leagueRes.ok) {
        const leagueData = await leagueRes.json()
        setLeague(leagueData)
        if (leagueData.sport) {
          setCurrentSport(leagueData.sport)
        }
      }
    } catch (error) {
      console.error('Error loading draft data:', error)
    }
  }

  const calculateCurrentPick = (allPicks: DraftPick[]) => {
    const totalPicks = (league?.numTeams || 12) * 15 // 15 rounds
    const currentPickNum = allPicks.length + 1

    if (currentPickNum > totalPicks) {
      setCurrentPick(totalPicks)
      setIsYourTurn(false)
      return
    }

    setCurrentPick(currentPickNum)
    // Determine if it's user's turn (simplified - in real app, use draft order)
    setIsYourTurn(currentPickNum % (league?.numTeams || 12) === 1)
  }

  const handleDraftPick = async (playerId: string) => {
    if (!isYourTurn) return

    try {
      const response = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          teamId,
          playerId,
        }),
      })

      if (response.ok) {
        loadDraftData()
        // Get AI explanation
        getDraftExplanation(playerId)
      }
    } catch (error) {
      console.error('Error making draft pick:', error)
    }
  }

  const getDraftExplanation = async (playerId: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Explain why I just drafted player ${playerId}`,
          leagueId,
          userId,
        }),
      })

      const data = await response.json()
      setDraftAssistant(data.message)
    } catch (error) {
      console.error('Error getting draft explanation:', error)
    }
  }

  const askDraftQuestion = async (question: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          leagueId,
          userId,
        }),
      })

      const data = await response.json()
      setDraftAssistant(data.message)
    } catch (error) {
      console.error('Error asking draft question:', error)
    }
  }

  const getTopAvailable = (position: Player['position']) => {
    return availablePlayers
      .filter((p) => p.position === position && p.sport === currentSport)
      .sort((a, b) => (a.adp || 999) - (b.adp || 999))
      .slice(0, 5)
  }

  const getPositionGroups = () => {
    if (currentSport === 'football') {
      return ['QB', 'RB', 'WR', 'TE']
    } else {
      return ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP']
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Draft Room</h1>
          {league && <SportToggle currentSport={league.sport} onSportChange={(s) => {}} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Draft Board */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Draft Board</h2>
              <div className="space-y-2">
                {picks.slice(-10).map((pick) => (
                  <div
                    key={pick.id}
                    className="flex justify-between items-center p-2 bg-slate-700 rounded"
                  >
                    <span className="text-sm">
                      Round {pick.round}, Pick {pick.pick}
                    </span>
                    <span className="font-medium">
                      {availablePlayers.find((p) => p.id === pick.playerId)?.name || 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Players */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Available Players</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availablePlayers
                  .sort((a, b) => (a.adp || 999) - (b.adp || 999))
                  .slice(0, 20)
                  .map((player) => (
                    <div
                      key={player.id}
                      className="flex justify-between items-center p-3 bg-slate-700 rounded hover:bg-slate-600 cursor-pointer"
                      onClick={() => handleDraftPick(player.id)}
                    >
                      <div>
                        <span className="font-medium">{player.name}</span>
                        <span className="text-sm text-slate-400 ml-2">
                          {player.position} - {player.team}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400">ADP: {player.adp || 'N/A'}</span>
                        {player.projectedPoints && (
                          <span className="ml-2 text-primary-400">
                            Proj: {player.projectedPoints.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Draft Assistant Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4">Draft Assistant</h2>

              {isYourTurn && (
                <div className="mb-4 p-3 bg-primary-600 rounded-lg">
                  <p className="font-medium">It's your turn to pick!</p>
                </div>
              )}

              {draftAssistant && (
                <div className="mb-4 p-4 bg-slate-700 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{draftAssistant}</p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                <button
                  onClick={() => askDraftQuestion('Who should I draft?')}
                  className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-left"
                >
                  Who should I draft?
                </button>
                {currentSport === 'football' ? (
                  <>
                    <button
                      onClick={() => askDraftQuestion('Best RB available?')}
                      className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-left"
                    >
                      Best RB available?
                    </button>
                    <button
                      onClick={() => askDraftQuestion('What happens if I wait on QB?')}
                      className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-left"
                    >
                      What if I wait on QB?
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => askDraftQuestion('Best SP available?')}
                      className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-left"
                    >
                      Best SP available?
                    </button>
                    <button
                      onClick={() => askDraftQuestion('Should I draft hitters or pitchers?')}
                      className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-left"
                    >
                      Hitters or pitchers?
                    </button>
                  </>
                )}
              </div>

              {/* Top Available by Position */}
              <div className="space-y-4">
                {getPositionGroups().slice(0, 4).map((pos) => {
                  const topPlayers = getTopAvailable(pos as any)
                  if (topPlayers.length === 0) return null
                  return (
                    <div key={pos}>
                      <h3 className="font-medium mb-2">Top {pos}s</h3>
                      {topPlayers.map((player) => (
                        <div key={player.id} className="text-sm text-slate-400">
                          {player.name} (ADP: {player.adp || 'N/A'})
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
