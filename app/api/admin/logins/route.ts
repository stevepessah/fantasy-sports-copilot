import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getLogins } from '@/lib/loginLog'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('yahoo_access_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const logins = getLogins()

  return NextResponse.json(
    {
      total: logins.length,
      logins,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
