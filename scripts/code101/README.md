# code101

Scripts under **users/gabrielsanya/code101** in the GEE Code Editor. All code101 scripts live here at `scripts/code101/`.

## Structure

| Path | Description |
|------|-------------|
| **03-Supervised-Classification/** | Supervised land cover classification |
| | `01d_Basic_Supervised_Classification_(noimport)_Saudi.js` – Saudi Arabia, S2_SR, Random Forest, GCPs (ujavalgandhi/e2e) |
| **04-Change-Detection/** | Change detection and post-classification comparison |
| | `01b_Spectral_Distance_Change_Mariupol.js` – Two-date S2 cloud-masked RGB (Mariupol) |
| | `Bangui_Post_Classification_Comparison.js` – Before/after classification, transition matrix, area by transition |
| **Fire_Detection_CAR.js** | Burn severity (NBR/dNBR) – CAR study area, S2 or L8, export |
| **Fire_Detection_kenya.js** | Burn severity (NBR/dNBR) – Kenya (ke_pol), S2 or L8, export |

## Adding more scripts

1. In GEE, open the script under `users/gabrielsanya/code101/...`.
2. Copy the code into a new `.js` file under the same path here (e.g. `04-Change-Detection/AnotherScript.js`).
3. Commit and push.

Datasets and Feature Collection assets in GEE are not stored in this repo; only script (`.js`) files are.
