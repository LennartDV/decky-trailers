import json
import os
import asyncio

# The decky plugin module is located at decky-loader/plugin
import decky


SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")


class Plugin:
    """
    Small backend whose only job is persisting settings.

    Everything trailer-related (looking up the Steam store, playing the video)
    happens in the frontend; this keeps the backend free of network code.

    Settings layout:
    {
        "config":  { ...global options (delay, audio, quality...) },
        "choices": { "<appid>": <movie id> | "none" }   # per-game trailer choice
    }
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._data: dict = {"config": {}, "choices": {}}

    # ------------------------------------------------------------------ helpers
    def _load(self) -> None:
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                self._data["config"] = data.get("config") or {}
                self._data["choices"] = data.get("choices") or {}
        except FileNotFoundError:
            pass
        except Exception as e:  # corrupt file, keep defaults
            decky.logger.error(f"Could not read settings: {e}")

    def _save(self) -> None:
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        tmp = SETTINGS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2)
        os.replace(tmp, SETTINGS_FILE)

    # --------------------------------------------------------------- callables
    async def get_state(self) -> dict:
        """Returns the whole settings object (config + per-game choices)."""
        return self._data

    async def set_config(self, config: dict) -> bool:
        async with self._lock:
            self._data["config"] = config or {}
            self._save()
        return True

    async def set_choice(self, appid: int, choice) -> bool:
        """choice: a movie id (int), "none" to disable, or None for automatic."""
        async with self._lock:
            key = str(appid)
            if choice is None:
                self._data["choices"].pop(key, None)
            else:
                self._data["choices"][key] = choice
            self._save()
        return True

    async def reset_choices(self) -> bool:
        async with self._lock:
            self._data["choices"] = {}
            self._save()
        return True

    # ---------------------------------------------------------------- lifecycle
    async def _main(self):
        self._load()
        decky.logger.info("Decky Trailers backend loaded")

    async def _unload(self):
        decky.logger.info("Decky Trailers backend unloaded")

    async def _uninstall(self):
        pass
