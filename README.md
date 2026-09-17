# Ashgrove Manor

A browser survival horror game in the style of Resident Evil 1&ndash;3: fixed camera
angles, deliberate movement, scarce ammunition, locked doors and a couple of
puzzles standing between you and the way out.

It is a static site &mdash; no server, no build step, no external asset downloads &mdash;
so it runs straight from GitHub Pages.

**It is a PC game.** Keyboard only, on a monitor: every camera angle is composed
wide, the HUD assumes room around the frame, and every menu is driven with the
arrow keys. There are no touch controls. In a window smaller than 900 &times; 520
the game holds and asks for more room rather than present a broken frame; press
`F11` or use the FULLSCREEN button on the title screen.

## Play

Open `index.html` through any static web server:

```sh
npx http-server -p 8080 -c-1
# then visit http://localhost:8080
```

Opening the file directly with `file://` will not work: the game uses ES modules.

## Controls

Movement is **tank controls**, as in the games this is modelled on: left and
right turn you on the spot, forward and back move along whatever direction you
are facing. Your input never changes meaning when the camera cuts.

Input is **digital**: every direction is fully on or fully off. Holding forward
and a turn together walks a curve.

| Key | Action |
| --- | --- |
| `W` / `Up` | Walk forward |
| `S` / `Down` | Back away, slowly |
| `A` `D` / `Left` `Right` | Turn on the spot |
| `Shift` | Hold to run |
| `Shift` + `S` | Quick turn &mdash; spin 180&deg; |
| `E` / `Enter` | Examine, take, open doors, advance dialogue |
| hold `Space` | Raise your weapon; it locks on to the nearest target |
| `J` / `X` / `Ctrl` | Fire or swing while the weapon is up |
| `Q` | Switch between handgun and knife |
| `I` / `Tab` | Inventory, documents and status |
| `Esc` | Status screen, and back out of any menu |
| `F11` | Fullscreen |

Aiming is **held**, not latched: the weapon is up for as long as `Space` is
down, so you can never be left standing rooted wondering why you will not walk.
While it is up you are rooted and left/right swings the body slowly, which is
the trade the whole combat system is built around.

### Menus

Every screen &mdash; title, inventory, storage trunk, keypad, breaker array,
death and ending &mdash; is navigated with the arrow keys and `Enter`, and `Esc`
backs out. The mouse works too, and moving it takes the keyboard cursor with it
so there are never two highlights on screen at once.

The cursor moves geometrically rather than in DOM order: from where it is, it
takes the nearest control that actually lies in the direction pressed and
shares that row or column, which makes the item grid behave like a grid.
Greyed-out entries are skipped, but they still mark where the next row of
controls sits &mdash; that is how CLOSE stays reachable straight down from the
inventory grid when it is the only button left enabled. Running off the end of
a row or a column wraps round to the other end of that same line.

On the keypad you can simply type the code on the number row.

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
| `src/ui.js` | HUD, every overlay screen, and the keyboard cursor that drives them. |
| `src/input.js` | Keyboard: held keys for movement, edge-triggered actions for the game, and a separate repeating stream for menu navigation. |

### Fixed cameras

Each room declares camera angles with a zone rectangle. When the player walks
into a zone the camera cuts to that angle. Because movement is tank style and
therefore relative to the character rather than the view, a cut mid-stride
cannot reverse your input &mdash; which is exactly why the games this imitates
used these controls in the first place.

Angles are composed at a reference aspect of 1.78, which is what a monitor is.
Rather than let the window shape change what a shot contains, the vertical
field of view is derived from a horizontal one that is clamped: narrower
windows widen vertically so the composed width still fits, wider ones show some
extra, and past 2.1 the widening stops &mdash; otherwise a 21:9 ultrawide splays
every room out into a fish-eye.

### Lighting

There are no shadow maps. Rooms are lit with a handful of point lights plus
blob shadows under each actor, and the scene renders to an offscreen target
that the post pass tone maps. Three.js skips its own tone mapping and colour
encoding when rendering to a render target, so `postfx.js` does both itself.

The render buffer is capped at a device pixel ratio of 2: past that it is four
times the pixels for very little gain once the grain and the vignette are on
top of the image.

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
