// Thika_Pineapples_Supervised_Classification
// SUPERVISED CLASSIFICATION USING SATELLITE EMBEDDING (Thika, Kenya – pineapple and land cover).
// Imports: geometry (AOI), urban, baresoil, road, pineapple, treecrop, forest, cropland, water (FeatureCollections).
// Palette matches your point colors.

var CLASSES = [
  { name: 'Urban', id: 0, color: '#d73027' },
  { name: 'Bare soil', id: 1, color: '#fc8d59' },
  { name: 'Road', id: 2, color: '#fee08b' },
  { name: 'Pineapple', id: 3, color: '#dda0dd' },
  { name: 'Tree crop', id: 4, color: '#91cf60' },
  { name: 'Forest', id: 5, color: '#1a9850' },
  { name: 'Cropland', id: 6, color: '#ffffbf' },
  { name: 'Water', id: 7, color: '#4575b4' }
];

var palette = CLASSES.map(function(o) { return o.color; });

Map.setOptions('SATELLITE');
Map.centerObject(geometry, 13);
Map.addLayer(geometry, { color: 'white' }, 'AOI (outline)', false);

// Optional Sentinel-2 background
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(geometry)
  .filterDate('2022-01-01', '2022-12-31')
  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  .clip(geometry);
Map.addLayer(s2, { bands: ['B11', 'B8', 'B3'], min: 300, max: 4500 }, 'S2 (background)', true);

// Force consistent labels + style points (same colors as classified)
function setLabelAndName(fc, id, name) {
  return fc.map(function(f) {
    return f.set('landcover', id).set('class_name', name);
  });
}

var urbanL = setLabelAndName(urban, 0, 'Urban');
var baresoilL = setLabelAndName(baresoil, 1, 'Bare soil');
var roadL = setLabelAndName(road, 2, 'Road');
var pineappleL = setLabelAndName(pineapple, 3, 'Pineapple');
var treecropL = setLabelAndName(treecrop, 4, 'Tree crop');
var forestL = setLabelAndName(forest, 5, 'Forest');
var croplandL = setLabelAndName(cropland, 6, 'Cropland');
var waterL = setLabelAndName(water, 7, 'Water');

function addStyledPoints(fc, color, label) {
  var styled = fc.style({
    color: color,
    pointSize: 5,
    pointShape: 'circle',
    width: 1
  });
  Map.addLayer(styled, {}, label, false);
}

addStyledPoints(urbanL, CLASSES[0].color, 'Urban points');
addStyledPoints(baresoilL, CLASSES[1].color, 'Bare soil points');
addStyledPoints(roadL, CLASSES[2].color, 'Road points');
addStyledPoints(pineappleL, CLASSES[3].color, 'Pineapple points');
addStyledPoints(treecropL, CLASSES[4].color, 'Tree crop points');
addStyledPoints(forestL, CLASSES[5].color, 'Forest points');
addStyledPoints(croplandL, CLASSES[6].color, 'Cropland points');
addStyledPoints(waterL, CLASSES[7].color, 'Water points');

// Merge all labeled points
var gcps = urbanL.merge(baresoilL).merge(roadL).merge(pineappleL)
  .merge(treecropL).merge(forestL).merge(croplandL).merge(waterL);
print('Total GCPs:', gcps.size());

// Load satellite embeddings (2022)
var year = 2022;
var startDate = ee.Date.fromYMD(year, 1, 1);
var endDate = startDate.advance(1, 'year');
var embeddingImage = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
  .filterBounds(geometry)
  .filterDate(startDate, endDate)
  .mosaic()
  .clip(geometry);
print('Embedding bands:', embeddingImage.bandNames());

// Sample embeddings at points
var bands = embeddingImage.bandNames();
var samples = embeddingImage.sampleRegions({
  collection: gcps,
  properties: ['landcover'],
  scale: 10,
  geometries: true
});
samples = samples.filter(ee.Filter.notNull(bands));
print('Valid samples:', samples.size());

// Train / test split
var withRandom = samples.randomColumn('rand', 42);
var train = withRandom.filter(ee.Filter.lt('rand', 0.7));
var test = withRandom.filter(ee.Filter.gte('rand', 0.7));
print('Train samples:', train.size());
print('Test samples:', test.size());

// Train Random Forest
var rf = ee.Classifier.smileRandomForest({
  numberOfTrees: 200,
  variablesPerSplit: 8,
  minLeafPopulation: 2,
  bagFraction: 0.7,
  seed: 42
}).train({
  features: train,
  classProperty: 'landcover',
  inputProperties: bands
});

// Accuracy check
var testClassified = test.classify(rf);
var cm = testClassified.errorMatrix('landcover', 'classification');
print('Confusion Matrix:', cm);
print('Overall Accuracy:', cm.accuracy());
print('Kappa:', cm.kappa());

// Classify full image (palette matches point colors)
var classified = embeddingImage.classify(rf).clip(geometry);
Map.addLayer(classified, {
  min: 0,
  max: 7,
  palette: palette
}, 'Classified (Embeddings)', true);

// Optional: simple legend (always visible)
var legend = ui.Panel({
  style: { position: 'bottom-left', padding: '8px 12px' }
});
legend.add(ui.Label('Legend', { style: { fontWeight: 'bold', fontSize: '14px' } }));
CLASSES.forEach(function(c) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: c.color,
      padding: '6px',
      margin: '0 0 2px 6px'
    }
  });
  var description = ui.Label(c.name, { style: { margin: '0 0 2px 6px' } });
  var row = ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
  legend.add(row);
});
Map.add(legend);
