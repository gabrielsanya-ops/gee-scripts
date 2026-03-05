# GEE Scripts Portfolio

Google Earth Engine scripts by Gabriel Sanya — all code available on GitHub.

## Repo layout

| GEE path | File in this repo |
|----------|-------------------|
| `users/gabrielsanya/Aljouf` | [scripts/Aljouf.js](scripts/Aljouf.js) |
| `users/gabrielsanya/code101` | [scripts/code101.js](scripts/code101.js) |
| `users/gabrielsanya/Codethlon` | [scripts/Codethlon.js](scripts/Codethlon.js) |
| `users/gabrielsanya/DEM` | [scripts/DEM.js](scripts/DEM.js) |
| `users/gabrielsanya/Forest` | [scripts/Forest.js](scripts/Forest.js) |
| `users/gabrielsanya/GEE_SC1` | [scripts/GEE_SC1.js](scripts/GEE_SC1.js) |
| `users/gabrielsanya/KenyaAtlas` | [scripts/KenyaAtlas.js](scripts/KenyaAtlas.js) |
| `users/gabrielsanya/Liberia` | [scripts/Liberia.js](scripts/Liberia.js) |
| `users/gabrielsanya/Oyoun` | [scripts/Oyoun.js](scripts/Oyoun.js) |
| `users/gabrielsanya/RL_reseeding` | [scripts/RL_reseeding.js](scripts/RL_reseeding.js) |
| `users/gabrielsanya/Saudi` | [scripts/Saudi.js](scripts/Saudi.js) |
| `users/gabrielsanya/SaudiAtlas` | [scripts/SaudiAtlas.js](scripts/SaudiAtlas.js) |
| `users/gabrielsanya/ServirProgram` | [scripts/ServirProgram.js](scripts/ServirProgram.js) |
| `users/gabrielsanya/Somalia` | [scripts/Somalia.js](scripts/Somalia.js) |
| `users/gabrielsanya/Sudan` | [scripts/Sudan.js](scripts/Sudan.js) |
| `users/gabrielsanya/try/Bouar` | [scripts/try/Bouar.js](scripts/try/Bouar.js) |
| `users/gabrielsanya/try/Galana` | [scripts/try/Galana.js](scripts/try/Galana.js) |

## How to put your GEE code on GitHub

Earth Engine doesn’t export scripts in bulk. For each script:

1. Open [code.earthengine.google.com](https://code.earthengine.google.com/) and open the script (e.g. **Aljouf**).
2. Select all code in the editor (Ctrl+A / Cmd+A), then copy (Ctrl+C / Cmd+C).
3. In this repo, open the matching file (e.g. `scripts/Aljouf.js`).
4. Replace the placeholder lines with your pasted code (you can keep or remove the first comment line).
5. Save the file.

Repeat for every script you want on GitHub. When you’re done, commit and push:

```bash
git add scripts/
git commit -m "Add GEE script code"
git push
```

## First-time GitHub setup

If this folder isn’t a Git repo yet:

```bash
cd "g:\1.Personal\Gabriel_Lapttop\2.Personal\1.Applications\2025-2026\GEE"
git init
git add .
git commit -m "Initial commit: GEE scripts portfolio"
```

Then create a new repository on [GitHub](https://github.com/new) (e.g. name: `gee-scripts`), **don’t** add a README or .gitignore there, and run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/gee-scripts.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` and `gee-scripts` with your GitHub username and repo name.

## Adding a new script later

1. Create a new `.js` file under `scripts/` (e.g. `scripts/MyProject.js` or `scripts/folder/MyScript.js`).
2. Paste your GEE code into it.
3. Optionally add a row to the table in this README.
4. Commit and push.

Once pushed, all your scripts are available on GitHub for viewing, sharing, and cloning.
