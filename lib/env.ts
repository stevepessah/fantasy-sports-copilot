import { z } from 'zod'

const envSchema = z.object({
  YAHOO_CONSUMER_KEY: z.string().min(1),
  YAHOO_CONSUMER_SECRET: z.string().min(1),
  YAHOO_CALLBACK_URL: z.string().default('http://localhost:3000/api/yahoo/callback'),
  OPENAI_API_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

let _result: { success: true; data: Env } | { success: false; errors: string[] } | null = null

export function validateEnv() {
  if (_result) return _result

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    )
    console.warn('[env] Missing or invalid environment variables:')
    errors.forEach((e) => console.warn(`  - ${e}`))
    _result = { success: false, errors }
    return _result
  }

  _result = { success: true, data: parsed.data }
  return _result
}

export function hasYahooConfig(): boolean {
  return !!(process.env.YAHOO_CONSUMER_KEY && process.env.YAHOO_CONSUMER_SECRET)
}

export function hasOpenAIConfig(): boolean {
  return !!process.env.OPENAI_API_KEY
}
