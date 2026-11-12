# Roblox from an iPhone, $0, no Roblox Studio

A complete, tested pipeline for making Roblox games from an iPhone with Claude,
without a Windows or Mac computer and without paying anything.

```
 iPhone                      cloud (free)                               Roblox (free)
┌──────────────┐   prompt   ┌──────────────────────────────┐   API    ┌──────────────────┐
│ Claude app / │ ─────────▶ │ Claude Code session (Linux)  │          │ your experience  │
│ claude.ai/   │            │  writes Luau, builds .rbxl,  │          │                  │
│ code         │ ◀───────── │  tests, renders previews     │          │                  │
└──────────────┘  previews  └──────────────┬───────────────┘          │                  │
                                 git push  ▼                          │                  │
┌──────────────┐  logs,     ┌──────────────────────────────┐ publish  │                  │
│ GitHub app   │ ◀───────── │ GitHub Actions (free Linux)  │ ───────▶ │ new version live │
│              │  .rbxl     │  lint, build, test, preview, │ run Luau │ smoke test runs  │
└──────────────┘            │  publish, cloud smoke test   │ ───────▶ │ on Roblox server │
┌──────────────┐            └──────────────────────────────┘          │                  │
│ Roblox app   │ ◀─────────────────── play / playtest ─────────────── │                  │
└──────────────┘                                                       └──────────────────┘
```

## Why not a remote Windows desktop with Roblox Studio?
Checked and rejected for the "$0 forever, no card" rule:

| Option | Why it fails |
|---|---|
| Oracle Cloud Always Free | Sign-up asks for a credit/debit card; Windows images are not Always Free. |
| AWS / Azure / Google Cloud free tiers | Card required; Windows ends up billed. |
| GitHub Codespaces | Free monthly quota, but Linux containers only: no Windows, no GPU, no desktop. |
| GitHub Actions Windows runners as a desktop | Jobs stop after 6 h and are wiped; needs a third-party tunnel; GitHub's terms limit Actions to building/testing/deploying the repo's project. |
| Roblox Studio on Linux (Wine/Vinegar) | Unofficial; needs a desktop and GPU the free Linux machines do not have. Not tested, not claimed. |
| Roblox Studio on iPhone/iPad/web | Does not exist. |
| Official Roblox Studio MCP / Claude computer use | Both need Studio running on a real Windows/Mac desktop. |

