// Debug endpoint to check Yahoo OAuth configuration
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const consumerKey = process.env.YAHOO_CONSUMER_KEY
  const consumerSecret = process.env.YAHOO_CONSUMER_SECRET
  const callbackUrl = process.env.YAHOO_CALLBACK_URL

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    hasConsumerKey: !!consumerKey,
    consumerKeyPrefix: consumerKey ? `${consumerKey.substring(0, 10)}...` : 'MISSING',
    hasConsumerSecret: !!consumerSecret,
    consumerSecretPrefix: consumerSecret ? `${consumerSecret.substring(0, 10)}...` : 'MISSING',
    callbackUrl: callbackUrl || 'NOT SET',
    allEnvVars: {
      YAHOO_CONSUMER_KEY: consumerKey ? 'SET' : 'MISSING',
      YAHOO_CONSUMER_SECRET: consumerSecret ? 'SET' : 'MISSING',
      YAHOO_CALLBACK_URL: callbackUrl || 'NOT SET',
    },
  })
}
