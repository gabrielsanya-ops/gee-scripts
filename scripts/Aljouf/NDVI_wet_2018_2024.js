// Imports: aoi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

var calculateNDVI = function(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
};

var exportNDVIForYear = function(year) {
  var startDate = ee.Date.fromYMD(year, 11, 1);
  var endDate = ee.Date.fromYMD(year + 1, 3, 31);

  var meanNdvi = ee.ImageCollection('COPERNICUS/S2')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(calculateNDVI)
    .mean()
    .clip(aoi);

  var fileName = 'NDVI_Nov' + year + '_Mar' + (year + 1);
  Export.image.toDrive({
    image: meanNdvi,
    description: fileName,
    folder: 'EarthEngineExports',
    fileNamePrefix: fileName,
    scale: 10,
    region: aoi,
    maxPixels: 1e13
  });
};

var years = [2018, 2019, 2020, 2021, 2022];
years.forEach(function(year) { exportNDVIForYear(year); });
