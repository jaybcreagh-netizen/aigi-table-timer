# Table timer

The clock and briefing screen for the room, and the game master's remote. One Node file, no installs.

```bash
node table/server.js
```

It prints the links.

| Address | Who | What |
|---|---|---|
| `/` | everyone | The portal: Participant or Game master |
| `/play` | participants | Pick a table once; the device remembers it. Or open a table's own link from Setup |
| `/gm` | game master | Open to anyone with the address, unless a key is set (`AIGI_KEY=... node table/server.js`) |

## Game master

- **Run** is the day as a list, in order, with one big **Next** button: start a phase, send an item, or tick off a main-screen cue. After Decide the button becomes the day's choices: tap what the room decided. That answer names the bulletin version on the next day's cue ("Option B", "On Our Terms") and keeps only the follow-ups that fit. Tap the decision's line in the run sheet to change it. Tap any line in the run sheet to do it out of order (it asks first). Pause, −1 / +1 min and End act on the running clock. **Identify** makes every tablet show its table name for a few seconds. Anything not in the run sheet, and a box for typing a one-off note, sits under "More to send".
- **Setup** has the minutes, the tables (add, rename, remove, each with its own link) and **Reset for the real run**.

## Participants

Before the first phase a tablet shows its table's name. Then the phase and the clock. Items arrive beside the clock; tap one to read it full screen. At Decide the day's questions appear. The last minute pulses, and at zero the screen turns white.

A tablet stays on its table: hold the table's name for three seconds to change it. A device is only ever sent items addressed to everyone, its table or its role.

## Content

`content.json` holds the days, each day's run sheet (`run`), the Decide questions and the items that can be sent. Save it and the server reloads. Its teams, roles and minutes are only the starting list: once the game master changes them on Setup, the live copy is in `state.json`.

What's there now: the statements and Wednesday's four posts are word for word from the current script. The questions, the intelligence note, Friday's updates and the order of each run sheet come from the story-flow proposal and still need confirming.

## Hosting it on a domain

The app is ready to sit behind a domain; what's needed is a small always-on host and one DNS record.

1. Put it on a host that runs a container or Node and gives https (Fly.io, Render, Railway, or a VM with Caddy). `Dockerfile` is here.
2. Set `AIGI_KEY` (the game master key, 8 characters or more) as a secret. Mount a volume and point `AIGI_STATE` at it so a restart keeps the clock and the setup.
3. Point a subdomain (say `play.<the AIGI domain>`) at the host with a CNAME, and add it as a custom domain there.
4. Use a plan that never sleeps and runs **one** instance: the state is in memory, so two instances would disagree.

Hosted over https, devices hold their own screens awake and any Wi-Fi or mobile data will do.

## Running it in the room instead

All devices and the laptop need to be on one network that lets devices talk to each other. Guest Wi-Fi often blocks that, so test the venue's network or bring a travel router. Over plain http a page can't hold the screen awake: set Auto-Lock to Never on each tablet.

## Notes

- The server sends an end time, not ticks, so a device that drops its connection keeps counting and catches up when it reconnects (an amber dot shows meanwhile). A device that hears nothing for 25 seconds reconnects by itself.
- On an iPad, Share → Add to Home Screen gives a full-screen app with no browser bars.
- Env: `PORT` (2424), `AIGI_KEY`, `AIGI_STATE`. Delete `state.json` to start clean.
