# Decky Trailers 🎬

A **Decky Loader** plugin (compatible with **Bazzite**, SteamOS, and Steam Deck) that replaces the static **Hero** artwork on a game's library page with its official Steam store trailer.

---

## ✨ Features

- **Smooth Hero Cross-Fade**: When you navigate to a game's page, the first **2 seconds** show the static Hero art (or your custom SteamGridDB hero). It then seamlessly fades into the game's trailer.
- **Single Playback**: When the trailer finishes playing, it gently fades back into the Hero artwork and **stays that way until reset** (when you browse to another game and come back).
- **Graceful Fallback**: If no trailer is found on the game's store page (or for non-Steam shortcuts without store media), your standard Hero artwork remains displayed untouched.
- **SteamGridDB-Style Trailer Switcher**:
  - **Context Menu Integration**: Press **Options / Menu** on any game card or page and select **"Change Trailer..."** (just like SteamGridDB's "Change Artwork...").
  - **Quick Access Menu**: Open Decky Loader Quick Access -> *Decky Trailers* -> click **"Change Trailer: [Game Name]"**.
  - **Gamepad-Friendly Selector**: Browse all available trailers from the Steam store with 16:9 thumbnail previews, test play them, and set your favorite with a single click.
  - **Quick Presets**: Easily switch back to **Automatic (First store trailer)** or select **Disable Trailer (Hero only)** on a per-game basis.
- **Performance & Battery Friendly**:
  - Lightweight adaptive video streaming (DASH/HLS/MP4) using native HTML5 and `MediaSource`.
  - Automatically suspends video decoding when launching a game so zero CPU/battery is consumed while playing.
  - Optional audio toggle (muted by default so sound never blares unexpectedly, with volume controls in the Quick Access panel).

---

## 🚀 Installation

### Method 1: Install via Developer Mode URL (Easiest)

Once you push this project to GitHub and tag a release (or use your pre-built release zip URL):

1. On your Steam Deck / Bazzite device, open the **Decky Loader menu** (`...` button).
2. Go to **Decky Settings** (the gear icon at the top of the Decky menu).
3. Under **General**, scroll down to **Developer** and make sure **Developer Mode** is turned **ON**.
4. In the Developer menu, choose **Install plugin from URL** (or **Install from URL**).
5. Paste your release ZIP URL:
   ```
   https://github.com/LennartDV/decky-trailers/releases/latest/download/decky-trailers.zip
   ```
6. Press **Install**. Decky Loader will download, extract, and start **Decky Trailers** immediately!

---

### Method 2: Manual Installation on Bazzite / SteamOS

If you want to test the plugin directly on your device before creating a GitHub release:

1. Build the zip file locally:
   ```bash
   npm run package
   ```
2. Transfer `decky-trailers.zip` to your Steam Deck / Bazzite machine (e.g. via SSH, Warpinator, USB drive, or KDE Connect).
3. On your Bazzite machine / Steam Deck, extract the folder into Decky's plugins folder:
   ```bash
   # Unzip into the plugins directory
   sudo unzip -o decky-trailers.zip -d /home/deck/homebrew/plugins/
   
   # Restart Decky Loader service to load the new plugin
   sudo systemctl restart plugin_loader
   ```
*(Note: If your user is not `deck`, replace `/home/deck/` with your user's home folder, e.g. `/home/bazzite/`)*.

---

## 🛠️ Setting Up Your GitHub Repository & Automated Releases

To host this add-on on GitHub so you have a direct link for Developer Mode:

1. Create a new repository on [GitHub](https://github.com/new) (e.g., `decky-trailers`).
2. In your local folder (`Decky Trailers`), initialize and push:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Decky Trailers"
   git branch -M main
   git remote add origin https://github.com/LennartDV/decky-trailers.git
   git push -u origin main
   ```
3. To trigger an automated release with the installable ZIP:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The included GitHub Actions workflow (`.github/workflows/release.yml`) will automatically run, build the plugin, package `decky-trailers.zip`, and publish it under GitHub Releases!
5. Your install link will then be:
   ```
   https://github.com/LennartDV/decky-trailers/releases/latest/download/decky-trailers.zip
   ```

---

## 💻 Local Development

- **Build**:
  ```bash
  npm run build
  ```
- **Watch**:
  ```bash
  npm run watch
  ```
- **Typecheck**:
  ```bash
  npm run typecheck
  ```
- **Package Release Archive**:
  ```bash
  npm run package
  ```

---

## 📄 License

GPL-3.0-or-later. See [LICENSE](LICENSE) for details.
