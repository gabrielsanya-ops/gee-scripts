// Imports: aoi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

// Time ranges for the two periods
var startPeriod1 = '2021-06-30';
var endPeriod1 = '2022-06-30';
var startPeriod2 = '2023-06-30';
var endPeriod2 = '2024-06-30';

function calculateNDVI(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
}

function getMedianNDVI(start, end) {
  return ee.ImageCollection('COPERNICUS/S2')
    .filterDate(start, end)
    .filterBounds(aoi)
    .map(calculateNDVI)
    .median()
    .clip(aoi);
}

var ndviPeriod1 = getMedianNDVI(startPeriod1, endPeriod1);
var ndviPeriod2 = getMedianNDVI(startPeriod2, endPeriod2);
var ndviDifference = ndviPeriod2.subtract(ndviPeriod1).rename('NDVI_Difference');

// Change detection thresholds
var positiveChangeThreshold = 0.1;
var negativeChangeThreshold = -0.1;

// Classify change categories
var positiveChange = ndviDifference.gt(positiveChangeThreshold).rename('positive');
var negativeChange = ndviDifference.lt(negativeChangeThreshold).rename('negative');
var noChange = ndviDifference.gte(negativeChangeThreshold)
  .and(ndviDifference.lte(positiveChangeThreshold))
  .rename('no_change');

// Area calculation
var pixelArea = ee.Image.pixelArea();
var scale = 100;

var positiveChangeArea = ee.Number(
  positiveChange.multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: scale,
      maxPixels: 1e9,
      bestEffort: true
    })
    .get('positive')
).divide(10000);

var negativeChangeArea = ee.Number(
  negativeChange.multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: scale,
      maxPixels: 1e9,
      bestEffort: true
    })
    .get('negative')
).divide(10000);

var noChangeArea = ee.Number(
  noChange.multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: scale,
      maxPixels: 1e9,
      bestEffort: true
    })
    .get('no_change')
).divide(10000);

print('Positive Change Area (ha):', positiveChangeArea);
print('Negative Change Area (ha):', negativeChangeArea);
print('No Change Area (ha):', noChangeArea);

// Visualization
var ndviParams = { min: -1, max: 1, palette: ['blue', 'white', 'green'] };

Map.centerObject(aoi, 10);
Map.addLayer(ndviPeriod1, ndviParams, 'NDVI Period 1');
Map.addLayer(ndviPeriod2, ndviParams, 'NDVI Period 2');
Map.addLayer(ndviDifference, ndviParams, 'NDVI Difference');

// Bar chart of change areas
var chart = ui.Chart.array.values({
  array: ee.Array([positiveChangeArea, negativeChangeArea, noChangeArea]),
  axis: 0,
  xLabels: ['Positive Change', 'Negative Change', 'No Change']
})
  .setChartType('BarChart')
  .setOptions({
    title: 'Area of NDVI Change Categories',
    hAxis: { title: 'Change Category' },
    vAxis: { title: 'Area (hectares)' },
    legend: { position: 'none' },
    colors: ['#42FF33', '#FF4633', '#FFB833']
  });

print(chart);
print('NDVI Difference Image', ndviDifference);
