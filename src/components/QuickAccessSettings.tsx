import { FC } from "react";
import {
  ButtonItem,
  Navigation,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
} from "@decky/ui";
import {
  countChoices,
  getLastAppId,
  resetChoices,
  updateConfig,
  useConfig,
  useSettingsVersion,
} from "../settings";

export const QuickAccessSettings: FC = () => {
  const config = useConfig();
  useSettingsVersion();
  const lastAppId = getLastAppId();
  const customChoicesCount = countChoices();

  const appOverview = lastAppId
    ? (window as any).appStore?.GetAppOverviewByAppID?.(lastAppId)
    : undefined;
  const gameTitle = appOverview?.display_name ?? (lastAppId ? `Game ${lastAppId}` : undefined);

  return (
    <>
      <PanelSection title="Current Game">
        {lastAppId ? (
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => {
                Navigation.Navigate(`/decky-trailers/${lastAppId}`);
                Navigation.CloseSideMenus();
              }}
            >
              {gameTitle ? `Change Trailer: ${gameTitle}` : "Change Trailer for Current Game"}
            </ButtonItem>
          </PanelSectionRow>
        ) : (
          <PanelSectionRow>
            <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)", padding: "4px 0" }}>
              Navigate to any game page in your library to select its trailer.
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Playback Settings">
        <PanelSectionRow>
          <ToggleField
            label="Enable Trailers"
            description="Replace hero artwork with game trailers"
            checked={config.enabled}
            onChange={(val) => updateConfig({ enabled: val })}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <SliderField
            label="Initial Hero Delay"
            description="Seconds the static hero is shown before fading in"
            value={config.heroDelay}
            min={0}
            max={10}
            step={1}
            notchCount={10}
            notchTicksVisible
            valueSuffix="s"
            showValue
            onChange={(val) => updateConfig({ heroDelay: val })}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <SliderField
            label="Fade Duration"
            description="Length of cross-fade transition"
            value={config.fadeDuration}
            min={0.5}
            max={3.0}
            step={0.5}
            valueSuffix="s"
            showValue
            onChange={(val) => updateConfig({ fadeDuration: val })}
          />
        </PanelSectionRow>

        <PanelSectionRow>
          <ToggleField
            label="Trailer Audio"
            description="Play audio during the trailer"
            checked={config.audio}
            onChange={(val) => updateConfig({ audio: val })}
          />
        </PanelSectionRow>

        {config.audio && (
          <PanelSectionRow>
            <SliderField
              label="Volume"
              value={config.volume}
              min={0}
              max={100}
              step={5}
              valueSuffix="%"
              showValue
              onChange={(val) => updateConfig({ volume: val })}
            />
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Management">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={customChoicesCount === 0}
            onClick={async () => {
              await resetChoices();
            }}
          >
            {customChoicesCount > 0
              ? `Reset Custom Choices (${customChoicesCount} saved)`
              : "No Custom Choices"}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
};
