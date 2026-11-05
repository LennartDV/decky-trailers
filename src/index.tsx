import { definePlugin, routerHook } from "@decky/api";
import { staticClasses } from "@decky/ui";
import { FaFilm } from "react-icons/fa";

import { loadState } from "./settings";
import { injectStyles } from "./styles";
import { HeroController } from "./heroController";
import { TrailerSelectPage } from "./pages/TrailerSelectPage";
import { QuickAccessSettings } from "./components/QuickAccessSettings";
import { contextMenuPatch, getLibraryContextMenu } from "./patches/contextMenuPatch";

export default definePlugin(() => {
  console.log("[Decky Trailers] Initializing...");

  // Load backend settings
  loadState();

  // Inject stylesheet for trailer transitions and selection page
  const removeStyles = injectStyles();

  // Register full-page route for trailer selection (matching SteamGridDB style)
  routerHook.addRoute("/decky-trailers/:appid", TrailerSelectPage, {
    exact: true,
  });

  // Patch context menu to add "Change Trailer..."
  const menuTarget = getLibraryContextMenu();
  const contextPatches = menuTarget ? contextMenuPatch(menuTarget) : null;

  // Start watching hero elements and handling fade transitions
  const heroController = new HeroController();
  heroController.start();

  return {
    name: "Decky Trailers",
    titleView: <div className={staticClasses.Title}>Decky Trailers</div>,
    icon: <FaFilm />,
    content: <QuickAccessSettings />,
    onDismount() {
      console.log("[Decky Trailers] Dismounting...");
      routerHook.removeRoute("/decky-trailers/:appid");
      contextPatches?.unpatch();
      heroController.stop();
      removeStyles();
    },
  };
});
