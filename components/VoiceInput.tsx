'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { hapticTap } from '@/lib/haptics'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
}

export default function VoiceInput({ onTranscript, disabled, className = '' }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SpeechRecognition)
  }, [])

  const toggleListening = useCallback(() => {
    if (!supported) return

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    hapticTap()

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onTranscript(transcript)
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, supported, onTranscript])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`relative p-2.5 sm:p-3 rounded-xl transition-colors shrink-0 ${
        isListening
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white'
      } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      aria-label={isListening ? 'Stop listening' : 'Voice input'}
      title={isListening ? 'Listening… tap to stop' : 'Voice input'}
    >
      {/* Pulsing ring when listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-xl animate-ping bg-red-600/30 pointer-events-none" />
      )}
      <svg className="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
        />
      </svg>
    </button>
  )
}
