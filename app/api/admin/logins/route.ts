import { NextResponse } from 'next/server'
import { getLogins } from '@/lib/loginLog'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logins = getLogins()

  return NextResponse.json(
    {
      total: logins.length,
      logins,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
