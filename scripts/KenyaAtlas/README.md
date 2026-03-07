# KenyaAtlas

Sub-scripts for **users/gabrielsanya/KenyaAtlas** in the GEE Code Editor. Kenya-focused vegetation, land cover, and change detection.

## Scripts

| Script | Description |
|--------|-------------|
| `NDVI_Kenya.js` | Sentinel-2 NDVI (Kenya AOI as imported geometry) |
| `NDVI_TimeAnomaly_Sentinel.js` | Sentinel-2 EVI time series (Kenya `ke_pol`) |
| `Fire_Detection_kenya.js` | dNBR fire/change detection, SCL cloud mask, water/veg mask, area chart, exports |
| `Naivasha.js` | Supervised classification with Google Satellite Embedding V1 (Naivasha), train/test, export |
| `Thika_Pineapples_Supervised_Classification.js` | Thika pineapple and land cover with Satellite Embedding, RF, legend |
| `Busia_Economic_SocioEconomicgrowth.js` | Busia County Decision Dashboard: DW land cover, NDVI, night-lights, rainfall, water, flood risk, charts |

## Adding more scripts

1. In GEE, open the script under `users/gabrielsanya/KenyaAtlas`.
2. Copy the code into a new `.js` file here with the same name.
3. Commit and push.
