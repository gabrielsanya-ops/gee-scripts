# GEE Scripts Portfolio

Google Earth Engine scripts by Gabriel Sanya — all code on GitHub. Each of the 17 projects is a **folder**; each project contains multiple sub-scripts (one `.js` file per script in the GEE Code Editor).

## Repo layout

| GEE project | In this repo |
|-------------|--------------|
| `users/gabrielsanya/Aljouf` | [scripts/Aljouf/](scripts/Aljouf/) — 29 sub-scripts (placeholders ready for paste) |
| `users/gabrielsanya/code101` | [scripts/code101/](scripts/code101/) |
| `users/gabrielsanya/Codethlon` | [scripts/Codethlon/](scripts/Codethlon/) |
| `users/gabrielsanya/DEM` | [scripts/DEM/](scripts/DEM/) |
| `users/gabrielsanya/Forest` | [scripts/Forest/](scripts/Forest/) |
| `users/gabrielsanya/GEE_SC1` | [scripts/GEE_SC1/](scripts/GEE_SC1/) |
| `users/gabrielsanya/KenyaAtlas` | [scripts/KenyaAtlas/](scripts/KenyaAtlas/) |
| `users/gabrielsanya/Liberia` | [scripts/Liberia/](scripts/Liberia/) |
| `users/gabrielsanya/Oyoun` | [scripts/Oyoun/](scripts/Oyoun/) |
| `users/gabrielsanya/RL_reseeding` | [scripts/RL_reseeding/](scripts/RL_reseeding/) |
| `users/gabrielsanya/Saudi` | [scripts/Saudi/](scripts/Saudi/) |
| `users/gabrielsanya/SaudiAtlas` | [scripts/SaudiAtlas/](scripts/SaudiAtlas/) |
| `users/gabrielsanya/ServirProgram` | [scripts/ServirProgram/](scripts/ServirProgram/) |
| `users/gabrielsanya/Somalia` | [scripts/Somalia/](scripts/Somalia/) |
| `users/gabrielsanya/Sudan` | [scripts/Sudan/](scripts/Sudan/) |
| `users/gabrielsanya/try/Bouar` | [scripts/try/Bouar/](scripts/try/Bouar/) |
| `users/gabrielsanya/try/Galana` | [scripts/try/Galana/](scripts/try/Galana/) |

**Aljouf** already has one placeholder `.js` file per sub-script (e.g. `LST_Aljouf.js`, `NDVI_wet_season.js`). The other 16 project folders each have a short README; add one `.js` file per sub-script as you copy from GEE.

## How to put your GEE code on GitHub

Earth Engine doesn’t export scripts in bulk. For each sub-script:

1. Open [code.earthengine.google.com](https://code.earthengine.google.com/) and open the script (e.g. **Aljouf** → **LST_Aljouf**).
2. Select all code (Ctrl+A / Cmd+A), then copy (Ctrl+C / Cmd+C).
3. In this repo, open the matching file (e.g. `scripts/Aljouf/LST_Aljouf.js`).
4. Replace the placeholder with your pasted code and save.

For projects other than Aljouf, create a new `.js` file in that project’s folder with the same name as in GEE (e.g. `scripts/code101/MyScript.js`).

When you’ve updated files, commit and push:

```powershell
cd "g:\1.Personal\Gabriel_Lapttop\2.Personal\1.Applications\2025-2026\GEE"
git add scripts/
git commit -m "Add GEE script code"
git push
```

## Adding sub-scripts for other projects

If you have a list of sub-script names for another project (e.g. from a screenshot of the GEE Scripts panel), you can add placeholder `.js` files the same way as in Aljouf. Otherwise, add `.js` files manually as you copy from GEE.

Once pushed, all scripts are on GitHub for viewing and sharing.
