'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, Wifi, WifiOff, Clock, VolumeX, Mail, LogOut, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCountdownStore, countdownApi, Countdown } from '@/lib/countdown-store';
import { CountdownCard } from '@/components/countdown/CountdownCard';
import { AddCountdownModal } from '@/components/countdown/AddCountdownModal';
import { useToast } from '@/hooks/use-toast';
import { soundApi, audioManager, initializeDefaultSounds } from '@/lib/sound-store';

export default function HomePage() {
  const { toast } = useToast();
  const {
    countdowns,
    email,
    isLoading,
    isOnline,
    setCountdowns,
    addCountdown,
    updateCountdown: updateStoreCountdown,
    removeCountdown,
    setEmail,
    setLoading,
    setOnline,
  } = useCountdownStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCountdown, setEditingCountdown] = useState<Countdown | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [pendingActions, setPendingActions] = useState<Array<{
    type: 'create' | 'update' | 'delete';
    data: any;
    id?: string;
  }>>([]);

  const triggeredCountdowns = useRef<Set<string>>(new Set());

  // Initialize sounds
  useEffect(() => {
    initializeDefaultSounds();
  }, []);

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (pendingActions.length > 0 && email) {
        syncPendingActions();
      }
    };
    const handleOffline = () => setOnline(false);

    setOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline, pendingActions, email]);

  // Background countdown checker
  useEffect(() => {
    const checkCountdowns = () => {
      const now = new Date();

      countdowns.forEach(async (countdown) => {
        const targetDate = new Date(countdown.targetDate);
        const isPast = now >= targetDate;

        if (isPast && !triggeredCountdowns.current.has(countdown.id) && !countdown.completed) {
          triggeredCountdowns.current.add(countdown.id);

          if (countdown.soundId) {
            try {
              const sound = await soundApi.get(countdown.soundId);
              if (sound) {
                audioManager.setVolume(countdown.volume ?? 1.0);
                await audioManager.play(sound.data, countdown.loopSound);
              }
            } catch (error) {
              console.error('Failed to play sound:', error);
            }
          }

          if (countdown.notify && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`⏰ ${countdown.title}`, {
              body: 'Your countdown has ended!',
              icon: '/icon-192.png',
              tag: countdown.id,
            });
          }

          updateStoreCountdown(countdown.id, { completed: true });
        }
      });
    };

    const interval = setInterval(checkCountdowns, 1000);
    checkCountdowns();

    return () => clearInterval(interval);
  }, [countdowns, updateStoreCountdown]);

  // Sync pending actions
  const syncPendingActions = useCallback(async () => {
    if (pendingActions.length === 0 || !email) return;

    toast({
      title: 'Syncing...',
      description: `Syncing ${pendingActions.length} pending change(s)`,
    });

    for (const action of pendingActions) {
      try {
        if (action.type === 'create') {
          const newCountdown = await countdownApi.create(email, action.data);
          const oldId = action.data.tempId;
          if (oldId) {
            removeCountdown(oldId);
            addCountdown(newCountdown);
          }
        } else if (action.type === 'update' && action.id) {
          await countdownApi.update(email, action.id, action.data);
        } else if (action.type === 'delete' && action.id) {
          await countdownApi.delete(email, action.id);
        }
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }

    setPendingActions([]);
    toast({
      title: 'Sync complete',
      description: 'All changes have been synced',
    });
  }, [pendingActions, email, addCountdown, removeCountdown, toast]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Load countdowns
  const loadCountdowns = useCallback(async () => {
    if (!email || !navigator.onLine) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await countdownApi.fetchAll(email);
      setCountdowns(data);
    } catch (error) {
      console.error('Failed to load countdowns:', error);
    } finally {
      setLoading(false);
    }
  }, [email, setCountdowns, setLoading]);

  // Load countdowns when email changes
  useEffect(() => {
    if (email && isOnline) {
      loadCountdowns();
    }
  }, [email, isOnline, loadCountdowns]);

  // Handle email login
  const handleEmailLogin = () => {
    if (!emailInput.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    const cleanEmail = emailInput.trim().toLowerCase();
    setEmail(cleanEmail);
    toast({
      title: 'Signed in',
      description: `Syncing with ${cleanEmail}`,
    });
  };

  // Handle logout
  const handleLogout = () => {
    setEmail(null);
    setCountdowns([]);
    setEmailInput('');
    toast({
      title: 'Signed out',
      description: 'Your local data has been cleared',
    });
  };

  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle create/edit countdown
  const handleSaveCountdown = async (data: {
    title: string;
    targetDate: string;
    description?: string;
    color: string;
    icon?: string;
    notify: boolean;
    soundId?: string | null;
    loopSound: boolean;
    volume: number;
  }) => {
    if (editingCountdown) {
      updateStoreCountdown(editingCountdown.id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });

      if (isOnline && email) {
        try {
          const updated = await countdownApi.update(email, editingCountdown.id, data);
          updateStoreCountdown(editingCountdown.id, updated);
          toast({
            title: 'Countdown updated',
            description: `"${data.title}" has been updated`,
          });
        } catch (error) {
          console.error('Failed to update on server:', error);
          setPendingActions(prev => [...prev, { type: 'update', id: editingCountdown.id, data }]);
          toast({
            title: 'Saved offline',
            description: 'Changes will sync when online',
          });
        }
      } else {
        setPendingActions(prev => [...prev, { type: 'update', id: editingCountdown.id, data }]);
      }

      setEditingCountdown(null);
      return;
    }

    const tempId = generateTempId();
    const newCountdown: Countdown = {
      id: tempId,
      ...data,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addCountdown(newCountdown);

    if (isOnline && email) {
      try {
        const created = await countdownApi.create(email, data);
        removeCountdown(tempId);
        addCountdown(created);

        toast({
          title: 'Countdown created',
          description: `"${data.title}" has been added`,
        });
      } catch (error) {
        console.error('Failed to create on server:', error);
        setPendingActions(prev => [...prev, { type: 'create', data: { ...data, tempId } }]);
        toast({
          title: 'Saved offline',
          description: 'Will sync when online',
        });
      }
    } else {
      setPendingActions(prev => [...prev, { type: 'create', data: { ...data, tempId } }]);
      toast({
        title: 'Saved offline',
        description: 'Will sync when online',
      });
    }
  };

  // Handle delete countdown
  const handleDeleteCountdown = async (id: string) => {
    audioManager.stop();
    removeCountdown(id);

    if (isOnline && email) {
      try {
        await countdownApi.delete(email, id);
        toast({
          title: 'Countdown deleted',
          description: 'The countdown has been removed',
        });
      } catch (error) {
        console.error('Failed to delete from server:', error);
        setPendingActions(prev => [...prev, { type: 'delete', id }]);
      }
    } else {
      setPendingActions(prev => [...prev, { type: 'delete', id }]);
    }
  };

  // Handle toggle notification
  const handleToggleNotify = async (id: string, notify: boolean) => {
    updateStoreCountdown(id, { notify });

    if (isOnline && email) {
      try {
        await countdownApi.update(email, id, { notify });
      } catch (error) {
        console.error('Failed to update notification:', error);
      }
    } else {
      setPendingActions(prev => [...prev, { type: 'update', id, data: { notify } }]);
    }
  };

  // Handle stop sound
  const handleStopSound = () => {
    audioManager.stop();
    toast({
      title: 'Sound stopped',
      description: 'The alarm sound has been stopped',
    });
  };

  const sortedCountdowns = [...countdowns].sort((a, b) => {
    const aPast = new Date(a.targetDate) <= new Date();
    const bPast = new Date(b.targetDate) <= new Date();
    if (aPast && !bPast) return 1;
    if (!aPast && bPast) return -1;
    return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
  });

  // Not signed in - show login page
  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
        {/* Header */}
        <header className="p-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                className="p-2 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 shadow-lg"
              >
                <Clock className="w-6 h-6 text-white" />
              </motion.div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                  Countdown
                </span>
              </h1>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <div className="p-6 rounded-full bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-cyan-500/10 mb-6 inline-block">
              <Mail className="w-16 h-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Track Your Important Moments</h2>
            <p className="text-muted-foreground mb-8">
              Enter your email to sync your countdowns across all your devices.
            </p>

            <div className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                className="text-center h-12 text-lg"
              />
              <Button
                onClick={handleEmailLogin}
                size="lg"
                className="gap-2 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:opacity-90"
              >
                <Check className="w-5 h-5" />
                Continue with Email
              </Button>
            </div>
          </motion.div>
        </main>

        {/* Features */}
        <div className="p-8 max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Colorful Design', desc: 'Personalize with colors and emojis' },
              { title: 'Notifications', desc: 'Get alerts when countdowns end' },
              { title: 'Custom Sounds', desc: 'Upload your own alert sounds' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="p-4 rounded-xl bg-muted/50 text-center"
              >
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Signed in - show main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                className="p-2 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 shadow-lg"
              >
                <Clock className="w-6 h-6 text-white" />
              </motion.div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                  Countdown
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Stop sound button */}
              {audioManager.getIsPlaying() && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleStopSound}
                  className="animate-pulse"
                >
                  <VolumeX className="w-4 h-4" />
                </Button>
              )}

              {/* Online/Offline indicator */}
              <Badge
                variant="outline"
                className={`gap-1 ${
                  isOnline
                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                    : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </>
                )}
              </Badge>

              {/* Pending sync indicator */}
              {pendingActions.length > 0 && (
                <Badge variant="outline" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <RefreshCw className="w-3 h-3" />
                  {pendingActions.length} pending
                </Badge>
              )}

              {/* Email badge */}
              <Badge variant="secondary" className="gap-1">
                <Mail className="w-3 h-3" />
                <span className="max-w-[100px] truncate">{email.split('@')[0]}</span>
              </Badge>

              {/* Refresh button */}
              {isOnline && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadCountdowns}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}

              {/* Add button */}
              <Button onClick={() => setShowAddModal(true)} className="gap-1">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>

              {/* Sign out */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {countdowns.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-6 rounded-full bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-cyan-500/10 mb-6">
              <Clock className="w-16 h-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No countdowns yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first countdown to start tracking important moments
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              size="lg"
              className="gap-2 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:opacity-90"
            >
              <Plus className="w-5 h-5" />
              Create Your First Countdown
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {sortedCountdowns.map((countdown) => (
                <CountdownCard
                  key={countdown.id}
                  countdown={countdown}
                  onEdit={(c) => {
                    setEditingCountdown(c);
                    setShowAddModal(true);
                  }}
                  onDelete={handleDeleteCountdown}
                  onToggleNotify={handleToggleNotify}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <AddCountdownModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) setEditingCountdown(null);
        }}
        onSave={handleSaveCountdown}
        editingCountdown={editingCountdown}
      />
    </div>
  );
}