So this project replaces Studio with code: Claude writes everything in Luau,
**Rojo** (the standard Roblox file-sync tool) turns the files into a place file,
and **Roblox Open Cloud** (Roblox's official free web API) publishes it and runs
Luau on Roblox's own servers to check it.

## What works / what is missing
Works: Luau scripts, maps/obbies/levels built in code, parts, lighting, effects,
GUIs, tween animations, physics, remotes, leaderstats, publishing, a cloud test on
Roblox servers, playtesting on your iPhone, preview images, versioned saves (git +
Roblox version history + downloadable `.rbxl`).

Missing compared with Studio: no drag-and-drop editor, no Studio "Play" button
(you playtest the published game in the Roblox app), no Animation Editor
(animations are written as tweens / code), no Toolbox, no terrain brushes, no
Studio Assistant / Studio MCP. Mesh and image uploads would need extra API work.

---

## Setup from the iPhone (one time, about 30 min)

### 1. Accounts (all free, no card)
1. **Roblox**: install *Roblox* from the App Store and sign in (or create an account).
2. **GitHub**: install *GitHub* from the App Store, sign in. Do not add a payment method:
   with none on file GitHub cannot charge you; free quotas simply stop.
3. **Claude**: you already have it. Claude Code is in the Claude app (Code tab) or at
   https://claude.ai/code in Safari.

### 2. Create the Roblox experience (THE step to check first)
1. In Safari open https://create.roblox.com/dashboard/creations and sign in.
2. Look for **Create Experience** / **+ Create**. If it creates a game on the web, open it and continue.
3. If the button only offers to open Studio: check whether your account already has a place
   listed under Creations (older accounts got one automatically). Any existing place you own works,
   because the pipeline overwrites its contents.
4. If you have no place at all and the web cannot create one, the only $0 fix is to use any
   Windows/Mac once (school, library, friend) for 2 minutes: install Studio from
   https://create.roblox.com, open *Baseplate*, *File > Publish to Roblox*. After that you never
   need Studio again.

### 3. Copy the two ids
1. On the Creations page tap your experience's **⋯** menu, then **Copy Universe ID**. Paste it in Notes.
2. Open the experience, then **Places**, then tap the start place's **⋯**, then **Copy Asset ID** (this is the Place ID).
   Paste it in Notes too.

### 4. Create the Open Cloud API key (secret)
1. Safari: https://create.roblox.com/dashboard/credentials, then **Create API Key**.
2. Name: `github-publish`.
3. **Access permissions**, add API system **universe-places**, pick your experience, tick **write**.
4. Add API system **luau-execution-sessions**, pick your experience, tick **write**.
5. **Security**: Accepted IP addresses `0.0.0.0/0` (GitHub's machines change IP; the key only reaches
   this one experience). Set an **expiration date** (e.g. 90 days).
6. **Save & Generate key**, then **Copy Key to Clipboard**. Do not paste it anywhere except step 5.

### 5. Put the project in its own GitHub repository
1. GitHub app: **+**, then **Create repository**, name `roblox-game`, Private, tick *Add a README*.
2. Claude app, Code tab: start a session on `roblox-game` and send:
   > Copy the folder `roblox-starter` from branch `claude/animation-skills-setup-fowxdi` of
   > `sawaz135/vertical` into the root of this repo (keep `.github/`), commit and push to `main`.
3. Safari: https://github.com/YOUR-NAME/roblox-game/settings/secrets/actions
   - **New repository secret**: name `ROBLOX_API_KEY`, value = paste the key.
   - Tab **Variables**, then **New repository variable**: `ROBLOX_UNIVERSE_ID` = universe id.
   - **New repository variable**: `ROBLOX_PLACE_ID` = place id.

### 6. First run and full test
1. Safari: repo, **Actions**, **Roblox**, **Run workflow**, then **Run workflow**.
2. GitHub app: Actions tab, open the run. The first run takes about 12 minutes (it compiles the tools once,
   then they are cached and runs take ~3 min). Every step must be green:
   lint, build, offline tests, previews, **Publish to Roblox** (`ok: place version N`),
   **Cloud smoke test** (`SMOKE OK: ... parts`).
3. At the bottom of the run (Safari), **Artifacts**: download `place-…` to see
   `preview-hero.png` and keep `place.rbxl` (your save file).
4. Playtest: Safari, `https://www.roblox.com/games/PLACE_ID`, **Play** (opens the Roblox app).
   You should see the neon night course, a STAGE 0 / 12 bar at the top, moving platforms,
   red spinning lasers, a CHECKPOINT pop-up at each glass pad and a BEYOND reveal at the gold gate.
5. Errors in game: type `/console` in the chat to open the Developer Console (Server tab shows
   `[Beyond] course built: 100 parts ...`).

## Daily use
In the Claude app (Code tab, `roblox-game` repo), describe what you want:
> Add a lava stage between checkpoints 6 and 7 with rising lava, keep every jump possible,
> run the tests, send me the preview images, then push to main.

Claude edits the Luau, runs the tests, sends you the previews; the push publishes and
cloud-tests automatically; you play it in the Roblox app.

## Commands (what Claude and the workflow run)
```bash
cargo install rojo --version 7.7.1 --locked      # once
cargo install selene --version 0.31.0 --locked   # once
cargo install lune --version 0.11.1 --locked     # once

mkdir -p build
rojo build default.project.json -o build/place.rbxl
selene generate-roblox-std && selene src tests
lune run tests/lune/run.luau build/place.rbxl

# needs ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, ROBLOX_PLACE_ID in the environment
python3 tools/roblox_cloud.py publish build/place.rbxl
python3 tools/roblox_cloud.py run tests/smoke.luau
```

## Troubleshooting
| Symptom | Fix |
|---|---|
| Publish step skipped | The `ROBLOX_API_KEY` secret is missing, or you pushed to a branch other than `main` (use *Run workflow*). |
| `HTTP 401` | Key wrong/expired: generate a new one, replace the secret. |
| `HTTP 403` | Key lacks `universe-places` / `luau-execution-sessions` write for this experience, or IP list is not `0.0.0.0/0`. |
| `HTTP 404` | Universe/Place id swapped or wrong. Place id is the number in `roblox.com/games/<id>`. |
| Cloud smoke test `FAILED` | The log shows the Luau error and line; paste it to Claude. |
| Offline test `FAIL ... gap` | A jump is too long; ask Claude to fix the layout. |
| Game shows old version | Leave and rejoin; old servers keep the old version. |
| "Experience is private" | You can play your own private game; to let friends in, set it Public in the dashboard (Roblox asks a maturity questionnaire first). |
| Actions quota | Private repos get 2,000 free minutes/month (~600 runs). Make the repo public for unlimited minutes, or run less often. |

## Security
- The API key lives only in GitHub's encrypted secrets. It never appears in files, logs or chat.
- The key can only reach one experience, only to publish and run Luau, and it expires.
- Only official sources: Rojo, Selene and Lune from crates.io, three.js and Playwright from npm,
  GitHub's own `actions/*`, Roblox's own API. No unknown executables.
