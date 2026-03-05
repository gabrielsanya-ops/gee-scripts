// Imports: roi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var roi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

// A digital elevation model.
var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation');

// Calculate slope. Units are degrees, range is [0,90).
var slope = ee.Terrain.slope(dem).clip(roi);

// Calculate aspect. Units are degrees where 0=N, 90=E, 180=S, 270=W.
var aspect = ee.Terrain.aspect(dem).clip(roi);

// Display slope and aspect layers on the map.
Map.centerObject(roi, 12);
Map.addLayer(slope, { min: 0, max: 89.99 }, 'Slope');
Map.addLayer(aspect, { min: 0, max: 359.99 }, 'Aspect');

// ee.Terrain.products: slope, aspect, hillshade (illumination azimuth=270, elevation=45).
var terrain = ee.Terrain.products(dem);
print('ee.Terrain.products bands', terrain.bandNames());
var hillshade = terrain.select('hillshade').clip(roi);
Map.addLayer(hillshade, { min: 0, max: 255 }, 'Hillshade');

// Export Slope Image
Export.image.toDrive({
  image: slope,
  description: 'slope',
  folder: 'KSA_range',
  fileNamePrefix: 'slope',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});
