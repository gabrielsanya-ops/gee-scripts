// Imports: aljouf = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var aljouf = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');
// Simplify region to reduce memory
var simplifiedAljouf = aljouf.geometry().simplify(1000);

var calculateNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};

var sentinelCollection = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(simplifiedAljouf)
  .filterDate('2015-06-23', '2024-08-01') // Start when Sentinel-2 became operational
  .map(calculateNDVI)
  .select('NDVI');

var ndviAljouf = sentinelCollection.map(function(image) {
  return image.clip(simplifiedAljouf);
});

// Annual median NDVI export (2015-2023)
ee.List.sequence(2015, 2023).getInfo().forEach(function(year) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = ee.Date.fromYMD(year, 12, 31);
  var annualMedianNDVI = ndviAljouf.filterDate(start, end).median();
  Export.image.toDrive({
    image: annualMedianNDVI,
    description: 'NDVI_' + year,
    scale: 1000,
    region: simplifiedAljouf.bounds(),
    fileFormat: 'GeoTIFF',
    folder: 'YourFolderName',
    fileNamePrefix: 'NDVI_Aljouf_' + year,
    maxPixels: 1e12
  });
});

// Monthly median NDVI for chart (109 months from Jun 2015)
var monthlyMedianNDVI = ee.ImageCollection(ee.List.sequence(0, 108).map(function(n) {
  var start = ee.Date('2015-06-23').advance(n, 'month');
  var end = start.advance(1, 'month');
  var medianNDVI = ndviAljouf.filterDate(start, end).median();
  return medianNDVI.set('system:time_start', start.millis());
}));

var ndviChart = ui.Chart.image.series({
  imageCollection: monthlyMedianNDVI,
  region: simplifiedAljouf,
  reducer: ee.Reducer.mean(),
  scale: 1000,
  xProperty: 'system:time_start'
})
  .setOptions({
    title: 'NDVI Trend for Aljouf Province (2015-2024)',
    vAxis: { title: 'NDVI' },
    hAxis: { title: 'Date' },
    lineWidth: 2,
    interpolateNulls: true,
    series: { 0: { lineWidth: 2, curveType: 'function' } }
  });

print(ndviChart);

Map.centerObject(simplifiedAljouf, 6);
Map.addLayer(
  ndviAljouf.filterDate('2023-08-01', '2024-08-01').median(),
  { min: 0, max: 1, palette: ['blue', 'white', 'green'] },
  'NDVI 2023-2024'
);
