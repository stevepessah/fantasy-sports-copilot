'use client'

import { useState, useEffect } from 'react'
import { useYahooLeagues } from '@/hooks/useYahooLeagues'
import YahooTeams from './YahooTeams'

export default function YahooAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)
  
  // Fetch leagues when authenticated
  const { leagues, isLoading: leaguesLoading } = useYahooLeagues('mlb')

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/yahoo/status')
      const data = await response.json()
      setIsAuthenticated(data.authenticated)
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = () => {
    // Redirect to Yahoo OAuth
    window.location.href = '/api/yahoo/auth'
  }

  const handleDisconnect = async () => {
    try {
      // Clear cookies (in production, call API to revoke token)
      document.cookie = 'yahoo_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'yahoo_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      setIsAuthenticated(false)
      setSelectedLeague(null)
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  // Auto-select first league if available
  useEffect(() => {
    if (isAuthenticated && leagues.length > 0 && !selectedLeague) {
      // Prefer active leagues (not finished)
      const activeLeague = leagues.find(l => l.is_finished !== '1')
      setSelectedLeague(activeLeague?.league_key || leagues[0].league_key)
    }
  }, [isAuthenticated, leagues, selectedLeague])

  if (isLoading) {
    return (
      <div className="text-sm text-slate-400">
        Checking Yahoo connection...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isAuthenticated ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-300">Connected to Yahoo</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-slate-400 hover:text-slate-300 underline"
            >
              Disconnect
            </button>
          </div>
          
          {leaguesLoading ? (
            <div className="text-xs text-slate-400">Loading leagues...</div>
          ) : leagues.length > 0 ? (
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">Select League:</label>
              <select
                value={selectedLeague || ''}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {leagues.map((league) => (
                  <option key={league.league_key} value={league.league_key}>
                    {league.name} ({league.season} {league.game_code === 'mlb' ? '⚾' : '🏈'})
                    {league.is_finished === '1' ? ' (Finished)' : ''}
                  </option>
                ))}
              </select>
              {selectedLeague && (
                <div className="text-xs text-slate-400 mt-1">
                  {leagues.find(l => l.league_key === selectedLeague)?.num_teams} teams
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">No leagues found</div>
          )}
          
          {/* Show teams and rosters when a league is selected */}
          {selectedLeague && (
            <div className="border-t border-slate-700 pt-3 mt-3">
              <YahooTeams leagueKey={selectedLeague} />
            </div>
          )}
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors text-sm"
        >
          Connect Yahoo Fantasy League
        </button>
      )}
    </div>
  )
}
