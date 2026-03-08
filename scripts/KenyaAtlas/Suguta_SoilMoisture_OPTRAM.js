// OPTRAM FROM SENTINEL-2 — Suguta AOI
// CARTOGRAPHIC VERSION WITH LEGEND

// ==================== USER SETTINGS ====================
var AOI_ASSET = 'projects/ee-gabrielsanya-kenya/assets/Suguta/Suguta_Map_aoi';
var startDate = '2023-02-01';
var endDate = '2023-05-31';
var cloudPct = 20;
var statScale = 60;

// ==================== LOAD AOI ====================
var aoiFc = ee.FeatureCollection(AOI_ASSET);
var aoi = aoiFc.geometry().dissolve();
Map.centerObject(aoi, 12);
var aoiOutline = ee.Image().byte().paint({ featureCollection: aoiFc, color: 1, width: 2 });
Map.addLayer(aoiOutline, { palette: ['ffffff'] }, 'AOI', true);

// ==================== LOAD SENTINEL-2 SR ====================
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(startDate, endDate)
  .filterBounds(aoi)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudPct));
print('Sentinel-2 image count:', s2.size());

// ==================== CLOUD MASK ====================
function maskS2(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).copyProperties(image, ['system:time_start']);
}
var s2Masked = s2.map(maskS2);

