'use client'

import { useState, useEffect } from 'react'
import { useYahooAuth } from '@/contexts/YahooAuthContext'

const ONBOARDING_KEY = 'fbc_onboarding_complete'

interface OnboardingProps {
  onComplete: () => void
  onRunCommand: (command: string) => void
}

export function useOnboarding() {
  const [complete, setComplete] = useState(true) // assume complete until checked

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_KEY)
      setComplete(stored === 'true')
    } catch {
      setComplete(true) // default to not showing if localStorage fails
    }
  }, [])

  const markComplete = () => {
    setComplete(true)
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true')
    } catch {
      // silent
    }
  }

  const reset = () => {
    setComplete(false)
    try {
      localStorage.removeItem(ONBOARDING_KEY)
    } catch {
      // silent
    }
  }

  return { isOnboardingComplete: complete, markComplete, resetOnboarding: reset }
}

export default function Onboarding({ onComplete, onRunCommand }: OnboardingProps) {
  const { isAuthenticated } = useYahooAuth()
  const [step, setStep] = useState(0)

  // Auto-advance to step 2 when Yahoo connects
  useEffect(() => {
    if (isAuthenticated && step === 0) {
      setStep(1)
    }
  }, [isAuthenticated, step])

  const steps = [
    // Step 0: Connect Yahoo
    {
      icon: '🔗',
      title: 'Connect Your Yahoo Account',
      subtitle: 'Link your Yahoo Fantasy league to get personalized AI advice based on your actual roster.',
      content: (
        <div className="space-y-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-600/10 border border-green-600/30">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-green-400 font-medium">Connected to Yahoo Fantasy!</span>
            </div>
          ) : (
            <button
              onClick={() => { window.location.href = '/api/yahoo/auth' }}
              className="w-full px-5 py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl font-semibold transition-colors text-sm"
            >
              Connect Yahoo Fantasy
            </button>
          )}
          <button
            onClick={() => setStep(1)}
            className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {isAuthenticated ? 'Continue →' : 'Skip for now →'}
          </button>
        </div>
      ),
    },
    // Step 1: Discover capabilities
    {
      icon: '🧠',
      title: 'What I Can Do',
      subtitle: 'I analyze your roster, suggest trades, optimize lineups, and give expert draft advice.',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: '📋', label: 'Optimize Lineup' },
              { emoji: '🔄', label: 'Trade Analysis' },
              { emoji: '🔍', label: 'Waiver Targets' },
              { emoji: '📝', label: 'Draft Advice' },
              { emoji: '📊', label: 'Player Stats' },
              { emoji: '⚔️', label: 'Matchup Insights' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm"
              >
                <span>{item.emoji}</span>
                <span className="text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full mt-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors text-sm"
          >
            Continue →
          </button>
        </div>
      ),
    },
    // Step 2: Get started
    {
      icon: '🚀',
      title: "Let's Get Started!",
      subtitle: 'Pick a quick action to see me in action, or type anything in the chat.',
      content: (
        <div className="space-y-3">
          {[
            { label: '📋 Set my optimal lineup', cmd: 'set my optimal lineup' },
            { label: '🔍 Find waiver wire gems', cmd: 'who should I pick up on waivers?' },
            { label: '💬 Just start chatting', cmd: '' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onComplete()
                if (item.cmd) {
                  setTimeout(() => onRunCommand(item.cmd), 300)
                }
              }}
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 transition-colors text-sm text-slate-200"
            >
              {item.label}
            </button>
          ))}
        </div>
      ),
    },
  ]

  const currentStep = steps[step]

  return (
    <div className="max-w-md mx-auto mt-8 sm:mt-16 px-4">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-primary-500' : i < step ? 'w-4 bg-primary-500/50' : 'w-4 bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-4">{currentStep.icon}</div>
        <h2 className="text-xl font-bold text-white mb-2">{currentStep.title}</h2>
        <p className="text-sm text-slate-400">{currentStep.subtitle}</p>
      </div>

      {currentStep.content}

      {/* Skip all */}
      {step < 2 && (
        <button
          onClick={onComplete}
          className="w-full mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors text-center"
        >
          Skip onboarding
        </button>
      )}
    </div>
  )
}
