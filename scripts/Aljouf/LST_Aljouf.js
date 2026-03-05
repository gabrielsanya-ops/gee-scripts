// AOI: Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var AOI = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

// Load Landsat 8 Collection 2 Surface Reflectance, filter by 2023 and AOI
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterDate('2023-01-01', '2023-12-31')
  .filterBounds(AOI)
  .select('ST_B10');

// Convert thermal band from Kelvin to Celsius (Landsat 8 scale factor)
function kelvinToCelsius(image) {
  return image
    .multiply(0.00341882)
    .add(149.0)
    .subtract(273.15)
    .rename('LST_Celsius')
    .copyProperties(image, ['system:time_start']);
}

var landsatLST_Celsius = landsat8.map(kelvinToCelsius);
var meanLST = landsatLST_Celsius.mean().clip(AOI);

// Visualization
var LSTVis = {
  min: 20,
  max: 50,
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};

Map.centerObject(AOI, 5);
Map.addLayer(meanLST, LSTVis, 'Mean LST (Celsius)');

print('Mean LST Image:', meanLST);

// Export to Google Drive
Export.image.toDrive({
  image: meanLST,
  description: 'SaudiArabia_MeanLST_2023_Landsat8',
  scale: 1000,
  region: AOI,
  folder: 'LST',
  fileFormat: 'GeoTIFF'
});
