# Floor Planner

A browser-based floor planner. Sign in, draw a room in 2D with snapping,
sticky angles, and precise typed measurements, cut/measure walls, drop in
furniture/doors/windows (with resizable, wall-cutting doors and windows)
from a searchable catalog, walk around the result in 3D, retexture floors
and walls, and save/reload projects from a dashboard. Built with React +
Vite on top of a ported Blueprint3D engine (`src/blueprint3d`), with all data
(accounts, catalog, textures, uploads, saved projects) going through a small
API layer instead of local constants.

This document covers how the app is put together, how each feature works
under the hood, and how to extend it.

---

## Table of contents

1. [Getting started](#getting-started)
2. [Big picture](#big-picture)
3. [Authentication & dashboard](#authentication--dashboard)
4. [The API layer](#the-api-layer)
5. [Undo & redo](#undo--redo)
6. [The 2D floorplanner: snapping, sticky angles & typed lengths](#the-2d-floorplanner-snapping-sticky-angles--typed-lengths)
7. [CAD tools: cut and measure](#cad-tools-cut-and-measure)
8. [The 3D viewer](#the-3d-viewer)
9. [Rooms: naming, resizing, hover & focus](#rooms-naming-resizing-hover--focus)
10. [Items catalog (furniture, doors, windows) & precise door/window sizing](#items-catalog-furniture-doors-windows--precise-doorwindow-sizing)
11. [Boolean wall cuts (doors, windows & custom openings)](#boolean-wall-cuts-doors-windows--custom-openings)
12. [Textures](#textures)
13. [Projects (save / load / delete)](#projects-save--load--delete)
14. [The saved floorplan JSON](#the-saved-floorplan-json)
15. [Exporting a reference image + JSON](#exporting-a-reference-image--json)
16. [Settings & units](#settings--units)
17. [Design system & dark mode](#design-system--dark-mode)
18. [Project structure](#project-structure)
19. [How to extend things](#how-to-extend-things)
20. [Known limitations](#known-limitations)
21. [Troubleshooting](#troubleshooting)

---

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. `npm run build` produces a production build,
`npm run preview` serves it locally.

If you ever see Vite complain that a package "could not be resolved" after
pulling changes, your `node_modules` is stale relative to `package.json`:

```bash
rm -rf node_modules package-lock.json pnpm-lock.yaml
npm install
```

---

## Big picture

There are three layers to this codebase:

- **`src/blueprint3d/`** — the floorplanning engine. Plain TypeScript, no
  React. Owns the 2D canvas drawing tool, the 3D scene (Three.js), the
  wall/corner/room data model, and the item factory that turns a `.glb` URL
  into a piece of furniture, a door, or a window in the scene.
- **`src/pages/PlannerPage.jsx` + `src/components/`** — the floorplanner UI.
  Creates one `Blueprint3d` engine instance, wires its callbacks to React
  state, and renders panels/dialogs around it. The engine is
  framework-agnostic on purpose — see
  [How to extend things](#how-to-extend-things) if you ever want to reuse it
  outside React.
- **`src/App.jsx`** — the router shell. Sets up `<AuthProvider>` and the
  routes: public auth pages, and `/dashboard` + `/planner` behind
  `<ProtectedRoute>`. See [Authentication & dashboard](#authentication--dashboard).

The engine and the planner UI talk to each other through:

- **Imperative calls into the engine** (`blueprint3d.model.scene.addItem(...)`,
  `blueprint3d.floorplanner.setMode(...)`, etc.) — see `PlannerPage.jsx`.
- **Callbacks the engine fires**, subscribed once in `PlannerPage.jsx`'s
  bootstrap `useEffect` (item selected/unselected, wall/floor clicked, item
  loading/loaded/errored, live drawing-length/cut/measure updates). Each
  callback just calls a React `setState`.

Everything else — the item catalog, textures, saved projects, file uploads,
and authentication — flows through the API layer described next, not
through the engine.

**Lifecycle**: `PlannerPage.jsx`'s bootstrap effect constructs one
`Blueprint3d` and returns `() => blueprint3d.destroy()` as its cleanup.
That matters here specifically because of the router — navigating to
`/dashboard` (or anywhere else) unmounts `PlannerPage` for real, and without
that `destroy()` call the 3D render loop (`requestAnimationFrame`) would
keep rendering a detached scene forever, and the window/document listeners
each piece registers (resize, the 'F' focus key, 2D's typed-length capture)
would keep firing against elements that no longer exist — which is what a
`Canvas element not found` warning showing up after leaving the planner
means. `Blueprint3d.destroy()` / `Main.destroy()` / `Controls.destroy()` /
`Floorplanner.destroy()` each clean up exactly what their own constructor
registered — follow that pattern (store the bound handler, remove it in
`destroy()`) if you add a new `window`/`document`-level listener anywhere
in the engine.

**The 3D view specifically also needs its canvas removed on destroy, not
just its listeners.** Unlike the 2D view (which reuses the `<canvas
id="floorplanner-canvas">` React already renders), `Main`'s constructor
*creates* a `<canvas>` via `WebGLRenderer` and appends it into `#viewer`
itself (`main.ts`). If `destroy()` only stopped the render loop without also
removing that canvas and calling `renderer.dispose()`, a second `Main`
instance — which happens on every load in dev, since React StrictMode
deliberately mount→cleans up→remounts effects once to surface exactly this
kind of bug — would append a second canvas into the same container, and the
dead, frozen first one could end up the visible one, with the live one
stacked (and clipped) behind it. That's what "3D shows nothing" from a dead
canvas sitting on top looks like — fixed by having `Main.destroy()` remove
its own `renderer.domElement` from the DOM and dispose the renderer, so
each mount starts from a clean container.

---

## Authentication & dashboard

Routing is `react-router`, set up in `src/App.jsx`:

| Route | Access | Page |
|---|---|---|
| `/login`, `/signup`, `/forgot-password` | Guests only — redirects to `/dashboard` if already signed in (`GuestRoute`) | `LoginPage`, `SignupPage`, `ForgotPasswordPage` |
| `/reset-password?token=…` | Public (reached via an emailed link) | `ResetPasswordPage` |
| `/dashboard` | Signed-in only (`ProtectedRoute`) | `DashboardPage` — recent floorplans, stats, quick actions |
| `/planner` | Signed-in only (`ProtectedRoute`) | `PlannerPage` — the floorplanner itself (everything described below) |
| `/`, anything else | — | Redirects to `/dashboard` |

**Session state** lives in `src/contexts/AuthContext.jsx` (`AuthProvider` /
`useAuth()`), backed by `src/api/functions.js`'s `login` / `signup` /
`logout` / `fetchCurrentUser` / `loginWithGoogle` / `forgotPassword` /
`resetPassword` — the same axios + mock-backend pattern as everything else in
the app (see [The API layer](#the-api-layer)). A session is just a token
string in `localStorage` (`authToken`); `functions.js` attaches it to every
request as `Authorization: Bearer <token>` via an axios request interceptor,
so once a real backend exists, protecting the floorplan/item/texture
endpoints per-user is just reading that header server-side — nothing in the
frontend needs to change.

**Google sign-in** (`GoogleButton.jsx`, wired to `loginWithGoogle()`) is
currently a **mock**: it signs in a single demo "Google User" account via the
mock backend, so the rest of the app (protected routes, dashboard) is
buildable and testable end-to-end without real OAuth credentials. To wire up
the real thing:
1. Add a real client-side flow — e.g.
   [`@react-oauth/google`](https://www.npmjs.com/package/@react-oauth/google)
   or Google's own Identity Services script — to get an ID token in the
   browser.
2. Send that token to your backend's `/auth/google` endpoint (already called
   from `loginWithGoogle()` in `functions.js`) instead of the current
   no-argument mock call.
3. Have the backend verify the token with Google, create/find the user, and
   return `{ user, token }` in the same shape the mock does — see
   `mock.onPost(ENDPOINTS.AUTH_GOOGLE)` in `mockAdapter.js` for that shape.
4. Delete the mock handler once the real one's live.

**Forgot/reset password** is a standard two-step flow: `ForgotPasswordPage`
posts an email and always shows a generic "check your email" success state
(the mock backend intentionally responds `200` whether or not the email
matched an account, and logs the reset link to the browser console instead
of sending an email, so you can test the flow locally — search
`mockAdapter.js` for `[mock] Password reset link`). `ResetPasswordPage` reads
`?token=` from the URL and posts a new password.

**Route guards**: `ProtectedRoute.jsx` shows a spinner while the initial
session check (`AuthContext`'s mount effect) is in flight, then redirects to
`/login` if there's no user. `GuestRoute.jsx` does the inverse for the auth
pages. Both are plain wrapper components — nest a route's `element` inside
either one to change its access level.

**Dashboard → Planner handoff**: clicking "New floorplan" or opening a
project card on the dashboard doesn't manipulate an already-mounted planner
— there isn't one yet. Instead it navigates to `/planner` with React Router
navigation `state` (`{ newRoomType }` or `{ openFloorplanId }`), and
`PlannerPage`'s bootstrap effect checks `location.state` on mount to decide
what to load, then clears it (`navigate(..., { replace: true, state: null })`)
so browser-back doesn't repeat the action. `{ initialTab: 'projects' }` works
the same way for landing directly on the Projects tab.

## The API layer

**Nothing in the UI talks to a database directly.** Every furniture item,
door, window, texture, uploaded model/image, and saved project goes through
axios calls defined in `src/api/`:

- **`src/api/urls.js`** — every endpoint the app calls, in one place
  (`API_BASE_URL` + an `ENDPOINTS` map).
- **`src/api/functions.js`** — a shared axios instance (`apiClient`) plus one
  async function per endpoint: `fetchItems`, `createItem`, `deleteItem`,
  `fetchTextures`, `createTexture`, `deleteTexture`, `fetchTemplates`,
  `fetchTemplateByRoomType`, `fetchFloorplans`, `fetchFloorplanById`,
  `createFloorplan`, `updateFloorplan`, `deleteFloorplan`, `uploadModelFile`,
  `uploadTextureImage`, `uploadImage`, `uploadDataUrl`. **Components only ever
  import from this file** to read or write data — never from `mockAdapter.js`
  directly.
- **`src/api/mockAdapter.js`** — a **mock backend**. Since there's no real
  server yet, this uses `axios-mock-adapter` to intercept requests made
  through `apiClient` and answer them out of `localStorage`, acting like a
  tiny database. It's seeded on first run from the existing furniture/texture
  catalog in `src/blueprint3d/constants.ts` and from
  `src/blueprint3d/templates/default.json`.

### Wiring up a real backend

1. Point `API_BASE_URL` in `src/api/urls.js` at your real API.
2. Delete the `import './api/mockAdapter'` line in `src/main.jsx`.

Nothing else changes. Every component already calls `functions.js`, and
`functions.js` doesn't know or care whether a mock or a real server answered.
Your backend just needs to implement the routes in `ENDPOINTS` with the
request/response shapes used in `mockAdapter.js` (treat that file as the spec).

### Uploads

`uploadModelFile()`, `uploadTextureImage()`, and `uploadImage()` all POST
`multipart/form-data` with the file under the `file` field, and resolve to
`{ url, name, size, mimeType }`. `uploadDataUrl(endpoint, dataUrl, filename)`
does the same starting from a base64 `data:` URL (used for floorplan
thumbnails, which are rendered straight from the 3D canvas).

The mock backend currently returns the file re-encoded as a `data:` URL, so
uploads preview immediately with no server. A real backend should instead
store the file (S3, GCS, a local disk, whatever) and return its hosted URL —
the frontend doesn't need to change either way, since it only ever uses
whatever `url` comes back in the response.

### Data shapes

**Item** (furniture/door/window):
```jsonc
{
  "id": "uuid",
  "key": "bed-queen-01",       // stable slug, also used as an i18n-style key
  "name": "Queen Bed",
  "description": "",
  "category": "bed",           // see ITEM_CATEGORIES in src/lib/constants.js
  "type": "1",                 // engine item type — see below
  "image": "https://…",        // catalog thumbnail
  "model": "https://….glb",    // the actual 3D model
  "isCustom": false,           // true for user-uploaded items
  "boolean": false             // true = cuts a hole in the wall it's placed on
}
```
`type` is the Blueprint3D engine's placement type: `"1"` = free-standing floor
item (furniture), `"3"` = in-wall item (windows), `"7"` = in-wall-floor item
(doors). `getItemTypeForCategory()` in `src/lib/constants.js` maps a category
to the right type automatically when you upload something.

`boolean` controls whether the item performs a boolean subtraction (opens a
hole) in the wall it's mounted on — doors and windows default to `true`; a
future wall-mounted item that shouldn't puncture the wall (a sconce, a framed
picture) would set it `false`. See
[Boolean wall cuts](#boolean-wall-cuts-doors-windows--custom-openings) for
the full mechanics.

**Texture**:
```jsonc
{ "id": "uuid", "name": "Oak Plank", "type": "floor", "url": "https://…", "thumbnail": "https://…", "stretch": true, "scale": 400 }
```

**Floorplan** (a saved project):
```jsonc
{
  "id": "uuid",
  "name": "My Apartment",
  "roomType": "bedroom",
  "thumbnailUrl": "https://…",
  "layoutData": { /* the full floor plan — see "The saved floorplan JSON" below */ },
  "createdAt": 1735689600000,
  "updatedAt": 1735689600000
}
```
The list endpoint (`GET /floorplans`) omits `layoutData` for a lighter
payload; fetch a single floorplan by id to get the full layout. `layoutData`
is exactly what `blueprint3d.model.exportSerialized()` produces — its full
shape (which wall has which texture, which glb sits where, at what rotation
and scale) is documented in
[The saved floorplan JSON](#the-saved-floorplan-json).

---

## Undo & redo

**Ctrl+Z** (Windows/Linux) or **Cmd+Z** (Mac) undoes; **Ctrl+Shift+Z** /
**Cmd+Shift+Z** redoes, and **Ctrl+Y** works too on Windows/Linux (both
redo conventions are common there — Ctrl+Y is the Office one, Ctrl+Shift+Z
the one most creative/web apps use; Mac only gets Cmd+Shift+Z, since Cmd+Y
is Safari's own "Show History" shortcut and shouldn't be hijacked). The
listener lives in `PlannerPage.jsx` and checks `e.metaKey || e.ctrlKey` —
it doesn't sniff the OS, so both modifiers are accepted everywhere; typing
in an actual `<input>`/`<textarea>` (the Rooms panel's name field, a dialog)
is left alone so the browser's native text-undo works there instead. Undo/Redo
buttons in the top bar (disabled when there's nothing to undo/redo) do the
same thing for anyone who'd rather click.

**How it works**: this is whole-state snapshot undo, not a per-field command
pattern — `Model.checkpoint()` (`src/blueprint3d/model/model.ts`) serializes
the *entire* floorplan (walls, corners, textures, room names, items — the
same shape as [The saved floorplan JSON](#the-saved-floorplan-json)) onto an
undo stack, and `undo()`/`redo()` just reload a snapshot with
`loadSerialized()`. This was the pragmatic choice given the engine already
has robust, complete serialization for save/load — writing a precise inverse
for every mutation type (move this corner back, un-delete this wall, restore
this texture, re-add this item at this exact transform) would be a lot more
code for the same end result. The tradeoff: undo/redo are whole-plan
operations, so items reload (a brief flash while `.glb`s re-fetch) and, like
any other `loadSerialized()` call, your 2D pan/zoom resets — see
[Known limitations](#known-limitations).

**Where checkpoints get taken** — always *before* the change, so undo
restores to just beforehand, and always once per gesture/action rather than
continuously:
- **2D**: before a corner/wall drag starts (`mousedown()`, not every frame
  of the drag), before a delete, before placing a new wall point (click or
  typed-exact-length), before a cut.
- **3D**: before an item drag or rotate starts (`Controller`'s
  `mousedown()`, same one-checkpoint-per-gesture idea) — item resize
  checkpoints once on the ContextMenu input's `onFocus` rather than per
  keystroke, for the same reason.
- **React-driven changes**: before adding/deleting an item, before a
  texture change, before a room rename/resize (`RoomsPanel.jsx`).

If you add a new kind of mutation, the pattern is the same wherever it
happens: call `blueprint3d.model.checkpoint()` (or `this.model.checkpoint()`
from inside the engine, where `Floorplanner`/`Controller` already hold a
`Model` reference) right before the change, once per user action.

---

## The 2D floorplanner: snapping, sticky angles & typed lengths

This is implemented entirely inside the engine
(`src/blueprint3d/floorplanner/floorplanner.ts`) so it works the same
regardless of which UI sits on top of it.

**Zoom**: scroll to zoom in/out, centered on the cursor (the point under your
mouse stays under your mouse, the standard "zoom to cursor" behavior) —
`mousewheel()` adjusts `cmPerPixel` within `minCmPerPixel`/`maxCmPerPixel`
(1/6× to 8× the default scale) and compensates `originX`/`originY` so the
pan doesn't jump. A small percentage badge (bottom-left,
`ZoomIndicator.jsx`) shows the current level. Since every snap tolerance is
already defined in *screen* pixels and converted to cm on the fly (see
below), snapping stays visually consistent at any zoom level with no extra
work. `Floorplanner.zoomBy()`/`resetZoom()` exist too, for a future +/−
button or double-click-to-reset — not wired to anything yet since scroll
alone covers the ask. Zoom resets to 100% whenever a floorplan is (re)loaded
(new project, opening a saved one, undo/redo — see below), the same as pan
already did.

**Snapping**, in priority order, applies to *every* point you place while
drawing — including the very first click of a new wall chain, not just
points after it (that first-click case used to fall through with no snap at
all; `computeDrawSnap()` now checks corner/edge snapping unconditionally and
only requires a `lastNode` for the intersection and angle tiers, which need a
"from" point to make sense of):

1. **Corner snap** — snaps onto any existing corner within ~18 screen
   pixels, so new walls cleanly meet existing ones.
2. **Intersection snap** — if the wall you're drawing would cross another
   wall, snaps to the exact crossing point (within ~14 * 1.5 screen pixels).
3. **Edge snap** — snaps onto the nearest point along another wall's edge
   (also ~14 px), so you can start/end a wall flush against a wall you're not
   directly connecting to.
4. **Sticky angle** — if none of the above apply (and a first point has
   already been placed), the direction from the last point locks to the
   nearest 15° increment whenever the raw cursor angle is within 5° of one —
   0°/90°/180°/270° for orthogonal walls, plus 15°/30°/45°/etc. for angled
   ones. A faint dashed guide line extends through that direction so the lock
   is visible, not just implied by the cursor snapping in place
   (`drawAngleGuide()` in `floorplanner_view.ts`).

Tolerances are constants at the top of `floorplanner.ts`
(`cornerSnapPixels`, `wallSnapPixels`, `angleSnapIncrement`,
`angleSnapTolerance`) — tune them there if snapping feels too sticky or too
loose. Pixel-based tolerances are converted to cm internally, so they stay
consistent regardless of zoom.

The same corner/edge snapping also applies when you **drag an existing
corner** in Move mode (not just while drawing new walls) — dragging a corner
near another corner or wall edge snaps onto it, falling back to the old
axis-alignment behavior if nothing's nearby. See the `activeCorner` branch in
`mousemove()`.

**Live length + angle + typed input**: while a wall segment is being drawn,
the engine fires a `drawingLengthCallbacks` event (see `DrawingLengthInfo` in
`floorplanner.ts`) with the segment's length (pre-formatted the same way
on-canvas wall labels are), its current angle, whether that angle is
sticky-locked, and the cursor's screen position. `PlannerPage.jsx` subscribes to this
and stores it in state; it's rendered by
`src/components/floorplanner/DrawingLengthTooltip.jsx` as a small floating
badge near the cursor (a dot next to the angle means it's locked).

While drawing, typing digits (and `.`) starts overriding that badge with a
typed value instead of the live mouse-tracked length; `Backspace` edits it;
`Enter` commits it — the engine places the next corner at exactly that
distance from the last one, in whatever direction the mouse currently is
(including a sticky-locked angle, if one's active), then keeps drawing from
there. This is handled by `handleLengthTypingKey()` / `commitTypedLength()`
in `floorplanner.ts`. Typed numbers are interpreted as a plain decimal in the
*current* dimension unit (e.g. typing `96` while the unit is inches means 96
inches) — this is intentionally simpler than the feet'-inches" notation used
for the passive on-canvas labels.

Measuring (see below) uses the exact same snap chain, including the sticky
angle and its guide line, via `computeMeasureSnap()`.

To add a new interaction (e.g. an angle readout, or snapping to a fixed
angle increment like 45°), follow the same pattern: compute it in
`floorplanner.ts`, expose it through a new or existing `EventEmitter`, and
subscribe from `PlannerPage.jsx`.

---

## CAD tools: cut and measure

Two more 2D modes live alongside Move/Draw/Erase in the mode toolbar
(`src/components/floorplanner/FloorplannerControls.jsx`), implemented the
same way drawing is — inside `floorplanner.ts`, with a live tooltip fed by
its own `EventEmitter`.

### Cut — splitting a wall at an exact point

This is the tool for "I have a 7' wall and want it split into 3' + 4'."
Switch to **Cut**, hover a wall — it highlights, and a small amber marker
shows where it would be cut, with a tooltip showing both resulting lengths
(`CutLengthInfo` → `lengthA`/`lengthB`, rendered by `CutLengthTooltip.jsx`).

- **Click** to cut at the hovered point.
- **Type a number** to override it: the tooltip locks onto whichever end of
  the wall the cursor is currently closer to, and typing sets the distance
  *from that end* — so hovering near the left end and typing `3` (in the
  current unit) cuts 3' from the left, leaving the remainder on the right.
  `Enter` commits it, mirroring the draw tool's typed-length input.
- The engine (`performCut()`) creates a corner at that point and two new
  walls in place of the original, copying its texture, thickness, and height
  onto both halves — so a re-textured wall stays consistently textured after
  being cut.
- **A wall with a door or window on it can't be cut** — the underlying wall
  object would be destroyed and take the attached item with it, so
  `performCut()` refuses and fires `cutBlockedCallbacks` instead, which
  `PlannerPage.jsx` turns into a toast asking you to move the door/window off the
  wall first. This is a deliberate limitation — see
  [Known limitations](#known-limitations) if you want to lift it.

### Measure — a non-destructive ruler

Switch to **Measure**, click a point (it snaps to corners/edges just like
drawing), then move the mouse — a dashed line and a live distance tooltip
follow the cursor (`MeasureLengthInfo`, rendered by `MeasureTooltip.jsx`).
Click again to drop a new reference point and keep measuring from there
(handy for walking a chain of distances to check a run of walls line up).
Nothing is created or modified — it's purely a readout. `Esc` (or switching
modes) clears it.

Both tools share the same snapping helpers as the draw tool
(`snapToNearbyCorner` / `snapToNearbyWallEdge` / `snapToWallIntersection` in
`floorplanner.ts`) so a measurement or a cut point lines up with existing
geometry the same way a new wall would.

---

## The 3D viewer

`src/blueprint3d/three/main.ts` (`Main`, exposed as `blueprint3d.three`) owns
the Three.js scene, camera, controls, and raycasting-based selection. `PlannerPage.jsx`
subscribes to `itemSelectedCallbacks` / `itemUnselectedCallbacks` /
`wallClicked` / `floorClicked` / `nothingClicked` once, and everything else
(orbit controls, item dragging, wall/floor click-to-texture) is handled
inside the engine already.

Switching between 2D and 3D (`handleViewChange` in `PlannerPage.jsx`) calls
`three.setViewMode('2d' | '3d')` and then, after a tick, either resets the
floorplanner view or tells the 3D renderer to resize — this mirrors how the
engine expects to be driven and avoids stale canvas sizing.

Floorplan thumbnails (shown on project cards) are generated by temporarily
repositioning the existing camera to a top-down view, rendering one frame,
reading it back as a `data:` URL, then restoring the camera exactly as it
was — see `captureTopDownSnapshot()` in `src/lib/topDownSnapshot.js` (shared
with the Export dialog, which uses the same function scoped to a single
room's bounds instead of the whole flat).

---

## Rooms: naming, resizing, hover & focus

Rooms aren't drawn directly — they're derived from whatever closed loop of
walls you've drawn, recomputed by `Floorplan.update()` every time the wall
graph changes (`src/blueprint3d/model/room.ts` / `floorplan.ts`). That
recomputation **rebuilds a fresh `Room` object every time**, which is why
anything that needs to persist (a name, a floor texture) is stored on the
`Floorplan` itself, keyed by `Room.getUuid()` — a hash of the room's sorted
corner IDs, stable as long as the room's shape doesn't change. Room names
follow this exact same pattern as floor textures (`roomNames` next to
`floorTextures` in `floorplan.ts`), including surviving save/reload the same
way (`SavedFloorplan.roomNames`).

**Naming & viewing**: open the Rooms panel (the list icon in the top bar,
`src/components/rooms/RoomsPanel.jsx`) to see every room with an editable
name field, its area, and its width × depth. Renaming there calls
`room.setName()`, which fires `roomNamesChangedCallbacks` — both the 2D
canvas labels (`drawRoomLabel()` in `floorplanner_view.ts`, rendered at each
room's area-weighted centroid via `Room.getCenter()`) and the floating 3D
labels (`RoomLabels3D.jsx`, positioned every frame the camera moves by
projecting that same centroid to screen space with `three.projectVector()`)
pick up the new name automatically. A room with no name yet shows its area
instead of sitting blank.

**Resizing**: only wired up for simple rectangular rooms (`Room.isSimpleRectangle()`
— 4 corners, axis-aligned sides). The Rooms panel shows editable width/depth
fields for those; typing new values calls `Room.resize()`, which moves the
room's corners to hit the exact dimensions, anchored at whichever corner is
closest to the plan origin. Since corners are shared with whatever's next
door, resizing a room naturally moves a wall it shares with a neighboring
room too — the same structural behavior as dragging a corner in Move mode,
just driven by a typed number instead of the mouse. Non-rectangular rooms
show read-only dimensions instead (extending `resize()` to L-shapes etc.
would mean picking a policy for which corners move and by how much, which
felt too ambiguous to guess at).

**Hover highlighting**: previously only items got a hover highlight
(`Item.mouseOver()`, an emissive boost — see `items/item.ts`). Rooms now do
too: `Controller.updateIntersections()` raycasts the floor planes whenever
nothing's already hovered, and `updateRoomMouseover()` tints the room's
*visible* floor mesh (not the invisible one `Room.floorPlane` — that one's
raycast-only. The real one lives in a matching `Floor` instance the engine
keeps in `three/floorplan.ts`, found via `main.floorplan.floors.find(f => f.room === hoveredRoom)`,
highlighted through the new `Floor.setHighlighted()`).

**Focus ('F' key, or click a room)**: press **F** while hovering a room or
item (or with one selected) to smoothly frame it — `Controller.getFocusTarget()`
resolves what to frame (hover beats selection), and `Main.focusOnRoom()` /
`focusOnItem()` animate the camera there with the same animejs pattern
already used for the 2D/3D view switch (`setViewMode()`), preserving your
current viewing angle rather than resetting to some default one. Clicking a
room does this too, automatically, alongside opening the texture selector —
see the `floorClicked` handler in `PlannerPage.jsx`. Clicking an *item*
doesn't auto-focus (so resizing furniture you can already see doesn't yank
the camera around); F still works on it though.

---

## Items catalog (furniture, doors, windows) & precise door/window sizing

- `src/components/items/ItemsList.jsx` fetches from `fetchItems({ category,
  search })` (debounced while typing) and renders a grid of
  `ItemCard.jsx`.
- Clicking a card calls `onItemSelect(item)`, which in `PlannerPage.jsx`
  (`handleItemSelect`) calls `blueprint3d.model.scene.addItem(type, item.model,
  metadata)` — this is the entire "add furniture to the scene" operation.
- `src/components/items/UploadItemDialog.jsx` uploads a `.glb` (+ optional
  cover image) via `uploadModelFile` / `uploadImage`, then calls `createItem`
  so the new item shows up immediately under the "My Uploads" category.
  Deleting a custom item calls `deleteItem` and removes it from the grid.

**Doors and windows are wall-mounted items** (`InWallFloorItem` /
`InWallItem` in `src/blueprint3d/items/`) — the engine already snaps them
onto the nearest wall the moment they're placed, and re-snaps as you drag
them along a wall in the 3D view (`WallItem.placeInRoom()` /
`moveToPosition()`), so you never have to manually align one to a wall.

To make sizing one just as fast, adding a door or window
**auto-selects it the instant it loads** (see the `itemLoadedCallbacks`
handler in `PlannerPage.jsx`'s bootstrap effect, and the `autoSelect` flag set in
`handleItemSelect`) — the resize panel (`ContextMenu.jsx`) pops open
immediately with width/height/depth fields already focused on the new item,
so you can type the exact opening size (e.g. a 32" door, a 60"-wide window)
right away instead of hunting for it in the 3D view first. This reuses the
same `item.resize()` path as resizing any other piece of furniture — nothing
door/window-specific about it under the hood.

To seed more starter items without a real backend yet, add entries to the
`ITEMS` array in `src/blueprint3d/constants.ts` — the mock backend re-seeds
new arrays are picked up by bumping `SEED_VERSION` in `mockAdapter.js` (see
[How to extend things](#how-to-extend-things)).

---

## Boolean wall cuts (doors, windows & custom openings)

Doors and windows don't just sit in front of a wall — the wall mesh actually
gets a rectangular hole cut into it at the item's position and size, so you
can see/walk through the opening in 3D. This already existed in the ported
engine (`three/edge.ts` builds each wall as a `THREE.Shape` and pushes a
`THREE.Path` hole into it for every attached item) but used to be
all-or-nothing: *every* wall-mounted item got a hole, with no way to opt out.

**`metadata.boolean`** (see `src/blueprint3d/items/metadata.ts`) makes that
explicit and controllable per item:

- `true` (or unset — it defaults to `true` for backward compatibility) →
  the item cuts a hole. This is what every door/window in the catalog uses.
- `false` → the item stays wall-mounted (still auto-snaps to the wall, still
  moves/resizes normally) but **doesn't** open a hole — for a future
  wall-mounted item that shouldn't puncture the wall, like a sconce or a
  framed picture.

The check lives in one place: `three/edge.ts`'s hole-generation loop skips
any item with `item.metadata?.boolean === false`. Nothing else needs to
know about it.

**End to end**, the flag flows: catalog `Item.boolean` (`constants.ts`) →
`UploadItemDialog.jsx`'s "Cuts through the wall" toggle (shown only for the
door/window categories, defaulted via `getDefaultBooleanForCategory()` in
`lib/constants.js`) → `createItem()` payload → `handleItemSelect()` in
`PlannerPage.jsx` copies it into the engine's `metadata.boolean` when placing
the item → `three/edge.ts` reads it when building wall geometry → and it's
serialized back out via `model.ts`'s `exportSerialized()`/`loadSerialized()`
(along with `itemKey` and `category`, which used to get silently dropped on
save/reload before this — see `SerializedItem` in `model.ts` if you need to
add more fields to that round trip).

**Via the API**: when you add a custom item, include `boolean: true` in the
`createItem()` payload (see the Item shape in
[The API layer](#the-api-layer)) if it should cut through its wall. If
you're seeding items directly into a real backend later, same field, same
meaning.

---

## Textures

- `src/components/textures/TextureSelector.jsx` appears when you click a wall
  or floor (via the engine's `wallClicked` / `floorClicked` callbacks) and
  fetches `fetchTextures(type)` where `type` is `'floor'` or `'wall'`.
- Clicking a swatch calls `currentTarget.setTexture(url, stretch, scale)` —
  `currentTarget` is whatever `HalfEdge` (wall) or `Room` (floor) object the
  engine reported as clicked.
- `UploadTextureDialog.jsx` uploads an image via `uploadTextureImage`, then
  `createTexture` adds it to the list and applies it immediately.

---

## Projects (save / load / delete)

- **Save**: if the current design has never been saved, `handleSave` opens
  `SaveFloorplanDialog` (name + room type); otherwise it silently
  `PUT`s the update. Both paths export the current layout with
  `blueprint3d.model.exportSerialized()`, generate a thumbnail, upload the
  thumbnail, and send everything through `createFloorplan` / `updateFloorplan`.
- **New**: `NewFloorplanDialog` lets you pick a room type, fetches that room
  type's starter template (`fetchTemplateByRoomType`), loads it with
  `blueprint3d.model.loadSerialized(...)`, and clears the "currently open
  project" state so the next save creates a new record instead of overwriting
  the old one.
- **Projects tab** (`ProjectsView.jsx`): search/sort/filter over
  `fetchFloorplans(...)`, opening a card fetches the full record
  (`fetchFloorplanById`) and loads it into the engine, deleting calls
  `deleteFloorplan` with an optimistic UI update.

---

## The saved floorplan JSON

This is the exact shape of `layoutData` in a saved `Floorplan` record — what
`blueprint3d.model.exportSerialized()` produces and
`blueprint3d.model.loadSerialized()` consumes. If you're building a real
backend and want to query "what texture is on which wall" or "what glb is
placed where" directly against stored data (rather than treating it as an
opaque blob), this is the schema to index against.

```jsonc
{
  // Every corner (wall endpoint) in the plan, keyed by a stable id.
  "corners": {
    "abc123": { "x": 0, "y": 0 },      // cm, plan/top-down coordinates
    "def456": { "x": 400, "y": 0 }
  },

  // Every wall, referencing two corner ids.
  "walls": [
    {
      "corner1": "abc123",
      "corner2": "def456",
      "frontTexture": { "url": "https://…", "stretch": true, "scale": 400 },
      "backTexture": { "url": "https://…", "stretch": true, "scale": 400 },
      "thickness": 10,                 // cm — falls back to the global default if omitted
      "height": 250                    // cm — falls back to the global default if omitted
    }
  ],

  // Floor texture per room, keyed by a hash of that room's corner set —
  // stable as long as the room's shape doesn't change.
  "floorTextures": {
    "room-hash-1": { "url": "https://…", "scale": 400 }
  },

  // Every placed item — furniture, doors, windows.
  "items": [
    {
      "item_name": "Queen Bed",
      "item_key": "bed-queen-01",       // catalog slug, for tracing back to the catalog entry
      "category": "bed",
      "item_type": 1,                   // 1 = floor item, 3 = in-wall (window), 7 = in-wall-floor (door)
      "model_url": "https://….glb",
      "xpos": 210, "ypos": 0, "zpos": 340,   // cm, world position (note: y is vertical here, unlike corners' x/y)
      "rotation": 1.57,                 // radians, around the vertical axis
      "scale_x": 1, "scale_y": 1, "scale_z": 1,
      "fixed": false,                   // locked in place? (ContextMenu's "Lock in place")
      "resizable": true,
      "boolean": false,                 // cuts a hole in its wall? see "Boolean wall cuts"
      "description": ""
    }
  ]
}
```

A few things worth knowing if you're persisting/querying this on a real
backend:

- **Corners/walls are graph data, not a room list.** Rooms (and their floor
  polygons) are derived at load time by walking the corner/wall graph
  (`Floorplan.update()`), not stored directly — if you need "which rooms
  exist and what shape are they" server-side without spinning up the engine,
  you'd need to port that traversal or store the derived room list
  separately alongside this.
- **Wall thickness/height are per-wall, not global**, so a wall you've
  customized (or split with the [Cut tool](#cad-tools-cut-and-measure), which
  copies the original wall's texture/thickness/height onto both new pieces)
  keeps that on save/reload rather than reverting to the app-wide default.
- **`item_key`, `category`, and `boolean`** round-trip through save/load
  (they didn't, before this feature — `SerializedItem` in `model.ts` only
  carried a handful of fields). If you add more metadata fields to items
  later, add them to `SerializedItem` and both directions of
  `exportSerialized()`/`loadSerialized()` in `model.ts`, the same way.
- **Textures are referenced by URL**, not by the texture catalog's `id` —
  so a saved floorplan keeps rendering correctly even if a texture is later
  removed from the catalog, and doesn't require a join to redraw.

---

## Exporting a reference image + JSON

The Export dialog (the image icon in the top bar, `src/components/dialogs/ExportDialog.jsx`)
produces exactly what you'd hand to an image-generation API as a reference:
a top-down snapshot plus a structured JSON description, scoped to either the
whole flat or a single room.

- **Image**: `captureTopDownSnapshot()` (`src/lib/topDownSnapshot.js`) — the
  same function behind floorplan save-thumbnails, just pointed at a room's
  center/size instead of the whole plan's when scoped to a room.
- **JSON**: `buildRoomExportData()` / `buildFlatExportData()`
  (`src/lib/exportRoomData.js`). Room scope includes: the room's name and
  dimensions, its floor texture, only the walls that bound it (matched by
  walking `room.corners` in pairs and finding the wall between each), and
  only the items inside it (`Room.containsPoint()` — a point-in-polygon test
  against each item's position). Flat scope includes everything, plus a
  per-room summary list. Both use the same per-item shape (name, category,
  model URL, position/rotation/size, and whether it cuts its wall — see
  [Boolean wall cuts](#boolean-wall-cuts-doors-windows--custom-openings)).

The dialog gives you Download-image, Download-JSON, and Copy-JSON — nothing
is sent anywhere from here. Wiring this into a real image-generation API is
intentionally left as a fetch call you add wherever you need it (or a new
function in `src/api/functions.js` + a mock in `mockAdapter.js`, following
the same pattern as everything else in [The API layer](#the-api-layer)) —
since that's an external service with its own request shape, it didn't make
sense to guess at one here.

---

## Settings & units

`Configuration` (`src/blueprint3d/core/configuration.ts`) is the engine's own
global config store — `configDimUnit` controls whether measurements are
shown in inches, cm, m, or mm. `SettingsDialog.jsx` reads/writes it directly
and also persists the choice to `localStorage` (`dimensionUnit`) so it
survives a reload — this is a local UI preference, not project data, so it
intentionally doesn't go through the API layer.

Unit conversion helpers for the React side (context menu resize inputs, the
settings list) live in `src/lib/constants.js`
(`cmToDisplay`/`displayToCm`/`getUnitLabel`/`getDecimalPlaces`). The engine
has its own, separate formatter for on-canvas labels —
`Dimensioning.cmToMeasure()` in `src/blueprint3d/core/dimensioning.ts` —
which renders inches as feet'-inches" (architectural notation) rather than a
decimal. Both read from the same `Configuration` value; they just format it
differently for their respective contexts.

---

## Design system & dark mode

Every primitive in `src/components/ui/` is a real shadcn/ui component
(`Button`, `Input`, `Label`, `Select`, `Dialog`, `Switch`, `Checkbox`,
`RadioGroup`, `Card`, `Badge`, `Avatar`, `DropdownMenu`, `Separator`,
`Skeleton`, `Tooltip`, `Sonner`) — Radix primitives underneath where one
exists, `class-variance-authority` for variants, styled entirely through the
CSS variables below rather than hardcoded colors. `OptionList.jsx` (the
card-style room-type/unit picker used in a few dialogs) is built on top of
`RadioGroup` rather than being its own primitive. Two naming notes if you're
extending this: **variant names on `Button`/`Badge` follow this project's
existing convention** (`primary`/`secondary`/`danger`) rather than shadcn's
defaults (`default`/`destructive`) — both are accepted, so either works —
and **`Select` is the real Radix-based shadcn Select**, not a native
`<select>`, so it's `<Select value onValueChange>` +
`<SelectTrigger><SelectValue/></SelectTrigger>` +
`<SelectContent><SelectItem value=…>` (see `ProjectsView.jsx`'s sort dropdown
for a minimal example), not an `onChange`/`<option>` API.

**Dark mode** is class-based: `ThemeProvider` (`src/contexts/ThemeContext.jsx`)
toggles a `.dark` class on `<html>`, persists the choice to `localStorage`
(`theme`: `'light' | 'dark' | 'system'`), and live-follows the OS preference
while in `'system'` mode. `useTheme()` gives any component `{ theme,
resolvedTheme, setTheme, toggleTheme }`; `<ThemeToggle/>` is the ready-made
sun/moon button already wired into the planner's top bar, the dashboard
header, and the auth pages. `main.jsx` wraps the whole app in
`<ThemeProvider>` (outside the router, since login/signup should respect the
theme too), and `components/ui/Sonner.jsx` reads `resolvedTheme` so toasts
match.

Every color is a CSS variable in `src/index.css`, defined once in `:root`
(light) and once in `.dark`, then exposed to Tailwind via a `@theme inline`
block — shadcn's standard tokens (`--background`, `--foreground`, `--card`,
`--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`,
etc.) plus this project's "blueprint" aliases (`--color-paper`, `--color-ink`,
`--color-line`, ...) pointed at the *same* variables, so components written
against either naming stay correct and get dark mode for free. If you add a
new color, define it in both `:root` and `.dark` and it's automatically
available as `bg-*`/`text-*`/`border-*` utilities in both themes — there's
no separate dark-mode variant class to remember (no `dark:bg-...`
sprinkled through components; the variable itself changes).

The palette is a "blueprint" theme in both modes: paper/graphite in light,
a deep graphite background with a lighter accent blue in dark, one
drafting-blue primary either way, monospace for dimension numbers, a faint
dot grid (`.bg-blueprint-grid`) behind the 2D canvas and auth/dashboard
pages.

---

## Project structure

```
src/
  api/
    urls.js              every endpoint, in one place
    functions.js         axios instance + one function per endpoint
    mockAdapter.js        mock backend (localStorage), see "The API layer"
  blueprint3d/            the ported floorplanning/3D engine — framework-agnostic
    core/                 Configuration, Dimensioning, Utils (geometry), events
    model/                Floorplan, Wall, Corner, Room, Scene, Model (data + serialization)
    items/                Item base class + per-category subclasses + factory
    three/                Main (scene/camera/controls/raycasting), Controller (hover/select/focus), Floor
    floorplanner/         2D canvas tool: drawing, snapping, cut/measure, rendering, room labels
    loaders/              GLTF/GLB and legacy JSON model loaders
    config/               room-type → default template mapping
    templates/             default.json / example.json starter layouts
    constants.ts           seed furniture/door/window catalog + textures
  contexts/
    AuthContext.jsx        session state + login/signup/logout/google/forgot/reset
    ThemeContext.jsx        light/dark/system theme, persisted, drives the .dark class
  pages/
    LoginPage.jsx / SignupPage.jsx / ForgotPasswordPage.jsx / ResetPasswordPage.jsx
    DashboardPage.jsx      recent floorplans, stats, quick actions
    PlannerPage.jsx        the floorplanner itself (wires the engine to the UI)
  components/
    auth/                  AuthLayout, GoogleButton, PasswordInput, route guards
    layout/                TopNavBar (tabs, 2D/3D switch, new/save/settings, account menu)
    floorplanner/          move/draw/cut/measure/erase controls, controls help, tooltips, 3D room labels
    items/                 item browser drawer — search, categories, upload
    textures/               floor/wall texture picker + upload
    context-menu/           selected-item resize/lock/delete panel
    rooms/                  RoomsPanel — list/rename/resize/focus every room in the plan
    projects/               floorplan cards — used by both the dashboard and the Projects tab
    dialogs/                New / Save / Settings / Export dialogs
    ui/                     shadcn/ui primitives (see "Design system & dark mode")
  lib/                     shared constants + helpers (units, room types, cn()),
                           topDownSnapshot.js (camera snapshot), exportRoomData.js (export JSON)
  hooks/                   useIsMobile / useMediaQuery
  App.jsx                  router shell — auth pages, dashboard, protected planner
  main.jsx                 React root + ThemeProvider + mock backend import + toast host
```

---

## How to extend things

**Add a new shadcn/ui primitive**: shadcn isn't installed as a package here
(there's no CLI step) — `src/components/ui/*.jsx` are the actual component
implementations, written the same way `npx shadcn add <name>` would generate
them (Radix primitive + `cva` variants + `cn()`), just already in the repo
and pre-themed. To add one that isn't there yet (a Tabs component, a
Progress bar, etc.), write it the same way: a Radix primitive from
`@radix-ui/react-*` if the component needs one, styled with `bg-background`/
`text-foreground`/`border-border`/etc. so it picks up dark mode
automatically — no new component-specific CSS needed.

**Add a new item category** (e.g. "rugs"): add an entry to `ITEM_CATEGORIES`
in `src/lib/constants.js`, add matching seed items to `ITEMS` in
`src/blueprint3d/constants.ts`, and bump `SEED_VERSION` in
`src/api/mockAdapter.js` so existing browsers re-seed with the new data
(otherwise their already-seeded `localStorage` "database" won't pick up the
change). If it needs special placement behavior (in-wall, floor-mounted,
etc.), add it to `CATEGORY_ITEM_TYPE` in `lib/constants.js`.

**Add a new room type**: add it to `ROOM_TYPES` in `src/lib/constants.js`.
Every room type currently shares the same blank starter layout
(`templates/default.json`) — to give a room type its own starter furniture
layout, edit the `mock.onGet(ENDPOINTS.TEMPLATES...)` handlers in
`mockAdapter.js` to return a different `layoutData` per room type (a
`layoutData` object is just whatever `model.exportSerialized()` produces, so
the easiest way to create one is to design it in the app, save it, then copy
its `layoutData` out of `localStorage` into a new template file).

**Add a new dialog or panel**: follow the existing pattern — a component in
`components/dialogs/` (or wherever fits) built from the `ui/` primitives,
wired up with a bit of state and a handler in `PlannerPage.jsx`. `NewFloorplanDialog`
is a good minimal example to copy.

**Add a new API resource**: add its URL(s) to `urls.js`, its function(s) to
`functions.js`, and a mock handler in `mockAdapter.js` (`mock.onGet(...)`,
`.onPost(...)`, etc. — see the axios-mock-adapter docs). Once a real backend
exists, only the mock handler goes away.

**Swap the design theme**: edit the `@theme` block in `src/index.css`.
Everything references those CSS variables, so a full re-theme is a
find-and-replace of hex values in one place.

**Reuse the engine outside React**: `src/blueprint3d` has no React imports.
Anything driving it just needs a DOM element for the 3D viewer and a
`<canvas>` for the 2D view, then constructs `new Blueprint3d({ floorplannerElement, threeElement, textureDir, widget, enableWheelZoom })`
exactly as `PlannerPage.jsx` does — see the top of `PlannerPage.jsx`'s bootstrap `useEffect`
for the minimal setup.

**Add a new protected page**: create it under `src/pages/`, add a `<Route>`
for it in `App.jsx` wrapped in `<ProtectedRoute>` (see `/dashboard` and
`/planner` for examples), and link to it with React Router's `<Link>` or
`useNavigate()`. `useAuth()` gives you the signed-in `user` anywhere under
`<AuthProvider>`, which is everything inside the router.

**Wire up real Google sign-in**: see the walkthrough in
[Authentication & dashboard](#authentication--dashboard) — short version, add
a real OAuth flow on the frontend, point it at a real `/auth/google` backend
endpoint that returns `{ user, token }`, and delete the mock handler.

---

## Known limitations

- **Undo/redo reload the whole floorplan** (see [Undo & redo](#undo--redo)
  for why) — items briefly re-fetch their `.glb`, and 2D pan/zoom resets to
  center/100%, the same as opening a saved project already did before this
  feature existed.
- **Trackpad vs. mouse-wheel gesture detection is a heuristic, not perfect**
  — a wheel event with `ctrlKey` (pinch) always zooms, and a clearly
  horizontal two-finger swipe (`|deltaX| > |deltaY|`) always pans; anything
  in between (including a plain vertical two-finger scroll) zooms, per the
  original ask for scroll-to-zoom. If you'd rather plain scroll always pan
  and only pinch/Ctrl+scroll zoom (the Figma/Maps convention), flip that in
  `mousewheel()` in `floorplanner.ts` — the pieces are all there, just
  reorder the condition.
- **Room resize only works on simple rectangles** (`Room.isSimpleRectangle()`)
  — L-shaped or angled rooms show read-only dimensions in the Rooms panel.
  See [Rooms](#rooms-naming-resizing-hover--focus) for why.
- **The 'F' focus key only does something in the 3D view** — it's a no-op in
  2D (the 2D camera doesn't rotate/zoom the same way, so "frame this" isn't
  really a meaningful action there).
- The mock backend is a real localStorage-backed store, but it's
  single-browser — clearing site data resets the catalog and loses saved
  projects/accounts. This all goes away once a real backend is wired up.
- Room types share one starter template; see "Add a new room type" above to
  give each its own.
- **Auth is signed in, but data isn't scoped per-user yet**: the mock
  backend has real accounts/sessions now (`mockdb:users`, `mockdb:sessions`),
  and every request carries the signed-in user's token via the
  `Authorization` header (see [Authentication & dashboard](#authentication--dashboard)),
  but the floorplans/items/textures tables themselves are still global — any
  signed-in user sees everyone's floorplans. A real backend should filter
  `GET /floorplans` etc. by the requesting user (it already has the token to
  do so); the mock intentionally doesn't, to keep the demo simple.
- Mock passwords are stored as plain text in `localStorage` — fine for a
  throwaway browser-only mock with no real data behind it, never acceptable
  for a real backend (hash with bcrypt/argon2/etc. there).
- "Sign in with Google" is a mock that always signs in the same demo
  account — see [Authentication & dashboard](#authentication--dashboard) for
  how to wire up the real OAuth flow.
- Uploaded `.glb` models and textures are inlined as base64 `data:` URLs by
  the mock backend, which is fine for a demo but will bloat `localStorage`
  for large files. A real backend should return a real hosted URL instead.
- A wall with a door or window on it can't be cut (see
  [CAD tools](#cad-tools-cut-and-measure)) — move the item off first. Lifting
  this would mean, in `performCut()` in `floorplanner.ts`, snapshotting the
  wall's `items`/`onItems` before calling `wall.remove()` and calling
  `item.placeInRoom()` on each afterward so it re-attaches to whichever new
  half-wall ends up closest; it isn't done by default because that can shift
  a door/window's exact position, which felt worse than asking you to move
  it deliberately.

## Troubleshooting

**"The following dependencies are imported but could not be resolved"** on
`npm run dev` — a stale `node_modules` (often from switching between npm and
pnpm). Fix: `rm -rf node_modules package-lock.json pnpm-lock.yaml && npm install`.

**Snapping feels off** — see the tolerance constants at the top of
`src/blueprint3d/floorplanner/floorplanner.ts`.

**"Forgot password" doesn't seem to send anything** — it isn't wired to a
real email service; the mock logs the reset link to the browser console
instead (`[mock] Password reset link for …`) so you can test the flow. Open
devtools to grab it.

**Signed out unexpectedly / "Not signed in" errors** — the mock session
(`mockdb:sessions`) lives in `localStorage` alongside everything else;
clearing site data ends every session. If login stops working entirely,
clearing `localStorage` and signing up again resets the mock user store too.

**Uploaded images/models don't show up after a refresh** — the mock backend
seeds itself once and remembers `SEED_VERSION` in `localStorage`; if you
changed the seed data in `constants.ts` and don't see it, bump
`SEED_VERSION` in `src/api/mockAdapter.js`, or just clear the site's
`localStorage` in devtools.
