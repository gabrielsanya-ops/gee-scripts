/**
 * Function to mask clouds using the Sentinel-2 QA band
 * @param {ee.Image} image Sentinel-2 image
 * @return {ee.Image} cloud masked Sentinel-2 image
 */
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

var dataset1 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate('2022-01-01', '2022-01-20')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .map(maskS2clouds);

var dataset2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate('2022-03-21', '2022-03-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .map(maskS2clouds);

var visualization = { min: 0.0, max: 0.3, bands: ['B4', 'B3', 'B2'] };

Map.setCenter(37.48900753646864, 47.145634603660454, 12);
Map.addLayer(dataset1.mean(), visualization, 'RGB1');
Map.addLayer(dataset2.mean(), visualization, 'RGB2');
