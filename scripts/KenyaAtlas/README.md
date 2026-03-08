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
| `Busia_LightUp.js` | VIIRS night lights per constituency (2019–2025), trend slope, tiers, choropleth, sparklines, area illuminated vs non illuminated |
| `Busia_similarity_search.js` | Similarity search with satellite embeddings (reference points in `samples`), Busia search area, predicted matches |
| `DEM_Kenya2.js` | ETOPO1 hillshade + SRTM DEM 30m for Kenya (ke_pol), export both to Drive (KenyaAtlas / GEE_Exports) |
| `ForestMonitor_EVI-NDV.js` | MODIS EVI forest condition trend (Western/Eastern Mau), greening/browning, Sen slope, area table, scatter by year |
| `GalanaKulalu.js` | Galana-Kulalu food security: AOI, pilot/PPP/demo farms, ESRI LULC, S2 water/irrigation, Landsat NDVI/EVI/SAVI, CHIRPS rainfall, VIIRS night lights, yield estimation, charts and milestones |
| `Galana_Crop_Monitoring.js` | IGAD crop condition monitoring (Galana-Kulalu): S2 composites, consensus land cover, cropland mask, NDVI/EVI/SAVI/NDMI/NDWI, baseline and anomalies, CHIRPS/SPI, VCI stress, yield outlook, water/terrain, charts and dashboard |
| `Kenya_rainfall.js` | CHIRPS annual rainfall by Kenya county (KeCounty), mean and std dev, choropleth by deviation from mean, legend, CSV export to Drive |
| `Suguta_SoilMoisture_OPTRAM.js` | OPTRAM soil moisture from Sentinel-2 (Suguta AOI): STR, NDVI, full-cover/bare-soil percentiles, OPTRAM index, 7 moisture classes, legend, export to Drive |

## Adding more scripts

1. In GEE, open the script under `users/gabrielsanya/KenyaAtlas`.
2. Copy the code into a new `.js` file here with the same name.
3. Commit and push.
