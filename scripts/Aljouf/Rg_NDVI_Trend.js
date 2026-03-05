// Imports: aoi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

var startDate = '2018-01-01';
var endDate = '2024-06-30';

var bands = ['B4', 'B8'];
var s2 = ee.ImageCollection('COPERNICUS/S2')
  .filterDate(startDate, endDate)
  .filterBounds(aoi)
  .select(bands);

function addNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

var s2withNDVI = s2.map(addNDVI);

function addYearMonth(image) {
  var date = ee.Date(image.get('system:time_start'));
  var year = date.get('year');
  var month = date.get('month');
  return image.set('year', year).set('month', month).set('date', date);
}

var s2WithNDVIYearMonth = s2withNDVI.map(addYearMonth);

// Monthly median NDVI (2021-2024, by year and month)
var ndviMonthly = ee.ImageCollection(ee.List.sequence(2021, 2024).map(function(y) {
  return ee.List.sequence(1, 12).map(function(m) {
    var start = ee.Date.fromYMD(y, m, 1);
    var end = start.advance(1, 'month');
    var medianImg = s2WithNDVIYearMonth
      .filter(ee.Filter.calendarRange(y, y, 'year'))
      .filter(ee.Filter.calendarRange(m, m, 'month'))
      .median();
    var date = ee.Date.fromYMD(y, m, 1);
    return medianImg.set('year', y).set('month', m).set('date', date.millis());
  });
}).flatten());

function extractNDVITimeSeries(image) {
  var date = image.get('date');
  var year = image.get('year');
  var month = image.get('month');
  var ndvi = image.bandNames().contains('NDVI')
    ? ee.Number(image.select('NDVI').reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: aoi,
        scale: 1000,
        bestEffort: true,
        maxPixels: 1e8
      }).get('NDVI'))
    : null;
  return ee.Feature(null, { date: date, year: year, month: month, NDVI: ndvi });
}

var ndviTimeSeries = ndviMonthly.map(extractNDVITimeSeries);
var filteredNDVITimeSeries = ndviTimeSeries.filter(ee.Filter.notNull(['NDVI']));

print('NDVI Time Series', filteredNDVITimeSeries);
