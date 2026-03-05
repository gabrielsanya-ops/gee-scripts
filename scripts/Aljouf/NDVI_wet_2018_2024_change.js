// Imports: aoi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

var calculateNDVI = function(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
};

var exportNDVIDifference = function(year1, year2) {
  var startDate1 = ee.Date.fromYMD(year1, 11, 1);
  var endDate1 = ee.Date.fromYMD(year1 + 1, 3, 31);
  var startDate2 = ee.Date.fromYMD(year2, 11, 1);
  var endDate2 = ee.Date.fromYMD(year2 + 1, 3, 31);

  var ndvi1 = ee.ImageCollection('COPERNICUS/S2')
    .filterBounds(aoi)
    .filterDate(startDate1, endDate1)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(calculateNDVI)
    .mean()
    .clip(aoi);

  var ndvi2 = ee.ImageCollection('COPERNICUS/S2')
    .filterBounds(aoi)
    .filterDate(startDate2, endDate2)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(calculateNDVI)
    .mean()
    .clip(aoi);

  var ndviDifference = ndvi2.subtract(ndvi1).rename('NDVI_Difference');

  var fileName = 'NDVI_Difference_' + year1 + '_to_' + year2;
  Export.image.toDrive({
    image: ndviDifference,
    description: fileName,
    folder: 'EarthEngineExports',
    fileNamePrefix: fileName,
    scale: 10,
    region: aoi,
    maxPixels: 1e13
  });
};

var years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
for (var i = 0; i < years.length - 1; i++) {
  exportNDVIDifference(years[i], years[i + 1]);
}
