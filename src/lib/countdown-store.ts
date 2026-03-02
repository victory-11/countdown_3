import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Countdown {
  id: string;
  title: string;
  targetDate: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  notify: boolean;
  completed: boolean;
  soundId?: string | null;
  loopSound: boolean;
  volume: number;
  createdAt: string;
  updatedAt: string;
}

interface CountdownState {
  countdowns: Countdown[];
  email: string | null;
  isLoading: boolean;
  isOnline: boolean;
  pendingSync: boolean;

  // Actions
  setCountdowns: (countdowns: Countdown[]) => void;
  addCountdown: (countdown: Countdown) => void;
  updateCountdown: (id: string, data: Partial<Countdown>) => void;
  removeCountdown: (id: string) => void;
  setEmail: (email: string | null) => void;
  setLoading: (loading: boolean) => void;
  setOnline: (online: boolean) => void;
  setPendingSync: (pending: boolean) => void;
}

export const useCountdownStore = create<CountdownState>()(
  persist(
    (set) => ({
      countdowns: [],
      email: null,
      isLoading: false,
      isOnline: true,
      pendingSync: false,

      setCountdowns: (countdowns) => set({ countdowns }),

      addCountdown: (countdown) =>
        set((state) => ({
          countdowns: [...state.countdowns, countdown],
          pendingSync: true,
        })),

      updateCountdown: (id, data) =>
        set((state) => ({
          countdowns: state.countdowns.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
          pendingSync: true,
        })),

      removeCountdown: (id) =>
        set((state) => ({
          countdowns: state.countdowns.filter((c) => c.id !== id),
          pendingSync: true,
        })),

      setEmail: (email) => set({ email }),

      setLoading: (isLoading) => set({ isLoading }),

      setOnline: (isOnline) => set({ isOnline }),

      setPendingSync: (pendingSync) => set({ pendingSync }),
    }),
    {
      name: 'countdown-storage',
      partialize: (state) => ({
        countdowns: state.countdowns,
        email: state.email,
      }),
    }
  )
);

// Utility functions for API calls
export const countdownApi = {
  async fetchAll(email: string): Promise<Countdown[]> {
    const response = await fetch(`/api/countdowns?email=${encodeURIComponent(email)}`);
    if (!response.ok) throw new Error('Failed to fetch countdowns');
    return response.json();
  },

  async create(email: string, data: {
    title: string;
    targetDate: string;
    description?: string;
    color: string;
    icon?: string;
    notify?: boolean;
    soundId?: string | null;
    loopSound?: boolean;
    volume?: number;
  }): Promise<Countdown> {
    const response = await fetch('/api/countdowns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...data }),
    });
    if (!response.ok) throw new Error('Failed to create countdown');
    return response.json();
  },

  async update(
    email: string,
    id: string,
    data: Partial<{
      title: string;
      targetDate: string;
      description?: string;
      color: string;
      icon?: string;
      notify: boolean;
      completed: boolean;
      soundId?: string | null;
      loopSound: boolean;
      volume: number;
    }>
  ): Promise<Countdown> {
    const response = await fetch(`/api/countdowns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...data }),
    });
    if (!response.ok) throw new Error('Failed to update countdown');
    return response.json();
  },

  async delete(email: string, id: string): Promise<void> {
    const response = await fetch(`/api/countdowns/${id}?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete countdown');
  },
};
