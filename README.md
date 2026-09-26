# Tils & Twists — Sliding Puzzle PWA

A polished 100-level sliding tile puzzle game built as a **Progressive Web App** (PWA). Play in the browser or install it on your Android home screen like a native app.

## 🎮 Play Now

Open `index.html` in a browser, or serve the folder with any static file server:

```bash
npx serve . -l 5500
# then open http://localhost:5500
```

## 📱 Install on Android

1. Open the game URL in **Chrome on Android**
2. Tap the **"Install"** banner, or go to Chrome menu → **Add to Home Screen**
3. Plays fully **offline** after first load!

## 🧩 Features

- **100 levels** with 6 progressive difficulty zones
- **3 grid sizes**: 3×3 · 4×4 · 5×5
- **Tap, Swipe, or Arrow Keys** to move tiles
- **⭐⭐⭐ Star rating** per level based on move efficiency
- **Progress auto-saved** to localStorage
- Sound effects · Haptic feedback · Confetti on win
- Fully offline via Service Worker

## 📁 File Structure

```
tils_twists/
├── index.html      # Main app shell (4 screens)
├── style.css       # Design system — dark glassmorphism
├── app.js          # Game engine & routing
├── levels.js       # 100 level definitions
├── sw.js           # Service worker (offline caching)
├── manifest.json   # PWA manifest
├── icon-192.png    # App icon
└── icon-512.png    # App icon (large)
```

## 🎯 Difficulty Zones

| Zone | Levels | Grid |
|------|--------|------|
| 🟣 Baby Steps | 1–10 | 3×3 |
| 🔵 Getting Warm | 11–25 | 3×3 |
| 🟢 Rising Heat | 26–45 | 4×4 |
| 🟡 Hot Stuff | 46–70 | 4×4 |
| 🟠 Expert Zone | 71–85 | 5×5 |
| 🔴 Master Class | 86–100 | 5×5 |

## 🛠 Tech Stack

Pure HTML · Vanilla CSS · Vanilla JavaScript · Web Audio API · Canvas API · PWA (Service Worker + Web Manifest)

No frameworks. No dependencies. Just open and play.

---

Made with ❤️ by deepanshu-codr
