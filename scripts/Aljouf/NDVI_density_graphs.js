// ROI: Table projects/ee-gabrielsanya2/assets/Aljouf_poly
var roi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

// Load Sentinel-2, filter by ROI and date range (adjust dates as needed)
var sentinel2 = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(roi)
  .filterDate('2023-12-30', '2024-05-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

function calculateNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

var sentinel2WithNDVI = sentinel2.map(calculateNDVI);
var ndvi = sentinel2WithNDVI.select('NDVI').median().clip(roi);

// NDVI grading thresholds: 1 = 0–0.25, 2 = 0.25–0.5, 3 = 0.5–0.75, 4 = 0.75–1
var ndviGraded = ndvi.expression(
  '(NDVI < 0.25) ? 1 : (NDVI < 0.5) ? 2 : (NDVI < 0.75) ? 3 : 4',
  { NDVI: ndvi.select('NDVI') }
).rename('NDVI_Grades');

// Calculate area (m²) per grade within a region
function calculateAreas(region) {
  var regionGeometry = region.geometry ? region.geometry() : region;
  var scale = 500; // Increase the scale to reduce computation time
  var pixelArea = ee.Image.pixelArea();

  var grade1 = ee.Number(ndviGraded.eq(1).multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: regionGeometry,
      scale: scale,
      maxPixels: 1e8,
      bestEffort: true
    }).get('NDVI_Grades'));
  var grade2 = ee.Number(ndviGraded.eq(2).multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: regionGeometry,
      scale: scale,
      maxPixels: 1e8,
      bestEffort: true
    }).get('NDVI_Grades'));
  var grade3 = ee.Number(ndviGraded.eq(3).multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: regionGeometry,
      scale: scale,
      maxPixels: 1e8,
      bestEffort: true
    }).get('NDVI_Grades'));
  var grade4 = ee.Number(ndviGraded.eq(4).multiply(pixelArea)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: regionGeometry,
      scale: scale,
      maxPixels: 1e8,
      bestEffort: true
    }).get('NDVI_Grades'));

  return ee.Dictionary({
    'Grade_0_0.25': grade1,
    'Grade_0.25_0.5': grade2,
    'Grade_0.5_0.75': grade3,
    'Grade_0.75_1': grade4
  });
}

// Split ROI into a grid of tiles (adjust rows/cols as needed)
function splitRegion(region, rows, cols) {
  var geom = region.geometry ? region.geometry() : region;
  var bounds = geom.bounds ? geom.bounds() : geom;
  var ring = ee.List(bounds.coordinates().get(0));
  var xminVal = ee.Number(ring.map(function(c) { return ee.List(c).get(0); }).reduce(ee.Reducer.min()));
  var yminVal = ee.Number(ring.map(function(c) { return ee.List(c).get(1); }).reduce(ee.Reducer.min()));
  var xmaxVal = ee.Number(ring.map(function(c) { return ee.List(c).get(0); }).reduce(ee.Reducer.max()));
  var ymaxVal = ee.Number(ring.map(function(c) { return ee.List(c).get(1); }).reduce(ee.Reducer.max()));

  var xspacing = xmaxVal.subtract(xminVal).divide(cols);
  var yspacing = ymaxVal.subtract(yminVal).divide(rows);

  var tiles = ee.List.sequence(0, rows - 1).map(function(row) {
    return ee.List.sequence(0, cols - 1).map(function(col) {
      var x0 = xminVal.add(ee.Number(col).multiply(xspacing));
      var y0 = yminVal.add(ee.Number(row).multiply(yspacing));
      var x1 = x0.add(xspacing);
      var y1 = y0.add(yspacing);
      return ee.Feature(ee.Geometry.Rectangle([x0, y0, x1, y1]));
    });
  }).flatten();

  return ee.FeatureCollection(tiles);
}

var tiles = splitRegion(roi, 3, 3); // Adjust 3x3 grid as needed

var totalAreas = ee.Dictionary({
  'Grade_0_0.25': 0,
  'Grade_0.25_0.5': 0,
  'Grade_0.5_0.75': 0,
  'Grade_0.75_1': 0
});

function accumulateAreas(tile, acc) {
  var areaDict = calculateAreas(tile);
  acc = ee.Dictionary(acc);
  return acc.combine(areaDict, true);
}

totalAreas = ee.FeatureCollection(tiles).iterate(accumulateAreas, totalAreas);

print('Total NDVI Area (km^2):', totalAreas);

// Map display
Map.centerObject(roi, 7);
Map.addLayer(ndvi, { min: 0, max: 1, palette: ['blue', 'white', 'green'] }, 'NDVI');
Map.addLayer(ndviGraded, { min: 1, max: 4, palette: ['FF0000', 'FFFF00', '00FF00', '0000FF'] }, 'NDVI Graded');

// Legend
var legend = ui.Panel({
  style: { position: 'bottom-left', padding: '8px 15px' }
});

var legendTitle = ui.Label({
  value: 'NDVI Grades',
  style: { fontWeight: 'bold', fontSize: '18px', margin: '4px 0 8px 0' }
});
legend.add(legendTitle);

function makeRow(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: '#' + color,
      padding: '8px',
      margin: '0 4px 4px 0'
    }
  });
  var description = ui.Label({
    value: name,
    style: { margin: '0 0 4px 6px' }
  });
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
}

var colors = ['FF0000', 'FFFF00', '00FF00', '0000FF'];
var names = ['0-0.25', '0.25-0.5', '0.5-0.75', '0.75-1'];
for (var i = 0; i < colors.length; i++) {
  legend.add(makeRow(colors[i], names[i]));
}

Map.add(legend);

// Export to Google Drive
Export.image.toDrive({
  image: ndviGraded,
  description: 'ndviGraded',
  folder: 'ndviGraded',
  fileNamePrefix: 'ndviGraded_23',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});
