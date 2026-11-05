import { Config } from "./settings";
import { Trailer } from "./trailers";

export interface PlaybackSession {
  video: HTMLVideoElement;
  cleanup: () => void;
}

interface DashSegmentStream {
  initUrl: string;
  segmentUrls: string[];
  codec: string;
  height: number;
  bandwidth: number;
}

interface DashVariant extends DashSegmentStream {
  audio?: DashSegmentStream;
}

function parseIsoDurationSeconds(value: string): number {
  const match = value.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return 0;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function expandDashTemplate(value: string, representationId: string, bandwidth: number, number?: number, time?: number): string {
  return value
    .replace(/\$RepresentationID\$/g, representationId)
    .replace(/\$Bandwidth\$/g, String(bandwidth))
    .replace(/\$Time\$/g, String(time ?? 0))
    .replace(/\$Number(?:%0(\d+)d)?\$/g, (_match, width) => {
      const text = String(number ?? 0);
      return width ? text.padStart(Number(width), "0") : text;
    })
    .replace(/\$\$/g, "$");
}

function buildDashSegmentUrls(
  template: Element,
  mediaTemplate: string,
  representationId: string,
  bandwidth: number,
  durationSeconds: number,
  manifestUrl: string
): string[] {
  const timeline = template.getElementsByTagName("SegmentTimeline")[0];
  const startNumber = Number(template.getAttribute("startNumber") ?? 1);
  const urls: string[] = [];
  const maxSegments = 180;

  if (timeline) {
    let number = startNumber;
    let currentTime = 0;
    for (const item of Array.from(timeline.getElementsByTagName("S"))) {
      const duration = Number(item.getAttribute("d") ?? 0);
      const repeat = Number(item.getAttribute("r") ?? 0);
      if (!duration) continue;
      if (item.hasAttribute("t")) {
        currentTime = Number(item.getAttribute("t") ?? currentTime);
      }
      const count = repeat < 0 ? maxSegments - urls.length : repeat + 1;
      for (let i = 0; i < count && urls.length < maxSegments; i++) {
        const expanded = expandDashTemplate(mediaTemplate, representationId, bandwidth, number, currentTime);
        urls.push(new URL(expanded, manifestUrl).href);
        number += 1;
        currentTime += duration;
      }
    }
    return urls;
  }

  const timescale = Number(template.getAttribute("timescale") ?? 1);
  const duration = Number(template.getAttribute("duration") ?? 0);
  if (!timescale || !duration || !durationSeconds) return [];

  const segmentCount = Math.min(maxSegments, Math.ceil(durationSeconds / (duration / timescale)));
  for (let i = 0; i < segmentCount; i++) {
    const number = startNumber + i;
    const expanded = expandDashTemplate(mediaTemplate, representationId, bandwidth, number);
    urls.push(new URL(expanded, manifestUrl).href);
  }
  return urls;
}

function selectDashVariant(manifestText: string, manifestUrl: string, targetQuality: number): DashVariant {
  const xml = new DOMParser().parseFromString(manifestText, "application/xml");
  if (xml.querySelector("parsererror")) {
    throw new Error("Invalid DASH manifest XML");
  }

  const durationSeconds = parseIsoDurationSeconds(xml.documentElement.getAttribute("mediaPresentationDuration") ?? "");
  const videoVariants: DashSegmentStream[] = [];
  const audioVariants: DashSegmentStream[] = [];

  for (const adaptation of Array.from(xml.getElementsByTagName("AdaptationSet"))) {
    const contentType = adaptation.getAttribute("contentType") ?? "";
    const mimeType = adaptation.getAttribute("mimeType") ?? "";
    const isAudio = contentType === "audio" || mimeType.startsWith("audio/");
    const isVideo = contentType === "video" || mimeType.startsWith("video/") || (!contentType && !mimeType);
    if (!isAudio && !isVideo) continue;

    const adaptationTemplate = adaptation.getElementsByTagName("SegmentTemplate")[0];

    for (const rep of Array.from(adaptation.getElementsByTagName("Representation"))) {
      const codec = rep.getAttribute("codecs") ?? adaptation.getAttribute("codecs") ?? "";
      const repMime = rep.getAttribute("mimeType") ?? mimeType;
      if (!codec) continue;
      if (isAudio && repMime && !repMime.startsWith("audio/")) continue;
      if (isVideo && repMime && !repMime.startsWith("video/")) continue;

      // Prefer H.264 (avc1) for maximum compatibility in Chromium CEF
      if (isVideo && !codec.startsWith("avc1") && !codec.startsWith("mp4a")) {
        // Skip non-avc1 video if avc1 is available
      }

      const template = rep.getElementsByTagName("SegmentTemplate")[0] ?? adaptationTemplate;
      if (!template) continue;

      const repId = rep.getAttribute("id") ?? "";
      const bandwidth = Number(rep.getAttribute("bandwidth") ?? 0);
      const height = Number(rep.getAttribute("height") ?? adaptation.getAttribute("maxHeight") ?? 0);
      const initAttr = template.getAttribute("initialization") ?? "";
      const mediaAttr = template.getAttribute("media") ?? "";
      if (!repId || !initAttr || !mediaAttr) continue;

      const initUrl = new URL(expandDashTemplate(initAttr, repId, bandwidth), manifestUrl).href;
      const segmentUrls = buildDashSegmentUrls(template, mediaAttr, repId, bandwidth, durationSeconds, manifestUrl);
      if (!segmentUrls.length) continue;

      const item: DashSegmentStream = { initUrl, segmentUrls, codec, height, bandwidth };
      if (isAudio) {
        audioVariants.push(item);
      } else {
        videoVariants.push(item);
      }
    }
  }

  if (!videoVariants.length) {
    throw new Error("No usable video streams found in DASH manifest");
  }

  // Sort video variants by distance to requested quality
  videoVariants.sort((a, b) => {
    const distA = Math.abs((a.height || targetQuality) - targetQuality);
    const distB = Math.abs((b.height || targetQuality) - targetQuality);
    return distA - distB || b.height - a.height || b.bandwidth - a.bandwidth;
  });

  audioVariants.sort((a, b) => b.bandwidth - a.bandwidth);

  return {
    ...videoVariants[0],
    audio: audioVariants[0],
  };
}

async function fetchArrayBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching chunk: ${url}`);
  return await res.arrayBuffer();
}

function appendBufferAsync(sb: SourceBuffer, data: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEnd = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("SourceBuffer append failed"));
    };
    const cleanup = () => {
      sb.removeEventListener("updateend", onEnd);
      sb.removeEventListener("error", onError);
    };
    sb.addEventListener("updateend", onEnd);
    sb.addEventListener("error", onError);
    sb.appendBuffer(data);
  });
}

/**
 * Loads and plays a trailer into the given <video> element.
 * Automatically selects between direct progressive MP4/WebM, DASH (MediaSource), or HLS.
 */
export function playTrailer(
  video: HTMLVideoElement,
  trailer: Trailer,
  config: Config,
  onEnded: () => void,
  onReady?: () => void
): PlaybackSession {
  let isCancelled = false;
  let objectUrl: string | undefined;
  let abortController = new AbortController();

  video.loop = false;
  video.muted = !config.audio;
  video.volume = Math.max(0, Math.min(1, (config.volume ?? 50) / 100));
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");

  const cleanup = () => {
    isCancelled = true;
    abortController.abort();
    video.removeEventListener("ended", handleEnded);
    video.removeEventListener("canplay", handleCanPlay);
    video.pause();
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
      objectUrl = undefined;
    }
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

  video.addEventListener("ended", handleEnded, { once: true });
  video.addEventListener("canplay", handleCanPlay, { once: true });

  (async () => {
    try {
      // 1. Direct progressive file if available
      if (trailer.mp4 || trailer.webm) {
        const directUrl = trailer.mp4 ?? trailer.webm;
        if (directUrl) {
          video.src = directUrl;
          video.load();
          return;
        }
      }

      // 2. MPEG-DASH via MediaSource
      if (trailer.dashH264 && typeof MediaSource !== "undefined") {
        const manifestRes = await fetch(trailer.dashH264, { signal: abortController.signal });
        if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status} on DASH manifest`);
        const manifestText = await manifestRes.text();
        if (isCancelled) return;

        const variant = selectDashVariant(manifestText, trailer.dashH264, config.quality ?? 720);
        const videoMime = `video/mp4; codecs="${variant.codec}"`;
        if (!MediaSource.isTypeSupported(videoMime)) {
          throw new Error(`MediaSource does not support: ${videoMime}`);
        }

        const audioMime = variant.audio && config.audio ? `audio/mp4; codecs="${variant.audio.codec}"` : undefined;
        const useAudio = Boolean(audioMime && MediaSource.isTypeSupported(audioMime));

        const ms = new MediaSource();
        objectUrl = URL.createObjectURL(ms);
        video.src = objectUrl;

        await new Promise<void>((resolve, reject) => {
          ms.addEventListener("sourceopen", async () => {
            try {
              if (isCancelled) return reject(new Error("Cancelled"));

              const videoSb = ms.addSourceBuffer(videoMime);
              videoSb.mode = "segments";

              let audioSb: SourceBuffer | undefined;
              if (useAudio && audioMime) {
                audioSb = ms.addSourceBuffer(audioMime);
                audioSb.mode = "segments";
              }

              // Append video init segment
              const videoInitBuf = await fetchArrayBuffer(variant.initUrl, abortController.signal);
              if (isCancelled) return;
              await appendBufferAsync(videoSb, videoInitBuf);

              // Append audio init segment if present
              if (audioSb && variant.audio) {
                const audioInitBuf = await fetchArrayBuffer(variant.audio.initUrl, abortController.signal);
                if (isCancelled) return;
                await appendBufferAsync(audioSb, audioInitBuf);
              }

              resolve();

              // Feed video and audio segments asynchronously
              for (let i = 0; i < variant.segmentUrls.length; i++) {
                if (isCancelled || ms.readyState !== "open") break;

                const videoSeg = await fetchArrayBuffer(variant.segmentUrls[i], abortController.signal);
                if (isCancelled || ms.readyState !== "open") break;
                await appendBufferAsync(videoSb, videoSeg);

                if (audioSb && variant.audio?.segmentUrls[i]) {
                  const audioSeg = await fetchArrayBuffer(variant.audio.segmentUrls[i], abortController.signal);
                  if (isCancelled || ms.readyState !== "open") break;
                  await appendBufferAsync(audioSb, audioSeg);
                }
              }

              if (!isCancelled && ms.readyState === "open") {
                ms.endOfStream();
              }
            } catch (err) {
              if (!isCancelled) {
                console.warn("[Decky Trailers] Error streaming DASH segments", err);
              }
              reject(err);
            }
          }, { once: true });
        });

        return;
      }

      // 3. Fallback: video.src directly with dash or hls if native CEF can play it
      if (trailer.dashH264) {
        video.src = trailer.dashH264;
        video.load();
      } else if (trailer.hls) {
        video.src = trailer.hls;
        video.load();
      }
    } catch (err) {
      if (!isCancelled) {
        console.warn("[Decky Trailers] Playback initialization error", err);
        // Fallback to end cycle
        onEnded();
      }
    }
  })();

  return {
    video,
    cleanup,
  };
}
