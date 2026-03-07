// Imports (1 entry)
var roi = ee.FeatureCollection('users/gabrielsanya/ke_pol');

// Import earth engine python api and geemap

// Add EVI using an expression.
var addEVI = function(image){
  var addEVI = image.expression(
    '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)', {
      'NIR': image.select('B8').divide(10000),
      'RED': image.select('B4').divide(10000),
      'BLUE': image.select('B2').divide(10000),
    }).rename('EVI');
  return image.addBands(addEVI);
};

function addDate(image){
  var img_date = ee.Date(image.date())
  img_date = ee.Number.parse(img_date.format('YYYYMMdd'))
  return image.addBands(ee.Image(img_date).rename('date').toInt())
}

function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}

// filter sentinel 2 images and apply the EVI formula, finally we obtain
// single image with median operation
var Sentinel_data = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(roi)
  .filterDate('2019-11-01', '2020-11-30')
  // Pre-filter to get less cloudy granules.
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(addEVI)
  .map(maskS2clouds)
  .median();
  //.clipToCollection(roi);

// set some thresholds
// A nice EVI palette
var palette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
 '74A901', '66A000', '529400', '3E8601', '207401', '056201', '004C00',
 '023B01', '012E01', '011D01', '011301'];

var pal1 = {min: 0.1, max: 0.8, palette: palette}

Map.centerObject(roi, 8);
Map.addLayer(Sentinel_data.select(['EVI']), pal1, 'EVI')
