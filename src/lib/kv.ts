import { kv } from '@vercel/kv'

export type CountdownData = {
  id: string
  title: string
  targetDate: string
  description?: string
  color: string
  icon?: string
  notify: boolean
  completed: boolean
  soundId?: string
  loopSound: boolean
  volume: number
  createdAt: string
  updatedAt: string
}

// Get countdowns for a user (by email)
export async function getCountdowns(userEmail: string): Promise<CountdownData[]> {
  const countdowns = await kv.get<CountdownData[]>(`user:${userEmail}:countdowns`)
  return countdowns || []
}

// Add a countdown for a user
export async function addCountdown(userEmail: string, countdown: CountdownData): Promise<void> {
  const countdowns = await getCountdowns(userEmail)
  countdowns.push(countdown)
  await kv.set(`user:${userEmail}:countdowns`, countdowns)
}

// Update a countdown for a user
export async function updateCountdown(
  userEmail: string,
  countdownId: string,
  updates: Partial<CountdownData>
): Promise<boolean> {
  const countdowns = await getCountdowns(userEmail)
  const index = countdowns.findIndex(c => c.id === countdownId)

  if (index === -1) return false

  countdowns[index] = {
    ...countdowns[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await kv.set(`user:${userEmail}:countdowns`, countdowns)
  return true
}

// Delete a countdown for a user
export async function deleteCountdown(userEmail: string, countdownId: string): Promise<boolean> {
  const countdowns = await getCountdowns(userEmail)
  const index = countdowns.findIndex(c => c.id === countdownId)

  if (index === -1) return false

  countdowns.splice(index, 1)
  await kv.set(`user:${userEmail}:countdowns`, countdowns)
  return true
}