// ==================== SEASONAL COMPOSITE ====================
var composite = ee.Algorithms.If(
  s2Masked.size().gt(0),
  s2Masked.median().clip(aoi).divide(10000).select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'QA60']),
  ee.Image.constant([0, 0, 0, 0, 0, 0, 0]).rename(['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'QA60']).clip(aoi)
);
composite = ee.Image(composite).clip(aoi);

// ==================== MAP LAYERS (RGB) ====================
Map.addLayer(composite, { bands: ['B4', 'B3', 'B2'], min: 0.02, max: 0.30 }, 'Sentinel-2 Natural Color', false);
Map.addLayer(composite, { bands: ['B11', 'B8', 'B4'], min: 0.03, max: 0.35 }, 'Sentinel-2 False Color', true);

// ==================== NDVI AND STR ====================
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');
var str = composite.select('B12').rename('SWIR');
str = str.expression('((1 - s) * (1 + s)) / ((2 * s) + 0.000001)', { s: str.select('SWIR') }).rename('STR');
Map.addLayer(ndvi.clip(aoi), { min: 0, max: 0.8, palette: ['#8c510a', '#d8b365', '#f6e8c3', '#c7eae5', '#5ab4ac', '#01665e'] }, 'NDVI', false);

// ==================== FULL COVER AND BARE SOIL MASKS ====================
var fullCoverMask = ndvi.gte(0.5);
var bareSoilMask = ndvi.gte(0.0).and(ndvi.lte(0.2));
var strFullCover = str.updateMask(fullCoverMask);
var strBareSoil = str.updateMask(bareSoilMask);
Map.addLayer(fullCoverMask.selfMask().clip(aoi), { palette: '00A651' }, 'Full Cover Mask', false);
Map.addLayer(bareSoilMask.selfMask().clip(aoi), { palette: 'C68642' }, 'Bare Soil Mask', false);

// ==================== EXTRACT OPTRAM PARAMETERS ====================
var fullStats = strFullCover.reduceRegion({
  reducer: ee.Reducer.percentile([5, 95]),
  geometry: aoi,
  scale: statScale,
  bestEffort: true,
  maxPixels: 1e12,
  tileScale: 4
});
var bareStats = strBareSoil.reduceRegion({
  reducer: ee.Reducer.percentile([5, 95]),
  geometry: aoi,
  scale: statScale,
  bestEffort: true,
  maxPixels: 1e12,
  tileScale: 4
});
var vd_opt = ee.Number(ee.Dictionary(fullStats).get('STR_p5'));
var vw_opt = ee.Number(ee.Dictionary(fullStats).get('STR_p95'));
var id_opt = ee.Number(ee.Dictionary(bareStats).get('STR_p5'));
var iw_opt = ee.Number(ee.Dictionary(bareStats).get('STR_p95'));
var sd_opt = vd_opt.subtract(id_opt);
var sw_opt = vw_opt.subtract(iw_opt);
print('vd_opt', vd_opt);
print('vw_opt', vw_opt);
print('id_opt', id_opt);
print('iw_opt', iw_opt);
print('sd_opt', sd_opt);
print('sw_opt', sw_opt);

// ==================== CALCULATE OPTRAM ====================
var optram = str.expression(
  '((id + sd - n - t) / (((id - iw) + ((sd - sw) * n)) + 0.000001)) * 100',
  {
    t: str,
    n: ndvi,
    id: id_opt,
    sd: sd_opt,
    iw: iw_opt,
    sw: sw_opt
  }
).rename('OPTRAM').clip(aoi).clamp(0, 100);

// ==================== CARTOGRAPHIC OPTRAM VISUALIZATION ====================
var optramPalette = ['7f0000', 'd7301f', 'fc8d59', 'fee08b', 'd9ef8b', '91cf60', '08306b'];
var optramVis = { min: 0, max: 100, palette: optramPalette };
Map.addLayer(optram, optramVis, 'OPTRAM Moisture Index', true);
Map.addLayer(str.clip(aoi), { min: 0, max: 1, palette: ['fff7ec', 'fdd49e', 'fd8d3c', 'e34a33', '7f0000'] }, 'STR', false);

// ==================== CLASSIFIED MOISTURE ZONES ====================
var moistureClass = ee.Image(0)
  .where(optram.gte(0).and(optram.lt(15)), 1)
  .where(optram.gte(15).and(optram.lt(30)), 2)
  .where(optram.gte(30).and(optram.lt(45)), 3)
  .where(optram.gte(45).and(optram.lt(60)), 4)
  .where(optram.gte(60).and(optram.lt(75)), 5)
  .where(optram.gte(75).and(optram.lt(90)), 6)
  .where(optram.gte(90), 7)
  .updateMask(optram.mask())
  .rename('Moisture_Class');
var classPalette = ['7f0000', 'd7301f', 'fc8d59', 'fee08b', 'd9ef8b', '66c2a5', '3288bd'];
Map.addLayer(moistureClass.clip(aoi), { min: 1, max: 7, palette: classPalette }, 'OPTRAM Moisture Classes', false);

// ==================== LEGEND ====================
function addLegendRow(color, label) {
  var row = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '2px 0' } });
  row.add(ui.Label(' ', { width: '18px', height: '14px', backgroundColor: '#' + color }));
  row.add(ui.Label(label, { fontSize: '12px', color: 'black' }));
  return row;
}
var legend = ui.Panel({
  style: { position: 'bottom-left', padding: '10px 12px', width: '260px', backgroundColor: 'rgba(255,255,255,0.92)' }
});
legend.add(ui.Label('OPTRAM Moisture Legend', { fontWeight: 'bold', fontSize: '14px', color: 'black' }));
legend.add(ui.Label('Low values = drier surface, high values = wetter surface', { fontSize: '11px', color: '#333' }));
legend.add(addLegendRow('7f0000', '0-15 Very dry'));
legend.add(addLegendRow('d7301f', '15-30 Dry'));
legend.add(addLegendRow('fc8d59', '30-45 Moderately dry'));
legend.add(addLegendRow('fee08b', '45-60 Moderate'));
legend.add(addLegendRow('d9ef8b', '60-75 Moist'));
legend.add(addLegendRow('66c2a5', '75-90 Wet'));
legend.add(addLegendRow('3288bd', '90-100 Very wet'));
Map.add(legend);

// ==================== TITLE PANEL ====================
var titlePanel = ui.Panel({
  style: { position: 'top-left', padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.6)' }
});
titlePanel.add(ui.Label('Suguta OPTRAM Surface Moisture', { fontWeight: 'bold', fontSize: '16px', color: 'white' }));
titlePanel.add(ui.Label('Period: ' + startDate + ' to ' + endDate, { fontSize: '12px', color: 'white' }));
Map.add(titlePanel);

// ==================== EXPORT ====================
Export.image.toDrive({
  image: optram.toFloat(),
  description: 'Suguta_OPTRAM_2023_Feb_May',
  folder: 'KSA_range',
  fileNamePrefix: 'Suguta_OPTRAM_2023_Feb_May',
  region: aoi,
  scale: 10
});
