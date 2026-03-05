// Imports: region = Aljouf_poly; imageVisParam (optional visualization for SAVI)
var region = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

var dataset = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(region)
  .filterDate('2023-11-01', '2024-03-31');

// Applies scaling factors.
function applyScaleFactors(image) {
  var opticalBands = image.select(['SR_B4', 'SR_B3', 'SR_B2']).multiply(0.0000275).add(-0.2);
  var thermalBands = image.select(['ST_B10']).multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true).addBands(thermalBands, null, true);
}

dataset = dataset.map(applyScaleFactors);

var visualization = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3
};

// Calculate SAVI: (NIR - Red) * (1 + L) / (NIR + Red + L), L = 0.5. Landsat 8 NIR = SR_B5.
function calculateSAVI(image) {
  var redBand = image.select('SR_B4');
  var nirBand = image.select('SR_B5');
  var savi = nirBand.subtract(redBand).multiply(1.5).divide(nirBand.add(redBand).add(0.5));
  return image.addBands(savi.rename('SAVI'));
}

dataset = dataset.map(calculateSAVI);

// Clip the SAVI image to the specified region.
var saviClip = dataset.median().select('SAVI').clip(region);

Map.centerObject(region, 7);
// Map.addLayer(dataset, visualization, 'True Color (432)');
Map.addLayer(saviClip, { min: -0.2, max: 0.4, palette: ['blue', 'white', 'green'] }, 'Clipped SAVI');

Export.image.toDrive({
  image: saviClip,
  description: 'Aljouf_Savi_landsat_24',
  folder: 'Aljouf',
  fileNamePrefix: 'Aljouf_24',
  region: region,
  scale: 10,
  maxPixels: 1e13
});
