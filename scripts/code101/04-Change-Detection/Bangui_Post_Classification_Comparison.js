// Post-classification comparison for Bangui. Imports: bangui (geometry), urban, water, vegetation, road (FeatureCollections with 'landcover')
// Before period: 2018-01-01 to 2019-02-01; After period: 2019-01-01 to 2020-02-01

var s2 = ee.ImageCollection('COPERNICUS/S2_SR');

var before = s2
  .filterDate('2018-01-01', '2019-02-01')
  .filterBounds(bangui)
  .select('B.*')
  .median()
  .clip(bangui);

var after = s2
  .filterDate('2019-01-01', '2020-02-01')
  .filterBounds(bangui)
  .select('B.*')
  .median()
  .clip(bangui);

var gcps = urban.merge(water).merge(vegetation).merge(road);
var training = before.sampleRegions({ collection: gcps, properties: ['landcover'], scale: 10 });
var classifier = ee.Classifier.smileRandomForest(50).train({
  features: training,
  classProperty: 'landcover',
  inputProperties: before.bandNames()
});

var beforeClassified = before.classify(classifier);
var afterClassified = after.classify(classifier);

Map.addLayer(beforeClassified, { min: 0, max: 5, palette: ['gray', 'brown', 'blue', 'green', 'black'] }, 'before_classified');

var rgbVis = { min: 0, max: 3000, bands: ['B4', 'B3', 'B2'] };
Map.addLayer(after, rgbVis, 'after');
Map.addLayer(afterClassified, { min: 0, max: 5, palette: ['gray', 'brown', 'blue', 'green', 'black'] }, 'after_classified');

// Reclassify 0-4 to 1-5 for transition matrix
var beforeClasses = beforeClassified.remap([0, 1, 2, 3, 4], [1, 2, 3, 4, 5]).rename('before');
var afterClasses = afterClassified.remap([0, 1, 2, 3, 4], [1, 2, 3, 4, 5]).rename('after');

var changed = afterClasses.subtract(beforeClasses).neq(0).rename('changed');
Map.addLayer(changed, { min: 0, max: 1, palette: ['white', 'red'] }, 'Change');

// Unique transition codes: beforeClass*100 + afterClass (e.g. 102 = class 1 to class 2)
var merged = beforeClasses.multiply(100).add(afterClasses).rename('transitions');

var transitionMatrix = merged.reduceRegion({
  reducer: ee.Reducer.frequencyHistogram(),
  geometry: bangui,
  scale: 10,
  maxPixels: 1e10,
  tileScale: 16
});
print('Transition pixel counts:', transitionMatrix.get('transitions'));

// Area by transition class (km²) using grouped reducer
var areaImage = ee.Image.pixelArea().divide(1e6).addBands(merged);
var areas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'transitions' }),
  geometry: bangui,
  scale: 100,
  tileScale: 4,
  maxPixels: 1e10
});
var classAreas = ee.List(areas.get('groups'));
var classTransitionsAreaDict = ee.Dictionary.fromLists(
  classAreas.map(function(item) {
    var d = ee.Dictionary(item);
    return ee.Number(d.get('transitions')).format();
  }),
  classAreas.map(function(item) {
    var d = ee.Dictionary(item);
    return ee.Number(d.get('sum')).round();
  })
);
print('Transition areas (km²):', classTransitionsAreaDict);
