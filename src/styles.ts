export const PLUGIN_STYLES = `
/* Decky Trailers Hero Video Overlay */
.decky-trailer-host {
  position: relative !important;
  overflow: hidden !important;
}

.decky-trailer-video {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  pointer-events: none !important;
  opacity: 0 !important;
  transition: opacity var(--decky-trailer-fade-duration, 1s) ease-in-out !important;
  z-index: 1 !important;
  background: #000 !important;
}

.decky-trailer-video.decky-trailer-visible {
  opacity: 1 !important;
}

/* Ensure Game Title Logo stays above the trailer video */
.decky-trailer-host [class*="TitleImageContainer"],
.decky-trailer-host [class*="TitleLogo"],
.decky-trailer-host [class*="SVGTitle"],
.decky-trailer-host [class*="TextNameSpace"] {
  position: relative !important;
  z-index: 3 !important;
}

/* Trailer Selection Page (SteamGridDB style) */
.decky-trailers-page {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: var(--gpSystemDarkestGrey, #0e141b);
  color: #fff;
  display: flex;
  flex-direction: column;
  z-index: 999;
  box-sizing: border-box;
}

.decky-trailers-header {
  padding: 24px 40px 16px 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.decky-trailers-title {
  font-size: 26px;
  font-weight: 700;
  color: #fff;
}

.decky-trailers-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
}

.decky-trailers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 24px 40px 60px 40px;
  overflow-y: auto;
}

.decky-trailer-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.decky-trailer-card:focus,
.decky-trailer-card.gpfocus {
  border-color: #1a9fff;
  transform: scale(1.02);
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.decky-trailer-card.active {
  border-color: #2ecc71;
}

.decky-trailer-thumb-wrap {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  background: #111;
  overflow: hidden;
}

.decky-trailer-thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.decky-trailer-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #2ecc71;
  color: #000;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.decky-trailer-card-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
}

.decky-trailer-card-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.decky-trailer-card-actions {
  display: flex;
  gap: 8px;
}

.decky-trailers-empty {
  padding: 60px 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
}
`;

export function injectStyles(): () => void {
  const ID = "decky-trailers-styles";
  let el = document.getElementById(ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = ID;
    el.textContent = PLUGIN_STYLES;
    document.head.appendChild(el);
  }
  return () => {
    el?.remove();
  };
}
