// Debug endpoint to check Yahoo OAuth configuration (development / preview only)
import { NextRequest, NextResponse } from 'next/server'
import { getYahooRedirectUri } from '@/lib/yahoo/oauth2'
import { isNonProdEnvironment } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isNonProdEnvironment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const consumerKey = process.env.YAHOO_CONSUMER_KEY
  const consumerSecret = process.env.YAHOO_CONSUMER_SECRET
  const callbackUrl = process.env.YAHOO_CALLBACK_URL

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || null,
    hasConsumerKey: !!consumerKey,
    hasConsumerSecret: !!consumerSecret,
    callbackUrlOverride: callbackUrl || 'NOT SET',
    // The exact redirect_uri this deployment will send to Yahoo. Register this
    // value in the Yahoo Developer app to complete real login on this URL.
    resolvedRedirectUri: getYahooRedirectUri(request),
  })
}
