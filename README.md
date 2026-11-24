# Table timer

The clock and briefing screen for the room, and the game master's remote. One Node file, no installs.

```bash
node table/server.js
```

It prints the links.

| Address | Who | What |
|---|---|---|
| `/` | everyone | The portal: Participant, Observer or Game master |
| `/play` | participants | Pick a table once; the device remembers it. Or open a table's own link from Setup |
| `/watch` | observers | A screen for the observers' monitor: plays each film in full quality as it is shown in the room, then shows where the game is |
| `/gm` | game master | Open to anyone who can reach the address. There is no key |

## Game master

- **Run** is the day as a list, in order, with one big **Next** button: start a phase, send an item, or tick off a main-screen cue. After Decide the button becomes the day's choices: tap what the room decided. That answer names the bulletin version on the next day's cue ("Option B", "Sovereign") and keeps only the follow-ups that fit. Tap the decision's line in the run sheet to change it. Tap any line in the run sheet to do it out of order (it asks first). Pause, −1 / +1 min and End act on the running clock. **Identify** makes every tablet show its table name for a few seconds. Anything not in the run sheet, and a box for typing a one-off note, sits under "More to send".
- A **film cue** ("Play film 02 · Monday morning") also starts that film on the observers' screen, so tap it as the film starts in the room. If the film has versions, the app plays the one that fits the recorded decision; if that decision isn't recorded, the button becomes the versions and you tap the one that is starting. The ending plays its parts back to back (Ending 1D, then 2A, then 3B); a part whose outcome isn't recorded is left out. **Observers** shows how many screens are watching, what is playing, and **Stop film**. "Play any film for observers" starts one out of order.
- **Reset**, beside Step back on Run, puts the game back to the start: first day, clock cleared, everything sent recalled, decisions cleared, run sheet unticked, film stopped. Tables and minutes stay. It asks first.
- **Setup** has the minutes, the tables (add, rename, remove, each with its own link) and the same reset as **Reset for the real run**.

## Participants

Before the first phase a tablet shows its table's name. Then the phase and the clock. Items arrive beside the clock; tap one to read it full screen. The Decide questions are not shown on tablets (the game master and the observers' screen have them). The bar beside the clock pulses in the last minute. At zero the clock sits at 00:00 with the bar empty; the screen stays dark throughout.

When the run reaches the **Show share prices** step, a small, dim line of share prices starts drifting slowly along the bottom of the screen. Nothing sits under the clock, and the briefing column holds only what the game master sends: posts, statements, leaks and notes. The tables get their numbers in the intel briefing, not on screen; the invented ones, and what each leans on, are listed in `FIGURES-DRAFT.md`.

A tablet stays on its table: hold the table's name for three seconds to change it. A device is only ever sent items addressed to everyone, its table or its role.

## Observers

`/watch` goes on a monitor for the observers, beside the Zoom feed of the room. Zoom shows the room; this screen shows the films in full quality. Nobody needs to touch it during the game.

- Open it in Chrome, full screen, and tap **Start with sound** once. A browser will not start a film with sound until someone has tapped the page. If the page is ever reloaded it needs that tap again.
- When the game master taps a film cue, the film plays full screen. The server sends the film and the time it started, so a screen that is opened late or reloaded lands at the right point.
- Between films it shows the day, the stage and its clock, the same quiet line of share prices as the tablets, what has been decided so far, the Decide questions (during Decide only), and whatever went to every table. Anything addressed to one table or role and Thursday's two game-master-only outcomes are never sent to this screen.
- The screen is only ever sent the films that are playing, never the versions the room didn't pick.
- On a wide screen nothing scrolls and the text is sized to be read across a room: the newest things are at the top and the oldest fall off the bottom. On a person's own laptop or phone the same address works and scrolls.
- Zoom also carries the room's sound, a little late, so observers can hear a film twice. Whoever looks after the observers' screens turns Zoom's sound down while a film plays, or the room microphone is muted for it.

The films are on Bunny Stream and play in Bunny's player. **The Bunny library only plays inside sites on its allowed list**: in Bunny, Stream → the library → Security → Allowed domains, add the address this app is hosted on (no `https://`, for example `play.example.org`). Until that is done the observers' screen shows "The film is not loading on this screen".

Use Chrome on the monitor's computer. Safari, iPhones and iPads may make the film wait for a tap on its play button each time.

## Content

`content.json` holds the days, each day's run sheet (`run`), the Decide questions, the items that can be sent and the films (`films`: each one's Bunny id and length in seconds). A cue plays a film with `film`, or with `films` beside `versions` (one film per earlier decision). Save it and the server reloads. Its teams, roles and minutes are only the starting list: once the game master changes them on Setup, the live copy is in `state.json`.

What's there now (21 Nov): names, facts and film numbers follow the reads as shot on 19 Nov. A cue names the film to play ("Film 05 · D2 B", "Ending 1D + 2A + 3B"). Posts and leaks are copied from `data/social.json`; items marked `"draft": true` are wording the script only describes and still need approving. The Decide questions are the 17 Nov ones with the names changed. Thursday's two outcome steps (the next model release, evidence sharing) are recorded by the game master only and are not shown on tablets; they and the choice-to-ending map are a reading of the films and need confirming.

## Running it in the room

This is how the app is meant to run: on a laptop in the room, with the tablets on the same network. The game master page has no key, so anyone on that network can open `/gm`. Keep the network to the room's own devices (a travel router or a hotspot with a password).

All devices and the laptop need to be on one network that lets devices talk to each other. Guest Wi-Fi often blocks that, so test the venue's network or bring a travel router. Over plain http a page can't hold the screen awake: set Auto-Lock to Never on each tablet.

## Notes

- The server sends an end time, not ticks, so a device that drops its connection keeps counting and catches up when it reconnects (an amber dot shows meanwhile). A device that hears nothing for 25 seconds reconnects by itself.
- On an iPad, Share → Add to Home Screen gives a full-screen app with no browser bars.
- Env: `PORT` (2424), `AIGI_STATE`. Delete `state.json` to start clean.

## Hosting it on a public address

Don't, as it is. The game master key was removed on 24 Nov because the app only runs in the room. On a public address anyone who found it could open `/gm` and start clocks, send items or reset the game. To host it, put the key check back first (it is in the git history of `server.js` and `public/control.html`) or put the whole app behind the host's own password. `Dockerfile` is still here for that: mount a volume at `/data` so a restart keeps the clock and the setup, and run **one** instance, because the state is in memory.
