// CAR_Bangui_flooded_area
// Sentinel-1 flood detection for Bangui, CAR. Imports: optional geometry (Polygon).
// Based on GEE flood mapping approach (e.g. Seine-et-Marne style).

// Default location (Bangui area)
var pt = ee.Geometry.Point([18.544673, 4.381121]);
var aoi = pt.buffer(20000); // 20 km buffer for display and export

// Load Sentinel-1 C-band SAR Ground Range collection (VV co-polar)
var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(pt)
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');

// Filter by date
var before = collection.filterDate('2021-01-30', '2021-05-30').mosaic();
var after = collection.filterDate('2021-07-01', '2021-08-10').mosaic();

// Threshold smoothed radar intensities to identify "flooded" areas
var SMOOTHING_RADIUS = 100;
var DIFF_UPPER_THRESHOLD = -2;
var diff_smoothed = after.focal_median(SMOOTHING_RADIUS, 'circle', 'meters')
  .subtract(before.focal_median(SMOOTHING_RADIUS, 'circle', 'meters'));
var diff_thresholded = diff_smoothed.lt(DIFF_UPPER_THRESHOLD);

// Display map
var visParams = { min: 0.9, max: 1, palette: ['00FFFF', '0000FF'] };

// Binary mask for flooded pixels
var mask = diff_thresholded.eq(1);
var maskedComposite = diff_thresholded.updateMask(mask);

Map.centerObject(pt, 11);
Map.addLayer(before, { min: -30, max: 0 }, 'Before flood');
Map.addLayer(after, { min: -30, max: 0 }, 'After flood');
Map.addLayer(after.subtract(before), { min: -10, max: 10 }, 'After - before', false);
Map.addLayer(diff_smoothed, { min: -10, max: 10 }, 'diff smoothed', false);
Map.addLayer(maskedComposite, visParams, 'flooded areas - blue', true);

Export.image.toDrive({
  image: diff_thresholded.clip(aoi).toByte(),
  description: 'floods2',
  fileNamePrefix: 'floods2',
  scale: 30,
  region: aoi,
  maxPixels: 1e12
});
