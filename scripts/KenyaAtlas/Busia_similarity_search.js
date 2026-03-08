// Busia_similarity search
// Similarity search with satellite embeddings (e.g. find areas similar to reference locations such as Brick Kilns).
// Imports: samples (FeatureCollection of reference points, e.g. 2 elements), filteredAdmin2 (Table projects/ee-gabrielsanya-kenya/assets/Busia)

var geometry = filteredAdmin2.geometry();
Map.centerObject(geometry, 9);
Map.addLayer(geometry, { color: 'red' }, 'Search Area');
Map.setOptions('SATELLITE');

// Add a few reference locations (e.g. Brick Kilns) in the 'samples' FeatureCollection.

var year = 2024;
var startDate = ee.Date.fromYMD(year, 1, 1);
var endDate = startDate.advance(1, 'year');

var embeddings = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');
var mosaic = embeddings.filter(ee.Filter.date(startDate, endDate)).mosaic();

var scale = 20;
var sampleEmbeddings = mosaic.sampleRegions({
  collection: samples,
  scale: scale
});

// Dot product between embedding vectors: values closer to 0 = more similar, closer to 1 = less similar.
var bandNames = mosaic.bandNames();
var nSamples = sampleEmbeddings.size();
var distanceImages = ee.List.sequence(0, nSamples.subtract(1)).map(function(i) {
  var f = ee.Feature(sampleEmbeddings.toList(nSamples).get(ee.Number(i)));
  var dotImg = bandNames.iterate(function(bn, acc) {
    return ee.Image(acc).add(
      mosaic.select(ee.String(bn)).multiply(ee.Image.constant(ee.Number(f.get(ee.String(bn)))))
    );
  }, ee.Image.constant(0));
  return dotImg;
});
var meanDistance = ee.ImageCollection.fromImages(distanceImages).mean();

var palette = ['000004', '2C105C', '711F81', 'B63679', 'EE605E', 'FDAE78', 'FCFDBF', 'FFFFFF'];
var similarityVis = { palette: palette, min: 0.5, max: 1 };
Map.addLayer(meanDistance.clip(geometry), similarityVis, 'Similarity (bright = close)', false);

var threshold = 0.92;
var similarPixels = meanDistance.lt(threshold);
var polygons = similarPixels.selfMask().reduceToVectors({
  geometry: geometry,
  scale: scale,
  geometryType: 'polygon',
  maxPixels: 1e13,
  eightConnected: false
});
var predictedMatches = polygons.map(function(f) {
  return ee.Feature(f.centroid());
});
Map.addLayer(predictedMatches, { color: 'cyan' }, 'Predicted matches');

// Optional: export predicted matches (set your asset path).
// Export.table.toAsset({
//   collection: predictedMatches,
//   description: 'busia_similarity_matches',
//   assetId: 'projects/ee-USER/assets/busia_similarity_matches'
// });
