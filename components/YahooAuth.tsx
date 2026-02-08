'use client'

import { useState, useEffect } from 'react'

export default function YahooAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
      document.cookie = 'yahoo_access_token_secret=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'yahoo_session_handle=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="px-4 py-2 text-sm text-slate-400">
        Checking Yahoo connection...
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      {isAuthenticated ? (
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
