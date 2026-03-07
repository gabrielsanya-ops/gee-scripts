// Nigeria_Crop
// MAIZE LAND CLASSIFICATION – Nigeria. Uses Sentinel-2 and EE community tutorial assets for AOI/training/validation.

// -------------------- COUNTRY / AOI --------------------
var dataset = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
var nigeria = dataset.filter(ee.Filter.eq('country_na', 'Nigeria'));
print('Nigeria:', nigeria);

var nigeriaBorder = nigeria.style({ color: 'white', width: 2 });

Map.setOptions('SATELLITE');
Map.centerObject(nigeria, 6);
Map.addLayer(nigeriaBorder, {}, 'Nigeria border');

var aoi = ee.FeatureCollection('projects/earthengine-community/tutorials/classify-maizeland-ng/aoi');
Map.addLayer(aoi, { color: 'white' }, 'AOI');

// -------------------- TRAIN / VALIDATION --------------------
var trainingPts = ee.FeatureCollection('projects/earthengine-community/tutorials/classify-maizeland-ng/training-pts');
var validationPts = ee.FeatureCollection('projects/earthengine-community/tutorials/classify-maizeland-ng/validation-pts');

Map.addLayer(trainingPts, { color: 'green' }, 'Training points');
Map.addLayer(validationPts, { color: 'yellow' }, 'Validation points');

// -------------------- SENTINEL-2 INPUT --------------------
var start = '2017-06-15';
var end = '2017-10-15';

var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate(start, end)
  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 60));

var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
  .filterBounds(aoi)
  .filterDate(start, end);

// -------------------- JOIN CLOUD PROBABILITY --------------------
// Match each S2 SR image with its cloud probability image by system:index
var joined = s2Sr.map(function(image) {
  var id = image.get('system:index');
  var cloudImage = s2Clouds.filter(ee.Filter.eq('system:index', id)).first();
  return image.set('cloud_mask', cloudImage);
});

// -------------------- CLOUD MASK FUNCTION --------------------
function maskS2(image) {
  var cloudProb = ee.Image(image.get('cloud_mask')).select('probability');
  var isCloud = cloudProb.gt(40);
  var scl = image.select('SCL');
  var sclMask = scl.neq(3)   // cloud shadow
    .and(scl.neq(8))        // cloud medium probability
    .and(scl.neq(9))        // cloud high probability
    .and(scl.neq(10))       // cirrus
    .and(scl.neq(11));      // snow
  return image
    .updateMask(isCloud.not())
    .updateMask(sclMask)
    .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])
    .copyProperties(image, ['system:time_start']);
}

// -------------------- COMPOSITE --------------------
var s2Masked = joined.map(maskS2);
print('Masked S2 image count:', s2Masked.size());

var mosaic = s2Masked.median().clip(aoi);
Map.addLayer(mosaic, { bands: ['B11', 'B8', 'B3'], min: 200, max: 4000 }, 'S2 composite');

// -------------------- FEATURES FOR CLASSIFICATION --------------------
var ndvi = mosaic.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = mosaic.normalizedDifference(['B3', 'B8']).rename('NDWI');
var nbr = mosaic.normalizedDifference(['B8', 'B12']).rename('NBR');

var imageCl = mosaic.addBands([ndvi, ndwi, nbr]);
var bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'NDWI', 'NBR'];

// -------------------- TRAINING SAMPLE --------------------
var training = imageCl.sampleRegions({
  collection: trainingPts,
  properties: ['class'],
  scale: 20,
  tileScale: 4
}).filter(ee.Filter.notNull(bands));

print('Training sample count:', training.size());
print('Training sample histogram:', training.aggregate_histogram('class'));

// -------------------- TRAIN CLASSIFIERS --------------------
var trainedCart = ee.Classifier.smileCart().train({
  features: training,
  classProperty: 'class',
  inputProperties: bands
});

var trainedRf = ee.Classifier.smileRandomForest({
  numberOfTrees: 30,
  seed: 42
}).train({
  features: training,
  classProperty: 'class',
  inputProperties: bands
});

// -------------------- CLASSIFY IMAGE --------------------
var classifiedCart = imageCl.classify(trainedCart).clip(aoi);
var classifiedRf = imageCl.classify(trainedRf).clip(aoi);

var classVis = { min: 0, max: 1, palette: ['f2c649', '484848'] };

Map.addLayer(classifiedCart, classVis, 'Classes (CART)', false);
Map.addLayer(classifiedRf, classVis, 'Classes (RF)', true);

// -------------------- TRAINING ACCURACY --------------------
var trainAccuracyCart = trainedCart.confusionMatrix();
var trainAccuracyRf = trainedRf.confusionMatrix();

print('#### TRAINING ACCURACY ####');
print('CART: overall accuracy:', trainAccuracyCart.accuracy());
print('RF: overall accuracy:', trainAccuracyRf.accuracy());
print('CART: error matrix:', trainAccuracyCart);
print('RF: error matrix:', trainAccuracyRf);

// -------------------- VALIDATION --------------------
var validation = imageCl.sampleRegions({
  collection: validationPts,
  properties: ['class'],
  scale: 20,
  tileScale: 4
}).filter(ee.Filter.notNull(bands));

print('Validation sample count:', validation.size());
print('Validation sample histogram:', validation.aggregate_histogram('class'));

var validatedCart = validation.classify(trainedCart);
var validatedRf = validation.classify(trainedRf);

var testAccuracyCart = validatedCart.errorMatrix('class', 'classification');
var testAccuracyRf = validatedRf.errorMatrix('class', 'classification');

print('#### VALIDATION ACCURACY ####');
print('CART validation overall accuracy:', testAccuracyCart.accuracy());
print('RF validation overall accuracy:', testAccuracyRf.accuracy());
print('CART validation error matrix:', testAccuracyCart);
print('RF validation error matrix:', testAccuracyRf);
print('RF validation kappa:', testAccuracyRf.kappa());

// -------------------- AREA CALCULATION --------------------
var areaImage = ee.Image.pixelArea().addBands(classifiedRf);

var areas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'class' }),
  geometry: aoi.geometry(),
  scale: 20,
  maxPixels: 1e12,
  tileScale: 4
});

print('#### CLASS AREA SQ. METERS ####');
print(areas);

// -------------------- EXPORT --------------------
Export.image.toDrive({
  image: classifiedRf.toByte(),
  description: 'Maizeland_Classified_RF',
  fileNamePrefix: 'Maizeland_Classified_RF',
  scale: 20,
  region: aoi.geometry(),
  maxPixels: 1e13
});
