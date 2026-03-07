// Imports (1 entry)
var geometry = /* color: #d63000 */ee.Geometry.Polygon(
        [[[0, 0]]], null, false);

//-------------------------------------------------------------------------------------------------------
//-------------------------------------------- NDVI CALCULATION ----------------------------------------
//-------------------------------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------------------
//-------------------------------------------- NDVI CALCULATION ----------------------------------------
//-------------------------------------------------------------------------------------------------------

// This example uses the Sentinel-2 QA band to cloud mask
// the collection. The Sentinel-2 cloud flags are less
// selective, so the collection is also pre-filtered by the
// CLOUDY_PIXEL_PERCENTAGE flag, to use only relatively
// cloud-free granule.

// Function to mask clouds using the Sentinel-2 QA band.
function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  // Return the masked and scaled data, without the QA bands.
  return image.updateMask(mask).divide(10000)
    .select('B.*')
    .copyProperties(image, ['system:time_start']);
}

// Map the function over one year of data and take the median.
// Load Sentinel-2 TOA reflectance data.
var S2_SR = ee.ImageCollection('COPERNICUS/S2_SR').filterBounds(geometry).filterDate('2021-01-01', '2022-01-01');
//var collection = ee.ImageCollection('COPERNICUS/S2')
// .filterDate('2020-01-01', '2021-01-01')
// .filterBounds(geometry)
// Pre-filter to get less cloudy granules.
// .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
// .map(maskS2clouds)
// .median();
//
////var composite = collection

//Calculate NDVI from the Sentinel-2 imagery

var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};

var S2_NDVI = S2_SR.map(addNDVI);

var recent_S2 = ee.Image(S2_NDVI.sort('system:time_start', false).first());

//NDVI Palette
var NDVIpalette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901', '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01', '012E01', '011D01', '011301'];

// Display the results.
Map.addLayer(recent_S2.select('NDVI'), {palette: NDVIpalette}, 'Recent Sentinel NDVI');
