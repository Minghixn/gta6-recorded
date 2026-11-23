# Port Meridian — Open-World Crime Game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)

An original top-down open-world crime game for make.fun's "Make GTA 6" bounty
($1,666, top 100 paid). Playable offline in a desktop browser from static
files — no network requests, no libraries.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## The game

You are back in **Port Meridian**, a neon dusk port city on a 2600×2600 map
(9×9 road grid, 100+ buildings). Walk or drive, steal parked or traffic cars,
outrun the Port Meridian PD, and finish three story missions:

1. **The Getaway** (90s) — steal a car and reach the marker in time.
2. **Hot Package** — pick up drops around the city while wanted.
3. **Turf War** — defeat 6 gang members, then reach the safehouse.

Features: traffic AI + 26 pedestrians, wanted stars (1–5) with police chases
and ramming, pistol/melee combat, health/cash pickups, HUD with live minimap,
procedural WebAudio sound (sirens, shots, pickups), pause menu, title / win /
game-over screens, and save/load via localStorage.

## Controls

| Key | Action |
|---|---|
| WASD / Arrows | Walk / drive |
| Shift | Sprint |
| E | Steal / enter car, grab & deliver |
| Mouse + Click | Aim & shoot (on foot) |
| F | Melee |
| R | Reload |
| S | Save |
| P / Esc | Pause |
| M | Mute |

## Screenshots

`?shot=start` title · `?shot=play` driving · `?shot=chase` police chase ·
`?shot=end` final mission. See `shots.json`.

## Originality

City, characters, vehicles, names, story, art and sound are all original.
Nothing from Rockstar Games or any commercial game.

## Recording

This entry was built inside a sealed make.fun recording
(`01a206b8-1884-77d3-8c0e-596b2e3747d5`, 253/253 records witnessed).

## License

MIT — see `LICENSE`.
