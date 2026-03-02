// Simple in-memory storage for countdown sync
// Data persists while the server is running

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

// Global storage - persists across requests
declare global {
  var countdownStore: Map<string, CountdownData[]> | undefined
}

// Initialize global store if not exists
function getStore(): Map<string, CountdownData[]> {
  if (!global.countdownStore) {
    global.countdownStore = new Map<string, CountdownData[]>()
  }
  return global.countdownStore
}

// Generate a unique sync code
export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Get countdowns for a sync code
export async function getCountdowns(syncCode: string): Promise<CountdownData[]> {
  const store = getStore()
  const normalizedCode = syncCode.toUpperCase()
  return store.get(normalizedCode) || []
}

// Save countdowns for a sync code
async function saveCountdowns(syncCode: string, countdowns: CountdownData[]): Promise<void> {
  const store = getStore()
  store.set(syncCode.toUpperCase(), countdowns)
}

// Create a new sync group and return its code
export async function createSyncGroup(): Promise<string> {
  let code = generateSyncCode()
  const store = getStore()

  // Ensure unique code
  while (store.has(code)) {
    code = generateSyncCode()
  }

  // Initialize with empty array
  store.set(code, [])
  return code
}

// Add a countdown
export async function addCountdown(syncCode: string, countdown: CountdownData): Promise<void> {
  const countdowns = await getCountdowns(syncCode)
  countdowns.push(countdown)
  await saveCountdowns(syncCode, countdowns)
}

// Update a countdown
export async function updateCountdown(
  syncCode: string,
  countdownId: string,
  updates: Partial<CountdownData>
): Promise<boolean> {
  const countdowns = await getCountdowns(syncCode)
  const index = countdowns.findIndex(c => c.id === countdownId)

  if (index === -1) return false

  countdowns[index] = {
    ...countdowns[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await saveCountdowns(syncCode, countdowns)
  return true
}

// Delete a countdown
export async function deleteCountdown(syncCode: string, countdownId: string): Promise<boolean> {
  const countdowns = await getCountdowns(syncCode)
  const index = countdowns.findIndex(c => c.id === countdownId)

  if (index === -1) return false

  countdowns.splice(index, 1)
  await saveCountdowns(syncCode, countdowns)
  return true
}
