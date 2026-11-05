import { FC, useEffect, useRef, useState } from "react";
import {
  ButtonItem,
  DialogButton,
  Focusable,
  Navigation,
  ScrollPanel,
  useParams,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { getChoice, setChoice, useConfig, useSettingsVersion } from "../settings";
import { getTrailers, Trailer } from "../trailers";
import { playTrailer } from "../player";

const InlinePreview: FC<{ trailer: Trailer }> = ({ trailer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const config = useConfig();

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const session = playTrailer(
      el,
      trailer,
      { ...config, audio: true },
      () => {}
    );
    return () => {
      session.cleanup();
    };
  }, [trailer, config]);

  return (
    <video
      ref={videoRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
};

export const TrailerSelectPage: FC = () => {
  const { appid: rawAppId } = useParams<{ appid: string }>();
  const appId = parseInt(rawAppId, 10);
  useSettingsVersion();

  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const appOverview = (window as any).appStore?.GetAppOverviewByAppID?.(appId);
  const gameTitle = appOverview?.display_name ?? (appId ? `Game ${appId}` : "Game");
  const currentChoice = getChoice(appId);

  useEffect(() => {
    if (!appId || isNaN(appId)) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getTrailers(appId)
      .then((res) => {
        if (active) {
          setTrailers(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appId]);

  const selectTrailer = async (choice: number | "none" | undefined, name: string) => {
    await setChoice(appId, choice);
    toaster.toast({
      title: gameTitle,
      body: `Set trailer: ${name}`,
      duration: 2000,
    });
  };

  return (
    <div className="decky-trailers-page-container">
      {/* Header bar */}
      <div className="decky-trailers-header-bar">
        <div>
          <div className="decky-trailers-title">{gameTitle}</div>
          <div className="decky-trailers-subtitle">Select which Steam store trailer to display in the Hero art</div>
        </div>
        <DialogButton
          onClick={() => {
            Navigation.NavigateBack();
          }}
        >
          Back
        </DialogButton>
      </div>

      <ScrollPanel>
        {/* Quick action presets */}
        <Focusable flow-children="horizontal" className="decky-trailers-quick-actions">
          <ButtonItem
            layout="inline"
            onClick={() => selectTrailer(undefined, "Automatic (First store trailer)")}
          >
            {currentChoice === undefined ? "✓ Automatic (Active)" : "Set to Automatic (Store Default)"}
          </ButtonItem>
          <ButtonItem
            layout="inline"
            onClick={() => selectTrailer("none", "Disabled (Hero Only)")}
          >
            {currentChoice === "none" ? "✓ Disabled (Active)" : "Disable Trailer (Hero Only)"}
          </ButtonItem>
        </Focusable>

        {loading ? (
          <div className="decky-trailers-empty">Loading trailers from Steam store...</div>
        ) : trailers.length === 0 ? (
          <div className="decky-trailers-empty">
            No trailers found on the Steam store page for this game. Standard Hero art will be displayed.
          </div>
        ) : (
          <Focusable flow-children="grid" className="decky-trailers-grid">
            {trailers.map((trailer, index) => {
              const isSelected =
                currentChoice === trailer.id || (currentChoice === undefined && index === 0);
              const isPreviewing = previewId === trailer.id;

              return (
                <Focusable
                  key={trailer.id}
                  className={`decky-trailer-card ${isSelected ? "active" : ""}`}
                  onActivate={() => selectTrailer(trailer.id, trailer.name)}
                >
                  <div className="decky-trailer-thumb-wrap">
                    {isPreviewing ? (
                      <InlinePreview trailer={trailer} />
                    ) : (
                      <img
                        className="decky-trailer-thumb"
                        src={trailer.thumbnail}
                        alt={trailer.name}
                        loading="lazy"
                      />
                    )}
                    {isSelected && <div className="decky-trailer-badge">Active</div>}
                  </div>

                  <div className="decky-trailer-card-body">
                    <div className="decky-trailer-card-title">{trailer.name}</div>
                    <div className="decky-trailer-card-actions">
                      <DialogButton
                        onClick={(e) => {
                          e.stopPropagation();
                          selectTrailer(trailer.id, trailer.name);
                        }}
                        style={{ flex: 1 }}
                      >
                        {isSelected ? "Selected" : "Use Trailer"}
                      </DialogButton>
                      <DialogButton
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewId(isPreviewing ? null : trailer.id);
                        }}
                        style={{ minWidth: "80px" }}
                      >
                        {isPreviewing ? "Stop" : "Preview"}
                      </DialogButton>
                    </div>
                  </div>
                </Focusable>
              );
            })}
          </Focusable>
        )}
      </ScrollPanel>
    </div>
  );
};
