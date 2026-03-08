# devday

> your day, version controlled.

A minimal daily planner built for developers. No Notion, no Jira — just a clean tab that helps you ship.

**Live →** [thomazcortez.github.io/devday](https://thomazcortez.github.io/devday)

---

## features

- **list + kanban views** — switch between a clean list and a full drag-and-drop kanban board
- **pomodoro timer** — floating, draggable 25/5 widget with ring progress and session tracking
- **due dates** — custom calendar picker, overdue badges, and smart sidebar filters
- **real-time sync** — Firebase Realtime Database keeps tasks in sync across all your devices
- **auth** — sign in with Google, Email/Password, or continue as a Guest
- **live weather** — Nothing OS-inspired dot-matrix widget using Open-Meteo API
- **mobile ready** — responsive layout with drawer sidebar, touch drag support

---

## pages

| File | Route | Description |
|---|---|---|
| `index.html` | `/devday/` | Landing page |
| `login.html` | `/devday/login.html` | Authentication |
| `app.html` | `/devday/app.html` | The planner |

---

## stack

- Vanilla JS, HTML, CSS — zero build tools, zero dependencies
- [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) — sync & persistence
- [Firebase Auth](https://firebase.google.com/products/auth) — Google, Email/Password, Anonymous
- [Open-Meteo API](https://open-meteo.com/) — free weather data
- [GitHub Pages](https://pages.github.com/) — hosting
- [JetBrains Mono](https://www.jetbrains.com/legalforms/fonts/) — the only font that matters

---

## firebase setup

If you're forking this and want your own Firebase backend:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** (start in locked mode)
3. Enable **Authentication** → sign-in methods: Google, Email/Password, Anonymous
4. Add your domain to **Authentication → Authorized domains**
5. Set database rules:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

6. Replace the Firebase config object in `login.html` and `app.html` with your own project credentials

---

## local development

No build step needed — just open the files:

```bash
git clone https://github.com/thomazcortez/devday
cd devday

# Option A: VS Code Live Server (recommended)
# Install the Live Server extension, right-click index.html → Open with Live Server

# Option B: Python
python3 -m http.server 8080
# then open http://localhost:8080
```

> Note: Firebase Auth requires a proper domain — `localhost` works, but opening `file://` directly won't.

---

## deploy

This project deploys automatically to GitHub Pages from the root of the `main` branch.

```bash
git add .
git commit -m "update"
git push origin main
# live in ~30 seconds at thomazcortez.github.io/devday
```

---

## author

Built by **Thomaz Cortez** — [github.com/thomazcortez](https://github.com/thomazcortez)

---

*free. no ads. no tracking. just your tasks.*
