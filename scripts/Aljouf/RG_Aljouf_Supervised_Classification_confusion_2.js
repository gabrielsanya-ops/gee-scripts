// Refined supervised classification (fewer bands) - confusion matrix_excellent3_2024_refined
// Imports: geometry = Aljouf_poly; urban, baresoil, trees, road, agriculture, sand, vegetation, water, rocks (FeatureCollections with 'landcover')
var geometry = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');
Map.addLayer(geometry, {}, 'Aljouf', false);

function addIndices(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands([ndvi, ndwi]);
}

var s3 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('2024-01-01', '2024-06-30')
  .filterBounds(geometry)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
  .map(addIndices)
  .select(['B11', 'B8', 'B4', 'B3', 'B2', 'NDVI', 'NDWI']);

var composite = s3.median().clip(geometry);

var rgbVis = { min: 0.0, max: 3000, bands: ['B4', 'B3', 'B2'] };
Map.addLayer(composite, rgbVis, 'Composite Image');
Map.setOptions('SATELLITE');
Map.centerObject(geometry, 7);

var gcps = urban.merge(baresoil).merge(trees).merge(road).merge(agriculture)
  .merge(sand).merge(vegetation).merge(water).merge(rocks);

var training = composite.sampleRegions({
  collection: gcps,
  properties: ['landcover'],
  scale: 10
});

var bands = ['B11', 'B8', 'B4', 'B3', 'B2', 'NDVI', 'NDWI'];

var trainingTesting = training.randomColumn();
var trainingSet = trainingTesting.filter(ee.Filter.lessThan('random', 0.8));
var testingSet = trainingTesting.filter(ee.Filter.greaterThanOrEquals('random', 0.8));

var trained = ee.Classifier.smileRandomForest(10).train({
  features: trainingSet,
  classProperty: 'landcover',
  inputProperties: bands
});

var testClassification = testingSet.classify(trained);
var confusionMatrix = testClassification.errorMatrix('landcover', 'classification');

print('Confusion matrix:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());
print('Producers Accuracy:', confusionMatrix.producersAccuracy());
print('Consumers Accuracy:', confusionMatrix.consumersAccuracy());

var classifier = ee.Classifier.smileRandomForest(50).train({
  features: trainingSet,
  classProperty: 'landcover',
  inputProperties: bands
});

var classified = composite.classify(classifier);
Map.addLayer(classified, {
  min: 1,
  max: 10,
  palette: ['#857f7b', '#F5BF4D', '#06820d', '#0E0D0D', '#F0ED0D', '#d7a926', '#6cb500', '#1c11d6', '#817656']
}, 'Classified Image');

Export.image.toDrive({
  image: classified,
  description: 'classified',
  folder: 'classified',
  fileNamePrefix: 'classified',
  region: geometry,
  scale: 10,
  maxPixels: 1e13
});
