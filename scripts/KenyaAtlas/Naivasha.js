// Naivasha
// SUPERVISED CLASSIFICATION USING GOOGLE SATELLITE EMBEDDING V1
// 64-dimensional annual embedding dataset (Naivasha area, Kenya).
// Required imports: roi (Point), geometry (Polygon), veg1–veg5, structure (FeatureCollections with property: landcover).

// -------------------- TRAINING DATA --------------------
var trainingPolygons = veg1.merge(veg2).merge(veg3).merge(veg4).merge(veg5).merge(structure);

print('Training polygons:', trainingPolygons);
print('Training polygons size:', trainingPolygons.size());
print('Training polygons first:', trainingPolygons.first());

// -------------------- ANALYSIS AREA --------------------
var trainingBounds = trainingPolygons.geometry().bounds();
var analysisArea = ee.FeatureCollection([ee.Feature(roi), ee.Feature(trainingBounds)])
  .geometry()
  .bounds();

Map.centerObject(analysisArea, 11);
Map.addLayer(analysisArea, { color: 'yellow' }, 'Analysis area', false);

// -------------------- LOAD LATEST EMBEDDING --------------------
var embeddingCol = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
  .filterBounds(analysisArea)
  .sort('system:time_start', false);

print('Embedding collection:', embeddingCol);
print('Embedding collection size:', embeddingCol.size());

var embeddingImage = embeddingCol.first().clip(analysisArea);

print('Embedding image:', embeddingImage);
print('Embedding date:', embeddingImage.get('system:time_start'));

// -------------------- BUILD 64-BAND LIST --------------------
var bands = ee.List.sequence(1, 64).map(function(n) {
  return ee.String('A').cat(ee.Number(n).format('%02d'));
});
print('Embedding bands:', bands);

// -------------------- DISPLAY --------------------
// These are not RGB bands; pseudo-color view using 3 embedding axes.
Map.addLayer(
  embeddingImage,
  { bands: ['A01', 'A16', 'A09'], min: -0.3, max: 0.3 },
  'Embedding pseudo-color'
);

Map.setOptions('SATELLITE');

// -------------------- SAMPLE TRAINING DATA --------------------
var training = embeddingImage.select(bands).sampleRegions({
  collection: trainingPolygons,
  properties: ['landcover'],
  scale: 10,
  geometries: true
}).filter(ee.Filter.notNull(bands));

print('Training samples:', training);
print('Training sample count:', training.size());
print('Training sample example:', training.first());
print('Training histogram:', training.aggregate_histogram('landcover'));

// -------------------- SPLIT TRAIN / TEST --------------------
var withRandom = training.randomColumn('random', 42);
var trainSet = withRandom.filter(ee.Filter.lt('random', 0.7));
var testSet = withRandom.filter(ee.Filter.gte('random', 0.7));

print('Train count:', trainSet.size());
print('Test count:', testSet.size());

// -------------------- TRAIN CLASSIFIER --------------------
var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 200,
  seed: 42
}).train({
  features: trainSet,
  classProperty: 'landcover',
  inputProperties: bands
});

// -------------------- CLASSIFY --------------------
var classified = embeddingImage.select(bands).classify(classifier);
var clipped = classified.clip(geometry);

Map.addLayer(
  clipped,
  { min: 0, max: 5, palette: ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] },
  'Embedding classification'
);

// -------------------- VALIDATION --------------------
var validated = testSet.classify(classifier);
var confusionMatrix = validated.errorMatrix('landcover', 'classification');

print('Confusion matrix:', confusionMatrix);
print('Overall accuracy:', confusionMatrix.accuracy());
print('Kappa:', confusionMatrix.kappa());

// -------------------- EXPORT --------------------
Export.image.toDrive({
  image: clipped.toByte(),
  description: 'naivasha_embedding_classified_latest',
  folder: 'earthengine',
  fileNamePrefix: 'naivasha_embedding_classified_latest',
  region: geometry,
  scale: 10,
  maxPixels: 1e10
});
