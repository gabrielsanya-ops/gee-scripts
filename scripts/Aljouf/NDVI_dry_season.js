// Dry Season NDVI - Saudi Arabia (May-Sept)
// Uses Sentinel-2 SR Harmonized. Season: May 1 - Sept 30. Output resolution: 10m.
// Imports: aoi = FeatureCollection projects/ee-gabrielsanya/assets/SaudiRangeland/Zulfi_Bound2
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya/assets/SaudiRangeland/Zulfi_Bound2');
aoi = aoi.geometry();

Map.centerObject(aoi, 7);
Map.addLayer(aoi, { color: 'orange' }, 'AOI');

function maskS2clouds(image) {
  var scl = image.select('SCL');
  var cloudMask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return image.updateMask(cloudMask);
}

function calculateNDVI(image) {
  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
}

function exportNDVIForDrySeason(year) {
  var startDate = year + '-05-01';
  var endDate = year + '-09-30';
  var ndvi = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(maskS2clouds)
    .map(calculateNDVI)
    .mean()
    .clip(aoi);

  var fileName = 'NDVI_DrySeason_MaySep_' + year;
  Export.image.toDrive({
    image: ndvi,
    description: fileName,
    folder: 'Saudi_Dry_Season_NDVI',
    fileNamePrefix: fileName,
    region: aoi,
    scale: 10,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });
  print('Export task created for ' + fileName);
}

var years = [2018, 2024];
years.forEach(function(year) { exportNDVIForDrySeason(year); });
