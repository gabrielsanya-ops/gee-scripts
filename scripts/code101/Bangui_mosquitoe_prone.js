// Bangui_mosquitoe prone
// SENTINEL-1 FLOOD CHANGE DETECTION – mosquito-prone / flood extent (Bangui, CAR).
// Imports: none (point and dates set below). Uses COPERNICUS/S1_GRD.

var sentinel1 = ee.ImageCollection('COPERNICUS/S1_GRD');

// --- USER INPUTS ---
var pt = ee.Geometry.Point([18.559342622226556, 4.3809575964021565]);
var aoi = pt.buffer(20000); // 20 km buffer

var beforeStart = '2021-01-01';
var beforeEnd = '2021-02-28';

var afterStart = '2021-03-01';
var afterEnd = '2021-06-13';

// Flood threshold
var SMOOTHING_RADIUS = 200;
var DIFF_UPPER_THRESHOLD = -1.5;

// --- MAP SETUP ---
Map.centerObject(aoi, 10);
Map.addLayer(aoi, { color: 'yellow' }, 'AOI', false);

// --- SENTINEL-1 COLLECTION ---
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .select('VV');

// --- PERIOD FILTERS ---
var beforeCol = s1.filterDate(beforeStart, beforeEnd);
var afterCol = s1.filterDate(afterStart, afterEnd);

print('Before collection count:', beforeCol.size());
print('After collection count:', afterCol.size());
print('Before collection:', beforeCol);
print('After collection:', afterCol);

// --- SAFE COMPOSITES ---
// Median is more stable than mosaic for SAR change work
var before = beforeCol.median().clip(aoi);
var after = afterCol.median().clip(aoi);

// --- PROCESSING ---
var beforeSmooth = before.focal_median(SMOOTHING_RADIUS, 'circle', 'meters');
var afterSmooth = after.focal_median(SMOOTHING_RADIUS, 'circle', 'meters');

var diff = after.subtract(before).rename('diff');
var diffSmoothed = afterSmooth.subtract(beforeSmooth).rename('diff_smooth');

// Flooded areas often appear darker in VV after inundation
var floodMask = diffSmoothed.lt(DIFF_UPPER_THRESHOLD).selfMask();

// --- DISPLAY ---
Map.addLayer(before, { min: -25, max: 0 }, 'Before flood');
Map.addLayer(after, { min: -25, max: 0 }, 'After flood');
Map.addLayer(diff, { min: -5, max: 5, palette: ['red', 'white', 'blue'] }, 'After - before', false);
Map.addLayer(diffSmoothed, { min: -5, max: 5, palette: ['red', 'white', 'blue'] }, 'diff smoothed', false);
Map.addLayer(floodMask, { palette: ['0000FF'] }, 'flooded areas - blue', true);

// --- OPTIONAL WATER / TERRAIN CLEANUP ---
// Remove permanent water with JRC surface water
var permanentWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence')
  .gt(80);
var floodMaskNoPermanentWater = floodMask.updateMask(permanentWater.not());

Map.addLayer(floodMaskNoPermanentWater, { palette: ['00FFFF'] }, 'flooded areas without permanent water', false);

// --- AREA ESTIMATE ---
var floodedAreaHa = ee.Image.pixelArea()
  .divide(10000)
  .updateMask(floodMaskNoPermanentWater)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e12,
    bestEffort: true
  });
print('Flooded area (ha):', floodedAreaHa);

// --- EXPORT ---
Export.image.toDrive({
  image: floodMaskNoPermanentWater.toByte(),
  description: 'floods_s1_2021',
  fileNamePrefix: 'floods_s1_2021',
  scale: 10,
  region: aoi,
  maxPixels: 1e12
});
