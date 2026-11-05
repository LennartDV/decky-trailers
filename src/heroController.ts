import { getConfig, getChoice, setLastAppId } from "./settings";
import { getTrailers, resolveTrailer } from "./trailers";
import { playTrailer, PlaybackSession } from "./player";

function extractAppIdFromUrl(url: string): number | null {
  const patterns = [
    /\/(?:routes\/)?library\/app\/(\d+)/i,
    /\/library\/app\/(\d+)/i,
    /\/app\/(\d+)/i,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match?.[1]) {
      const id = parseInt(match[1], 10);
      if (id > 0) return id;
    }
  }
  return null;
}

function findHeroElement(): HTMLElement | null {
  // 1. Check for standard Steam Big Picture / Gamepad UI hero containers
  const selectors = [
    '[class*="TopCapsule"]',
    '[class*="HeaderBackgroundImage"]',
    '[class*="appdetailsheader_TopCapsule"]',
    '[class*="appdetailsheader_ImgContainer"]',
    '[class*="appdetailsheader_HeaderBackgroundImage"]',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el && el.getBoundingClientRect().height > 120) {
      return el;
    }
  }

  // 2. Scan for background images or images containing library_hero or steam/apps
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "div[style*='library_hero'], div[style*='steam/apps'], div[style*='customimages'], img[src*='library_hero']"
    )
  );

  for (const el of candidates) {
    const target = el.tagName === "IMG" ? el.parentElement : el;
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.width >= 300 && rect.height >= 120 && rect.top < window.innerHeight / 2) {
        return target;
      }
    }
  }

  return null;
}

export class HeroController {
  private currentAppId: number | null = null;
  private currentHost: HTMLElement | null = null;
  private currentSession: PlaybackSession | null = null;
  private delayTimer: number | undefined;
  private playedApps = new Set<number>();
  private observer: MutationObserver | null = null;
  private isScanning = false;
  private gameRunning = false;
  private unsubscribeLifetime: (() => void) | undefined;

  start(): void {
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "src", "class"],
    });

    // Listen for Steam GameSession launch notifications to pause during gaming
    try {
      const unreg = (window as any).SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.(
        (e: { bRunning?: boolean }) => {
          this.gameRunning = !!e?.bRunning;
          if (this.gameRunning) {
            this.cleanupPlayback();
          } else {
            this.scheduleScan();
          }
        }
      );
      if (unreg?.unregister) {
        this.unsubscribeLifetime = () => unreg.unregister();
      }
    } catch {
      /* ignore */
    }

    this.scheduleScan();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.unsubscribeLifetime?.();
    this.cleanupPlayback();
  }

  private scheduleScan(): void {
    if (this.isScanning) return;
    this.isScanning = true;
    window.requestAnimationFrame(() => {
      this.isScanning = false;
      this.scan();
    });
  }

  private cleanupPlayback(): void {
    if (this.delayTimer) {
      window.clearTimeout(this.delayTimer);
      this.delayTimer = undefined;
    }
    if (this.currentSession) {
      this.currentSession.cleanup();
      this.currentSession.video.remove();
      this.currentSession = null;
    }
    if (this.currentHost) {
      this.currentHost.classList.remove("decky-trailer-host");
      this.currentHost = null;
    }
  }

  private async scan(): Promise<void> {
    const config = getConfig();
    if (!config.enabled || this.gameRunning) {
      this.cleanupPlayback();
      return;
    }

    const currentUrl = window.location.href;
    const appId = extractAppIdFromUrl(currentUrl);

    // If we left the game page, clean up and reset other played states when switching
    if (!appId) {
      if (this.currentAppId !== null) {
        this.cleanupPlayback();
        this.currentAppId = null;
      }
      return;
    }

    setLastAppId(appId);

    // If switched to a new game, reset playback
    if (this.currentAppId !== appId) {
      this.cleanupPlayback();
      this.currentAppId = appId;
      // Allow playing for this newly visited game
      this.playedApps.delete(appId);
    }

    // If already played for this visit, respect "stays that way until reset"
    if (this.playedApps.has(appId)) {
      return;
    }

    // If already playing or waiting on timer for this element, do nothing
    if (this.currentSession || this.delayTimer) {
      return;
    }

    const heroEl = findHeroElement();
    if (!heroEl) return;

    this.currentHost = heroEl;
    heroEl.classList.add("decky-trailer-host");
    heroEl.style.setProperty("--decky-trailer-fade-duration", `${config.fadeDuration ?? 1}s`);

    // Look up trailers
    const trailers = await getTrailers(appId);
    if (this.currentAppId !== appId || !trailers.length) {
      return; // No trailers on store page -> keep standard hero
    }

    const choice = getChoice(appId);
    const selectedTrailer = resolveTrailer(trailers, choice);
    if (!selectedTrailer) {
      return; // Choice was "none" or no trailer available
    }

    // Step 1: Wait initial 2 seconds showing the hero art
    const delayMs = Math.max(0, (config.heroDelay ?? 2) * 1000);

    const videoEl = document.createElement("video");
    videoEl.className = "decky-trailer-video";
    heroEl.appendChild(videoEl);

    let isDelayDone = false;
    let isVideoReady = false;

    const tryStartTransition = () => {
      if (isDelayDone && isVideoReady && this.currentSession) {
        videoEl.play().catch(() => {
          /* autoplay restrictions */
        });
        videoEl.classList.add("decky-trailer-visible");
      }
    };

    const session = playTrailer(
      videoEl,
      selectedTrailer,
      config,
      // onEnded handler
      () => {
        // Fade back to the hero and stay that way until reset!
        videoEl.classList.remove("decky-trailer-visible");
        this.playedApps.add(appId);

        // After fade out completes, pause and clean up session
        window.setTimeout(() => {
          if (this.currentAppId === appId) {
            videoEl.pause();
          }
        }, (config.fadeDuration ?? 1) * 1000);
      },
      // onReady handler
      () => {
        isVideoReady = true;
        tryStartTransition();
      }
    );

    this.currentSession = session;

    this.delayTimer = window.setTimeout(() => {
      this.delayTimer = undefined;
      isDelayDone = true;
      tryStartTransition();
    }, delayMs);
  }
}
