# Table timer

The clock and briefing screen for the room, and the game master's remote. One Node file, no installs.

```bash
node table/server.js
```

It prints the links and the game master key.

| Address | Who | What |
|---|---|---|
| `/` | everyone | The portal: Participant or Game master |
| `/play` | participants | Pick a table, then a role or "Whole table". The device remembers its seat; tap the table's name to change it |
| `/gm` | game master | Asks for the key once, then remembers it on that device |

## Game master

- **Run**: pick the day, tap Prepare, Discuss or Decide to start that clock, pause, add or take a minute, end. Send a statement, post or note to everyone, one table or one role. Type a one-off note. The dots show which tables have a device on.
- **Setup**: the minutes for each phase, the tables and their roles (add, rename, remove, at any time), an optional room code, and the participant link.

## Participants

The table or role, the day, the phase and the clock. Items arrive beside the clock; tap one to read it full screen. At Decide the day's questions appear. The last minute pulses, and at zero the screen turns white.

A device is only ever sent items addressed to everyone, its table or its role. A device joined as "Whole table" does not get a role's private notes.

## Content

`content.json` holds the days, the Decide questions and the items that can be sent. Save it and the server reloads. Its teams, roles and minutes are only the starting list: once the game master changes them on Setup, the live copy is in `state.json`.

What's there now: the statements and Wednesday's four posts are word for word from the current script. The questions, the roles, the intelligence note and Friday's updates come from the story-flow proposal and still need confirming.

## Hosting it on a domain

The app is ready to sit behind a domain; what's needed is a small always-on host and one DNS record.

1. Put it on a host that runs a container or Node and gives https (Fly.io, Render, Railway, or a VM with Caddy). `Dockerfile` is here.
2. Set `AIGI_KEY` (the game master key, 8 characters or more) as a secret. Mount a volume and point `AIGI_STATE` at it so a restart keeps the clock and the setup.
3. Point a subdomain (say `play.<the AIGI domain>`) at the host with a CNAME, and add it as a custom domain there.
4. Use a plan that never sleeps and runs **one** instance: the state is in memory, so two instances would disagree.

Hosted over https, devices hold their own screens awake and any Wi-Fi or mobile data will do. Set a room code on Setup so a stranger who finds the address can't join.

## Running it in the room instead

All devices and the laptop need to be on one network that lets devices talk to each other. Guest Wi-Fi often blocks that, so test the venue's network or bring a travel router. Over plain http a page can't hold the screen awake: set Auto-Lock to Never on each tablet.

## Notes

- The server sends an end time, not ticks, so a device that drops its connection keeps counting and catches up when it reconnects (an amber dot shows meanwhile). A device that hears nothing for 25 seconds reconnects by itself.
- On an iPad, Share → Add to Home Screen gives a full-screen app with no browser bars.
- Env: `PORT` (2424), `AIGI_KEY`, `AIGI_STATE`. Delete `state.json` to start clean.
