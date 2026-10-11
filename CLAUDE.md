# Wallflip

Desktop app (Electron, plain JavaScript, no build step) to browse Wallhaven wallpapers that fit your monitors, set them per monitor or on all, and rotate them on a schedule.

## Working with the user

- The user is not a developer. Explain things in plain words, no jargon.
- Never ship an ugly workaround (for example silently rewriting a search word). Find the proper solution, or say it isn't possible and suggest a real alternative.
- Wallhaven is the only wallpaper source, on purpose.
- After every change, start the app (`npm start`) so the user can try it.

## Screenshots must stay current

`docs/screenshots/` holds a picture of every screen, and the README shows them.

- After **every** change that touches what you see in the app, run `npm run screenshots` and commit the updated pictures together with the change.
- Look at the new pictures before committing. If a screen was added, renamed or removed, update `scripts/screenshots.js` and the README to match.
- The script uses a temporary profile with demo data (`%TEMP%/wallflip-screenshots`), so it never touches the user's own favorites, history or rotations, and it never changes the real wallpaper.

## Project layout

- `main.js`: app window, tray, background start, and the bridge to the page (`ipcMain` handlers).
- `preload.js`: the functions the page may call (`window.wallflip.*`).
- `src/wallpaper.js`: monitors, Wallhaven search and details, downloading and setting wallpapers, history, favorites.
- `src/rotations.js`: rotation storage and the scheduler (checks every 20 seconds).
- `scripts/set-wallpaper.ps1`: sets the wallpaper on one or all monitors on Windows (Windows' own desktop wallpaper interface). Other systems use the `wallpaper` package.
- `renderer/`: the interface. `app.js` (shared helpers, tabs, preview), `discover.js` (search and endless scrolling), `library.js` (favorites, history), `rotations.js` (rotations list and editor), `styles.css`.
- `assets/logo.svg` is the logo. `npm run icon` turns it into `assets/icon.png`.
- User data lives in the Electron profile folder: `history.json`, `favorites.json`, `rotations.json`. Downloaded wallpapers go to `Pictures/Wallflip`.

## Conventions

- Match the existing style: small functions, `$()` and `el()`/`button()` helpers in the page, no frameworks.
- Sizes in `styles.css` are in `rem`; the root font size grows with the window so everything scales together. Reuse the CSS variables and existing classes (`.btn`, `.segmented`, `.chip`, `.switch`, `.empty`, `.pageHead`) instead of adding one-off styles.
- Inline `style` attributes are blocked by the page security policy; put styles in `styles.css`.
- Files use LF line endings (`.gitattributes`).
- Run `npm run check` before committing.

## Commits and releases

- Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `chore:`, and so on. Pull request titles follow the same rule.
- Only commit, push or merge when the user asks.
- Releases are automatic with release-please: every push to `main` updates a "release" pull request with the next version (semantic versioning) and changelog. Merging that pull request creates the GitHub release, and the workflow then builds and attaches:
  - `Wallflip-Setup.exe` (Windows installer)
  - `Wallflip-mac.dmg` (macOS, unsigned)
  - `Wallflip-linux.AppImage` (Linux)
- The README links straight to these file names, so keep them stable.
