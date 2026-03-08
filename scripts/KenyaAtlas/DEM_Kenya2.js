// DEM_Kenya2
// Hillshade for Kenya using NOAA ETOPO1, clip to ROI, export to Drive.
// Imports: table (e.g. Table users/gabrielsanya/ke_pol, Kenya polygon)

var elevation = ee.Image('NOAA/NGDC/ETOP01').select('bedrock');

// Specify country / region
var shp = ee.FeatureCollection(table);
Map.addLayer(shp);
Map.centerObject(shp, 6);

var exaggeration = 20;
var hillshade = ee.Terrain.hillshade(elevation.multiply(exaggeration));

// Clip the image to the polygon geometry
var hillshade_roi = hillshade.clip(shp);
// Display hillshade on the map
Map.addLayer(hillshade_roi, {}, 'hillshade');

Export.image.toDrive({
  image: hillshade_roi,
  description: 'ke_dem',
  fileNamePrefix: 'ke_dem',
  region: shp,
  scale: 10,
  folder: 'KenyaAtlas',
  fileFormat: 'GeoTiff'
});
