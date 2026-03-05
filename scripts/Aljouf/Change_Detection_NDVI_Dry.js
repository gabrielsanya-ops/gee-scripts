// Imports: aoi = Table projects/ee-gabrielsanya2/assets/Aljouf_poly

// Set the time range for the two periods
var startDate1 = '2023-06-01';
var endDate1 = '2023-10-30';
var startDate2 = '2024-06-01';
var endDate2 = '2024-10-30';

// Load Sentinel-2 imagery for the defined periods and AOI
var bands = ['B4', 'B8'];
var s2_2023 = ee.ImageCollection('COPERNICUS/S2')
                .filterDate(startDate1, endDate1)
                .filterBounds(aoi)
                .select(bands)
                .median();

var s2_2024 = ee.ImageCollection('COPERNICUS/S2')
                .filterDate(startDate2, endDate2)
                .filterBounds(aoi)
                .select(bands)
                .median();

// Compute NDVI for both periods as a simple change detection metric
var ndvi2023 = s2_2023.normalizedDifference(['B8', 'B4']).rename('NDVI2023');
var ndvi2024 = s2_2024.normalizedDifference(['B8', 'B4']).rename('NDVI2024');

// Compute the NDVI difference between the two periods
var ndviDiff = ndvi2024.subtract(ndvi2023).rename('NDVI_Change');

// Define visualization parameters
var ndviParams = {min: -0.5, max: 0.5, palette: ['blue', 'white', 'green']};
var changeParams = {min: -0.2, max: 0.2, palette: ['red', 'white', 'green']};

// Add the NDVI and change detection layers to the map
Map.centerObject(aoi, 8); // Adjust the zoom level according to your AOI
Map.addLayer(ndvi2023, ndviParams, 'NDVI 2023');
Map.addLayer(ndvi2024, ndviParams, 'NDVI 2024');

// Clip the output image to the AOI
var clipped = ndviDiff.clip(aoi);

// Display the NDVI change detection layer
Map.centerObject(aoi, 10);
Map.addLayer(clipped, changeParams, 'NDVI Change');

// Optionally, export the change detection result as an image
Export.image.toDrive({
  image: clipped,
  description: 'NDVI_Change_Detection_2023_2024_dry',
  folder: "KSA2023",
  scale: 10,
  region: aoi,
  maxPixels: 1e13
});
