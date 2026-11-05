import Hls from "hls.js";
import { Config } from "./settings";
import { Trailer } from "./trailers";

export interface PlaybackSession {
  video: HTMLVideoElement;
  cleanup: () => void;
}

/**
 * Loads and plays a trailer into the given <video> element.
 * Supports HLS adaptive streams via Hls.js, native HLS, and progressive MP4/WebM.
 */
export function playTrailer(
  video: HTMLVideoElement,
  trailer: Trailer,
  config: Config,
  onEnded: () => void,
  onReady?: () => void
): PlaybackSession {
  let isCancelled = false;
  let hlsInstance: Hls | null = null;

  // Always start muted to satisfy browser autoplay policies
  video.loop = false;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");

  const cleanup = () => {
    isCancelled = true;
    video.removeEventListener("ended", handleEnded);
    video.removeEventListener("canplay", handleCanPlay);
    video.removeEventListener("playing", handlePlaying);
    if (hlsInstance) {
      try {
        hlsInstance.destroy();
      } catch {
        /* ignore */
      }
      hlsInstance = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
  };

  const handleEnded = () => {
    if (!isCancelled) {
      onEnded();
    }
  };

  const handleCanPlay = () => {
    if (!isCancelled && onReady) {
      onReady();
    }
  };

  const handlePlaying = () => {
    if (!isCancelled && config.audio) {
      // Unmute once playback starts
      video.muted = false;
      video.volume = Math.max(0, Math.min(1, (config.volume ?? 50) / 100));
    }
  };

  video.addEventListener("ended", handleEnded, { once: true });
  video.addEventListener("canplay", handleCanPlay, { once: true });
  video.addEventListener("playing", handlePlaying, { once: true });

  const tryPlay = () => {
    if (!isCancelled) {
      video.play().catch((err) => {
        console.warn("[Decky Trailers] Autoplay prevented, retrying muted", err);
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  };

  // 1. If progressive MP4 or WebM is available, use it directly
  if (trailer.mp4 || trailer.webm) {
    const src = trailer.mp4 || trailer.webm;
    video.src = src!;
    video.load();
    tryPlay();
    return { video, cleanup };
  }

  // 2. If HLS stream is available, use Hls.js
  if (trailer.hls) {
    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        maxBufferSize: 30 * 1000 * 1000,
        enableWorker: false, // Safer in CEF / sandbox
      });
      hlsInstance = hls;

      hls.loadSource(trailer.hls);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isCancelled) {
          tryPlay();
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && !isCancelled) {
          console.warn("[Decky Trailers] Hls.js fatal error:", data.type);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              cleanup();
              onEnded();
              break;
          }
        }
      });

      return { video, cleanup };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari/WebKit HLS fallback
      video.src = trailer.hls;
      video.load();
      tryPlay();
      return { video, cleanup };
    }
  }

  // 3. Fallback to direct movie files if manifest parsing is unavailable
  const fallbackUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${trailer.id}/movie480.mp4`;
  video.src = fallbackUrl;
  video.load();
  tryPlay();

  return { video, cleanup };
}
