import { getConfig, getChoice, setLastAppId } from "./settings";
import { getTrailers, resolveTrailer } from "./trailers";
import { playTrailer, PlaybackSession } from "./player";

interface HeroCandidate {
  appId: number;
  element: HTMLElement;
  score: number;
}

function extractAppIdFromText(text: string): number | null {
  const patterns = [
    /(?:steam\/apps|store_item_assets\/steam\/apps|steamcommunity\/public\/images\/apps|\/assets)\/(\d{1,10})(?:\/|$|[._?])/i,
    /\/customimages\/(\d{1,10})(?:[a-z_]*)(?:[._/?#-]|$)/i,
    /(?:routes\/)?library\/(?:app\/)?(\d{1,10})/i,
    /\/app\/(\d{1,10})/i,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match?.[1]) {
      const id = parseInt(match[1], 10);
      if (id > 0) return id;
    }
  }
  return null;
}

function findHeroCandidate(): HeroCandidate | null {
  const selectors = [
    "[style*='steam/apps']",
    "[style*='store_item_assets']",
    "[style*='/customimages/']",
    "[style*='library_hero']",
    "img[src*='steam/apps']",
    "img[src*='store_item_assets']",
    "img[src*='/customimages/']",
    "img[src*='library_hero']",
    "[class*='TopCapsule']",
    "[class*='HeaderBackgroundImage']",
  ];

  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")));
  let best: HeroCandidate | null = null;

  for (const node of nodes) {
    const assetText = [
      node.getAttribute("style") || "",
      node.getAttribute("src") || "",
      window.getComputedStyle(node).backgroundImage || "",
      node.className || "",
    ].join(" ");

    const appId = extractAppIdFromText(assetText);
    if (!appId) continue;

    const target = node.tagName === "IMG" ? node.parentElement : node;
    if (!(target instanceof HTMLElement)) continue;

    const rect = target.getBoundingClientRect();
    // Verify it is a large banner in the upper part of the screen
    if (rect.width < 250 || rect.height < 100 || rect.top > window.innerHeight * 0.6) {
      continue;
    }

    // Score based on hero keywords and size
    let score = rect.width * rect.height;
    const lower = assetText.toLowerCase();
    if (lower.includes("library_hero") || lower.includes("topcapsule")) score += 500000;
    if (lower.includes("customimages") && lower.includes("_hero")) score += 600000;

    if (!best || score > best.score) {
      best = { appId, element: target, score };
    }
  }

  return best;
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

    const hero = findHeroCandidate();
    if (!hero) {
      // Left the game details page
      if (this.currentAppId !== null) {
        this.cleanupPlayback();
        this.currentAppId = null;
      }
      return;
    }

    const { appId, element: heroEl } = hero;
    setLastAppId(appId);

    // If navigated to another game, reset played state so it will play on next visit
    if (this.currentAppId !== appId) {
      this.cleanupPlayback();
      this.currentAppId = appId;
      this.playedApps.delete(appId);
    }

    // "when the (only 1) trailer ends it fades back into the hero and stays that way until reset (by going to another game and back)"
    if (this.playedApps.has(appId)) {
      return;
    }

    // Already playing or in delay countdown
    if (this.currentSession || this.delayTimer) {
      return;
    }

    this.currentHost = heroEl;
    heroEl.classList.add("decky-trailer-host");
    heroEl.style.setProperty("--decky-trailer-fade-duration", `${config.fadeDuration ?? 1}s`);

    const trailers = await getTrailers(appId);
    if (this.currentAppId !== appId || !trailers.length) {
      return;
    }

    const choice = getChoice(appId);
    const selectedTrailer = resolveTrailer(trailers, choice);
    if (!selectedTrailer) {
      return;
    }

    const delayMs = Math.max(0, (config.heroDelay ?? 2) * 1000);
    const videoEl = document.createElement("video");
    videoEl.className = "decky-trailer-video";
    heroEl.appendChild(videoEl);

    let isDelayDone = false;

    const session = playTrailer(
      videoEl,
      selectedTrailer,
      config,
      // onEnded
      () => {
        videoEl.classList.remove("decky-trailer-visible");
        this.playedApps.add(appId);
        window.setTimeout(() => {
          if (this.currentAppId === appId) {
            videoEl.pause();
          }
        }, (config.fadeDuration ?? 1) * 1000);
      },
      // onReady
      () => {
        if (isDelayDone && this.currentSession) {
          videoEl.classList.add("decky-trailer-visible");
        }
      }
    );

    this.currentSession = session;

    this.delayTimer = window.setTimeout(() => {
      this.delayTimer = undefined;
      isDelayDone = true;
      if (this.currentSession) {
        videoEl.classList.add("decky-trailer-visible");
      }
    }, delayMs);
  }
}
