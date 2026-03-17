// SUPERVISED CLASSIFICATION WITH SATELLITE EMBEDDINGS (GEE)
// AOI asset: projects/ee-gabrielsanya/assets/SaudiForest/...
// Classifier: Gradient Boosted Trees / smileGradientTreeBoost
//
// Imports in your script (Geometry Imports):
// farms, water, other, coffee, forest, rock, shrubland
//
// Colors harmonized to match your layer list:
// farms      = green
// water      = blue
// other      = gray
// coffee     = red
// forest     = olive green
// rock       = tan
// shrubland  = light green

// ----------------------------
// 0) REQUIRED USER IMPORTS
// ----------------------------
// This script expects you to have these geometry imports in the Code Editor:
// `farms`, `water`, `other`, `coffee`, `forest`, `rock`, `shrubland`
// Each should be a FeatureCollection defining training polygons/points.

// ----------------------------
// 1) LABEL TRAINING DATA
// ----------------------------
var classDefs = [
  { name: 'farms', value: 0, color: '00a651' },
  { name: 'water', value: 1, color: '1f77b4' },
  { name: 'other', value: 2, color: '9e9e9e' },
  { name: 'coffee', value: 3, color: 'e31a1c' },
  { name: 'forest', value: 4, color: '556b2f' },
  { name: 'rock', value: 5, color: 'd2b48c' },
  { name: 'shrubland', value: 6, color: 'a6d96a' }
];

function withClass(fc, value, name) {
  return ee.FeatureCollection(fc).map(function (f) {
    return f.set({ class: value, class_name: name });
  });
}

var trainingFc = ee.FeatureCollection([])
  .merge(withClass(farms, 0, 'farms'))
  .merge(withClass(water, 1, 'water'))
  .merge(withClass(other, 2, 'other'))
  .merge(withClass(coffee, 3, 'coffee'))
  .merge(withClass(forest, 4, 'forest'))
  .merge(withClass(rock, 5, 'rock'))
  .merge(withClass(shrubland, 6, 'shrubland'));

// Derive AOI from all training geometries (can be replaced with your own AOI import).
var aoi = trainingFc.geometry().buffer(0);
Map.centerObject(aoi, 11);
Map.setOptions('SATELLITE');

// ----------------------------
// 2) INPUT FEATURES (EMBEDDINGS + OPTIONAL RGB)
// ----------------------------
// Uses the public Google Satellite Embedding v1 yearly mosaics.
// If you prefer a different year, update EMBED_YEAR.
var EMBED_YEAR = 2023;
var embed = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
  .filter(ee.Filter.eq('year', EMBED_YEAR))
  .mosaic()
  .clip(aoi);

// Pick all numeric embedding bands (they’re named like 'embedding_0' ...).
var embedBands = embed.bandNames();

// Optional: add Sentinel-2 median RGB as additional predictors.
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate(EMBED_YEAR + '-01-01', EMBED_YEAR + '-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
  .median()
  .clip(aoi);

var predictors = embed.addBands(s2.select(['B2', 'B3', 'B4', 'B8'], ['Blue', 'Green', 'Red', 'NIR']));
var predictorBands = embedBands.cat(ee.List(['Blue', 'Green', 'Red', 'NIR']));

// ----------------------------
// 3) SAMPLE TRAINING
// ----------------------------
var samples = predictors.sampleRegions({
  collection: trainingFc,
  properties: ['class'],
  scale: 10,
  tileScale: 4
}).filter(ee.Filter.notNull(predictorBands));

// Train/test split
var split = 0.7;
samples = samples.randomColumn('rand', 42);
var train = samples.filter(ee.Filter.lt('rand', split));
var test = samples.filter(ee.Filter.gte('rand', split));

// ----------------------------
// 4) TRAIN CLASSIFIER (GBDT)
// ----------------------------
var classifier = ee.Classifier.smileGradientTreeBoost({
  numberOfTrees: 200,
  shrinkage: 0.05,
  maxNodes: 64,
  samplingRate: 0.7,
  seed: 42
}).train({
  features: train,
  classProperty: 'class',
  inputProperties: predictorBands
});

// ----------------------------
// 5) VALIDATE
// ----------------------------
var testClassified = test.classify(classifier);
var cm = testClassified.errorMatrix('class', 'classification');
print('Confusion matrix', cm);
print('Overall accuracy', cm.accuracy());
print('Kappa', cm.kappa());

// ----------------------------
// 6) CLASSIFY + DISPLAY
// ----------------------------
var classified = predictors.classify(classifier).rename('class').clip(aoi);

var palette = classDefs.map(function (d) { return d.color; });
var labels = classDefs.map(function (d) { return d.name; });

Map.addLayer(s2.select(['B4', 'B3', 'B2']).divide(10000), { min: 0.02, max: 0.3 }, 'Sentinel-2 RGB (' + EMBED_YEAR + ')', false);
Map.addLayer(classified, { min: 0, max: classDefs.length - 1, palette: palette }, 'Coffee_builtup: classified', true);

// Legend
var legend = ui.Panel({ style: { position: 'bottom-left', padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.92)' } });
legend.add(ui.Label('Coffee_builtup classes', { fontWeight: 'bold' }));
for (var i = 0; i < labels.length; i++) {
  var row = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '2px 0' } });
  row.add(ui.Label(' ', { width: '16px', height: '12px', backgroundColor: '#' + palette[i] }));
  row.add(ui.Label(labels[i], { fontSize: '12px', margin: '0 0 0 6px' }));
  legend.add(row);
}
Map.add(legend);

// ----------------------------
// 7) OPTIONAL EXPORT
// ----------------------------
// Export.image.toDrive({
//   image: classified.toByte(),
//   description: 'Coffee_builtup_classified_' + EMBED_YEAR,
//   folder: 'GEE_Exports',
//   fileNamePrefix: 'Coffee_builtup_classified_' + EMBED_YEAR,
//   region: aoi,
//   scale: 10,
//   maxPixels: 1e13
// });

