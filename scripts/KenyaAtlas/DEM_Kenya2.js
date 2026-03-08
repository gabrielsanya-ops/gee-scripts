// DEM_Kenya2&download
// Merged DEM + hillshade: ETOPO1 hillshade and SRTM 30m for Kenya, export to Drive.
// Imports: table (e.g. Table users/gabrielsanya/ke_pol)

// =====================
// MERGED DEM + HILLSHADE SCRIPT
// =====================

// 1. Load AOI from your asset/table
var shp = ee.FeatureCollection(table);
var aoi = shp.geometry();

// Display AOI
Map.centerObject(shp, 6);
Map.addLayer(shp, { color: 'red' }, 'AOI Boundary');

// =====================
// 2. ETOPO1 HILLSHADE
// =====================

var elevation = ee.Image('NOAA/NGDC/ETOPO1').select('bedrock');
var exaggeration = 20;
var hillshade = ee.Terrain.hillshade(elevation.multiply(exaggeration));
var hillshade_roi = hillshade.clip(aoi);

Map.addLayer(hillshade_roi, { min: 0, max: 255 }, 'ETOPO1 Hillshade');

Export.image.toDrive({
  image: hillshade_roi,
  description: 'Kenya_Hillshade_ETOP01',
  fileNamePrefix: 'Kenya_Hillshade_ETOPO1',
  region: aoi,
  scale: 30, // ETOP01 is coarse, 30 m export does not increase detail
  folder: 'KenyaAtlas',
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});

// =====================
// 3. SRTM DEM 30m
// =====================

var dem = ee.Image('USGS/SRTMGL1_003');
print('SRTM DEM nominal scale (m):', dem.projection().nominalScale());

var demClipped = dem.clip(aoi);
Map.addLayer(demClipped, {
  min: 0,
  max: 3000,
  palette: ['white', 'lightgray', 'gray', 'darkgray', 'black']
}, 'SRTM DEM 30m');

Export.image.toDrive({
  image: demClipped,
  description: 'Kenya_DEM_SRTM_30m',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Kenya_DEM_SRTM_30m',
  region: aoi.bounds(),
  scale: 30,
  crs: 'EPSG:4326',
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});
