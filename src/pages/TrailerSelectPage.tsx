import { FC, useEffect, useState } from "react";
import {
  ButtonItem,
  DialogButton,
  Focusable,
  Navigation,
  ScrollPanel,
  useParams,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { getChoice, setChoice, useSettingsVersion } from "../settings";
import { getTrailers, Trailer } from "../trailers";

export const TrailerSelectPage: FC = () => {
  const { appid: rawAppId } = useParams<{ appid: string }>();
  const appId = parseInt(rawAppId, 10);
  useSettingsVersion();

  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTrailerId, setPreviewTrailerId] = useState<number | null>(null);

  const appOverview = (window as any).appStore?.GetAppOverviewByAppID?.(appId);
  const gameTitle = appOverview?.display_name ?? `Game ${appId}`;
  const currentChoice = getChoice(appId);

  useEffect(() => {
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
    <div className="decky-trailers-page">
      <div className="decky-trailers-header">
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
        {/* Preset quick actions */}
        <div style={{ display: "flex", gap: "12px", padding: "16px 40px 0 40px" }}>
          <div
            style={{
              flex: 1,
              borderRadius: "4px",
              padding: "2px",
              background: currentChoice === undefined ? "rgba(46, 204, 113, 0.2)" : undefined,
              border: currentChoice === undefined ? "1px solid #2ecc71" : "1px solid transparent",
            }}
          >
            <ButtonItem
              layout="inline"
              onClick={() => selectTrailer(undefined, "Automatic (First Trailer)")}
            >
              {currentChoice === undefined ? "✓ Automatic (Active)" : "Set to Automatic (Store Default)"}
            </ButtonItem>
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: "4px",
              padding: "2px",
              background: currentChoice === "none" ? "rgba(231, 76, 60, 0.2)" : undefined,
              border: currentChoice === "none" ? "1px solid #e74c3c" : "1px solid transparent",
            }}
          >
            <ButtonItem
              layout="inline"
              onClick={() => selectTrailer("none", "Disabled (Hero Only)")}
            >
              {currentChoice === "none" ? "✓ Disabled (Active)" : "Disable Trailer (Hero Only)"}
            </ButtonItem>
          </div>
        </div>

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
              const isPreviewing = previewTrailerId === trailer.id;

              return (
                <div
                  key={trailer.id}
                  className={`decky-trailer-card ${isSelected ? "active" : ""}`}
                  tabIndex={0}
                >
                  <div className="decky-trailer-thumb-wrap">
                    {isPreviewing && (trailer.mp4 || trailer.webm || trailer.dashH264) ? (
                      <video
                        src={trailer.mp4 ?? trailer.webm ?? trailer.dashH264}
                        autoPlay
                        controls
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                      />
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
                        onClick={() => selectTrailer(trailer.id, trailer.name)}
                        style={{ flex: 1 }}
                      >
                        {isSelected ? "Selected" : "Use Trailer"}
                      </DialogButton>
                      <DialogButton
                        onClick={() =>
                          setPreviewTrailerId(isPreviewing ? null : trailer.id)
                        }
                        style={{ minWidth: "80px" }}
                      >
                        {isPreviewing ? "Stop" : "Preview"}
                      </DialogButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </Focusable>
        )}
      </ScrollPanel>
    </div>
  );
};
