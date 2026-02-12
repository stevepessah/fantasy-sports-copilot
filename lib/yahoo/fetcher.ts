/**
 * Shared SWR fetcher — plain JSON fetch with error handling.
 */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)

  if (!res.ok) {
    const info = await res.json().catch(() => ({}))
    const error: any = new Error(info.error || `Request failed: ${res.status}`)
    error.status = res.status
    error.info = info
    throw error
  }

  return res.json()
}
