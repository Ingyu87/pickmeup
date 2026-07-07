import { create } from 'zustand';
import { parseRoster } from '../lib/parseRoster';
import {
  clearState,
  loadState,
  saveState,
  storageAvailable,
} from '../lib/storage';
import { defaultGameSettings } from '../lib/types';
import type {
  DrawResult,
  GameSettings,
  Participant,
  PersistedAppState,
} from '../lib/types';

export type SaveStatus = 'idle' | 'saved' | 'error' | 'unavailable';

interface AppStore {
  className: string;
  rosterText: string;
  participants: Participant[];
  excludedIds: string[];
  path: string;
  soundEnabled: boolean;
  bgmEnabled: boolean;
  gameSettings: GameSettings;
  lastResult: DrawResult | null;

  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  restored: boolean;

  setClassName: (v: string) => void;
  setRosterText: (v: string) => void;
  toggleExcluded: (id: string) => void;
  clearRoster: () => void;
  setPath: (p: string) => void;
  toggleSound: () => void;
  updateLot: (patch: Partial<GameSettings['lot']>) => void;
  updateWheel: (patch: Partial<GameSettings['wheel']>) => void;
  updateLadder: (patch: Partial<GameSettings['ladder']>) => void;
  updateRace: (patch: Partial<GameSettings['race']>) => void;
  updateSlot: (patch: Partial<GameSettings['slot']>) => void;
  setLastResult: (r: DrawResult | null) => void;
  excludeIds: (ids: string[]) => void;
  resetAll: () => void;
  importState: (s: PersistedAppState) => void;
}

const available = storageAvailable();
const persisted = available ? loadState() : null;

function mergeSettings(saved?: GameSettings): GameSettings {
  const d = defaultGameSettings();
  if (!saved) return d;
  return {
    wheel: { ...d.wheel, ...saved.wheel },
    lot: { ...d.lot, ...saved.lot },
    ladder: { ...d.ladder, ...saved.ladder },
    race: { ...d.race, ...saved.race },
    slot: { ...d.slot, ...saved.slot },
  };
}

export const useAppStore = create<AppStore>()((set, get) => ({
  className: persisted?.session.className ?? '',
  rosterText: persisted?.session.rosterText ?? '',
  participants: persisted?.session.participants ?? [],
  excludedIds: persisted?.session.excludedIds ?? [],
  path: persisted?.navigation.path ?? '/',
  soundEnabled: persisted?.preferences.soundEnabled ?? false,
  bgmEnabled: persisted?.preferences.bgmEnabled ?? false,
  gameSettings: mergeSettings(persisted?.gameSettings),
  lastResult: persisted?.lastResult ?? null,

  saveStatus: available ? (persisted ? 'saved' : 'idle') : 'unavailable',
  lastSavedAt: persisted?.savedAt ?? null,
  restored: !!persisted,

  setClassName: (v) => set({ className: v }),

  setRosterText: (v) => {
    const participants = parseRoster(v);
    const ids = new Set(participants.map((p) => p.id));
    set({
      rosterText: v,
      participants,
      excludedIds: get().excludedIds.filter((id) => ids.has(id)),
    });
  },

  toggleExcluded: (id) => {
    const cur = get().excludedIds;
    set({
      excludedIds: cur.includes(id)
        ? cur.filter((x) => x !== id)
        : [...cur, id],
    });
  },

  clearRoster: () =>
    set({ rosterText: '', participants: [], excludedIds: [] }),

  setPath: (p) => set({ path: p }),

  toggleSound: () => set({ soundEnabled: !get().soundEnabled }),

  updateLot: (patch) =>
    set({
      gameSettings: {
        ...get().gameSettings,
        lot: { ...get().gameSettings.lot, ...patch },
      },
    }),

  updateWheel: (patch) =>
    set({
      gameSettings: {
        ...get().gameSettings,
        wheel: { ...get().gameSettings.wheel, ...patch },
      },
    }),

  updateLadder: (patch) =>
    set({
      gameSettings: {
        ...get().gameSettings,
        ladder: { ...get().gameSettings.ladder, ...patch },
      },
    }),

  updateRace: (patch) =>
    set({
      gameSettings: {
        ...get().gameSettings,
        race: { ...get().gameSettings.race, ...patch },
      },
    }),

  updateSlot: (patch) =>
    set({
      gameSettings: {
        ...get().gameSettings,
        slot: { ...get().gameSettings.slot, ...patch },
      },
    }),

  setLastResult: (r) => set({ lastResult: r }),

  excludeIds: (ids) =>
    set({ excludedIds: [...new Set([...get().excludedIds, ...ids])] }),

  resetAll: () => {
    clearState();
    set({
      className: '',
      rosterText: '',
      participants: [],
      excludedIds: [],
      path: '/',
      soundEnabled: false,
      bgmEnabled: false,
      gameSettings: defaultGameSettings(),
      lastResult: null,
      saveStatus: available ? 'idle' : 'unavailable',
      lastSavedAt: null,
    });
  },

  importState: (s) => {
    set({
      className: s.session.className,
      rosterText: s.session.rosterText,
      participants: s.session.participants,
      excludedIds: s.session.excludedIds,
      soundEnabled: s.preferences.soundEnabled,
      bgmEnabled: s.preferences.bgmEnabled,
      gameSettings: mergeSettings(s.gameSettings),
      lastResult: s.lastResult,
    });
  },
}));

function snapshot(s: AppStore): Omit<PersistedAppState, 'savedAt'> {
  return {
    version: 1,
    session: {
      className: s.className,
      rosterText: s.rosterText,
      participants: s.participants,
      excludedIds: s.excludedIds,
    },
    navigation: { path: s.path },
    preferences: { soundEnabled: s.soundEnabled, bgmEnabled: s.bgmEnabled },
    gameSettings: s.gameSettings,
    lastResult: s.lastResult,
  };
}

export function buildExportState(): PersistedAppState {
  return { ...snapshot(useAppStore.getState()), savedAt: Date.now() };
}

let lastJson = JSON.stringify(snapshot(useAppStore.getState()));
let timer: ReturnType<typeof setTimeout> | undefined;

useAppStore.subscribe((s) => {
  if (!available) return;
  const json = JSON.stringify(snapshot(s));
  if (json === lastJson) return;
  lastJson = json;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const outcome = saveState({ ...snapshot(useAppStore.getState()), savedAt: Date.now() });
    useAppStore.setState(
      outcome === 'saved'
        ? { saveStatus: 'saved', lastSavedAt: Date.now() }
        : { saveStatus: 'error' },
    );
  }, 400);
});
