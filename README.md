# Ashgrove Manor

A browser survival horror game in the style of Resident Evil 1&ndash;3: fixed camera
angles, deliberate movement, scarce ammunition, locked doors and a couple of
puzzles standing between you and the way out.

It is a static site &mdash; no server, no build step, no external asset downloads &mdash;
so it runs straight from GitHub Pages and works on a phone.

## Play

Open `index.html` through any static web server:

```sh
npx http-server -p 8080 -c-1
# then visit http://localhost:8080
```

Opening the file directly with `file://` will not work: the game uses ES modules.

## Controls

| Desktop | Touch | Action |
| --- | --- | --- |
| `W A S D` / arrows | drag the left half of the screen | Move (relative to the camera) |
| `Shift` | push the stick all the way | Run |
| `E` / `Enter` | **ACT** | Examine, take, open doors, advance dialogue |
| hold `Space` | hold **AIM** | Raise your weapon; it locks on to the nearest target |
| `J` / `X` | **FIRE** | Shoot or swing |
| `Q` | &mdash; | Switch between handgun and knife |
| `I` / `Tab` | **BAG** | Inventory, documents, status |
| `Esc` | &mdash; | Status screen |

Save at the typewriter in the Keeper's Office. Progress is stored in
`localStorage`, so it survives a reload but lives only in that browser.

## The game

Nine rooms: Entrance Hall, Keeper's Office (save room), Dining Hall, Scullery,
Utility Room, Main Corridor, Library, Study and the Cellar.

Two puzzles:

1. **The wall safe.** Three portraits in the Dining Hall each carry a number of
   painted candles. A note in the Library tells you what order to read them in.
   The safe in the Study holds the generator's power cell.
2. **The breaker array.** Six cross-wired relays in the Utility Room &mdash;
   throwing one also throws the switches on either side of it. All six lamps
   must read green before the cellar's security door releases.

Two enemy types: the **Shambler** (slow, takes three handgun rounds, hits hard
at arm's length) and the **Crawler** (fast, fragile, lunges from a distance).
There are nine of them and about sixty rounds of ammunition, so running past
one is often the better answer.

## How it is built

Everything is generated at runtime. There are no image, model or audio files in
this repository &mdash; the only third-party code is a vendored copy of three.js.

| File | Responsibility |
| --- | --- |
| `src/textures.js` | Procedural textures. Value-noise fBm plus canvas drawing produces the wallpaper, wood, marble, tile, concrete, rust, paintings and blood decals. |
| `src/world.js` | `Builder` &mdash; room shells with door openings, furniture helpers, and the XZ rectangle list used for collision. Colliders are flagged `tall` (walls, shelves: block sight and bullets) or low (tables, crates: block movement only, so you can shoot across a table). |
| `src/rooms.js` | All nine rooms as data: geometry, fixed camera zones, doors, item placements, interactables and enemy spawns. |
| `src/actor.js` | Articulated low-poly figures built from boxes, with hand-written walk / shamble / aim / lunge poses. |
| `src/enemies.js` | Enemy state machines (sleep, wander, chase, attack, stagger, dead). |
| `src/items.js` | Item definitions, inventory icons drawn to canvas, and world pickup meshes. |
| `src/postfx.js` | Fullscreen composite: ACES tone mapping, sRGB encode, colour grade, chromatic fringe, vignette and film grain. |
| `src/game.js` | Room loading, player controller, collision, combat, progression, saves. |
| `src/ui.js` | HUD and every overlay screen (inventory, documents, keypad, breakers, death, ending). |
| `src/input.js` | Keyboard plus a virtual stick and touch buttons. |

### Fixed cameras

Each room declares camera angles with a zone rectangle. When the player walks
into a zone the camera cuts to that angle. Movement stays relative to the
camera basis in use when the stick was pushed, so a camera cut mid-stride does
not send you back the way you came.

Angles are composed for a widescreen view. On a narrow screen the camera widens
its vertical field of view to preserve the horizontal framing rather than
cropping it, so portrait phones still see the whole shot.

### Lighting

There are no shadow maps. Rooms are lit with a handful of point lights plus
blob shadows under each actor, and the scene renders to an offscreen target
that the post pass tone maps. Three.js skips its own tone mapping and colour
encoding when rendering to a render target, so `postfx.js` does both itself.

## Deploying

`.github/workflows/deploy.yml` publishes the site on every push to `main`.

One manual step is needed first, and only once: open **Settings &rarr; Pages** and
set **Source** to *GitHub Actions*. The workflow's token is not allowed to
create the Pages site itself, so until this is done every run fails at
`configure-pages` with `Get Pages site failed ... Not Found`. Afterwards,
re-run the workflow from the Actions tab (or push any commit) and the site
goes live at `https://<owner>.github.io/survival-horror/`.

Because there is no build step, serving the repository root from a branch
works just as well if you would rather not use Actions at all.
