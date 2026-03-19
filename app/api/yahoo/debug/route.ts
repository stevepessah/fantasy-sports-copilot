// Debug endpoint to check Yahoo OAuth configuration (development only)
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const consumerKey = process.env.YAHOO_CONSUMER_KEY
  const consumerSecret = process.env.YAHOO_CONSUMER_SECRET
  const callbackUrl = process.env.YAHOO_CALLBACK_URL

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    hasConsumerKey: !!consumerKey,
    hasConsumerSecret: !!consumerSecret,
    callbackUrl: callbackUrl || 'NOT SET',
  })
}
