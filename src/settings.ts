import { callable } from "@decky/api";
import { useEffect, useState } from "react";

/** Global options, editable from the Quick Access panel. */
export interface Config {
  /** Master switch. */
  enabled: boolean;
  /** Seconds the normal hero is shown before fading into the trailer. */
  heroDelay: number;
  /** Duration of the cross-fade (in and out), in seconds. */
  fadeDuration: number;
  /** Play the trailer's audio. */
  audio: boolean;
  /** Trailer volume, 0-100. */
  volume: number;
  /** Maximum vertical resolution to stream. */
  quality: number;
  /** Don't start (and stop) trailers while a game is running. */
  pauseWhileGameRunning: boolean;
}

export const DEFAULT_CONFIG: Config = {
  enabled: true,
  heroDelay: 2,
  fadeDuration: 1,
  audio: false,
  volume: 50,
  quality: 720,
  pauseWhileGameRunning: true,
};

/**
 * Per-game choice:
 *  - undefined -> automatic (first trailer on the store page)
 *  - number    -> a specific Steam movie id
 *  - "none"    -> never play a trailer for this game, always show the hero
 */
export type TrailerChoice = number | "none" | undefined;

interface BackendState {
  config: Partial<Config>;
  choices: Record<string, number | "none">;
}

const getState = callable<[], BackendState>("get_state");
const setConfigBackend = callable<[config: Config], boolean>("set_config");
const setChoiceBackend = callable<[appid: number, choice: number | "none" | null], boolean>("set_choice");
const resetChoicesBackend = callable<[], boolean>("reset_choices");

let config: Config = { ...DEFAULT_CONFIG };
let choices: Record<string, number | "none"> = {};
let lastAppId: number | undefined;
let loaded: Promise<void> | undefined;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Loads settings from the backend. Safe to call multiple times. */
export function loadState(): Promise<void> {
  if (!loaded) {
    loaded = getState()
      .then((state) => {
        config = { ...DEFAULT_CONFIG, ...(state?.config ?? {}) };
        choices = { ...(state?.choices ?? {}) };
        notify();
      })
      .catch((e) => {
        console.error("[Decky Trailers] Failed to load settings", e);
      });
  }
  return loaded;
}

export const getConfig = (): Config => config;

export function updateConfig(patch: Partial<Config>): void {
  config = { ...config, ...patch };
  notify();
  setConfigBackend(config).catch((e) => console.error("[Decky Trailers] Failed to save settings", e));
}

export const getChoice = (appid: number): TrailerChoice => choices[String(appid)];

export async function setChoice(appid: number, choice: TrailerChoice): Promise<void> {
  if (choice === undefined) {
    delete choices[String(appid)];
  } else {
    choices[String(appid)] = choice;
  }
  choices = { ...choices };
  notify();
  await setChoiceBackend(appid, choice ?? null);
}

export async function resetChoices(): Promise<void> {
  choices = {};
  notify();
  await resetChoicesBackend();
}

export const countChoices = (): number => Object.keys(choices).length;

/** The last game page the user opened, used by the Quick Access panel. */
export const getLastAppId = (): number | undefined => lastAppId;

export function setLastAppId(appid: number): void {
  if (lastAppId !== appid) {
    lastAppId = appid;
    notify();
  }
}

/** Re-renders the calling component whenever settings change. */
export function useSettingsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);
  return version;
}

export function useConfig(): Config {
  useSettingsVersion();
  return config;
}
