// Imports: aoi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

// Filter the Sentinel-2 image collection
var sentinelCollection = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(aoi)
  .filterDate('2023-11-01', '2024-03-31') // Adjust the year as necessary
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) // Filter for low cloud coverage
  .map(function(image) {
    // Calculate NDVI
    var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    return image.addBands(ndvi);
  });

// Calculate the median NDVI over the period
var medianNdvi = sentinelCollection.select('NDVI').median();

// Display the result
Map.centerObject(aoi, 8);
Map.addLayer(medianNdvi.clip(aoi), { min: 0, max: 1, palette: ['blue', 'white', 'green'] }, 'Median NDVI');

// Export the NDVI image to your Google Drive
Export.image.toDrive({
  image: medianNdvi.clip(aoi),
  description: 'Median_NDVI_Nov_March',
  scale: 10,
  region: aoi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});
