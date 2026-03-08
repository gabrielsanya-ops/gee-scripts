// ForestMonitor_EVI-NDV
// MODIS EVI forest condition trend (greening/browning) for Western and Eastern Mau Forest, Kenya.
// Imports: none (uses asset projects/ee-gabrielsanya-kenya/assets/kenyaforests)

// Get MODIS 250m vegetation data
var modis = ee.ImageCollection('MODIS/006/MOD13Q1');
var table = ee.FeatureCollection('projects/ee-gabrielsanya-kenya/assets/kenyaforests');
var nps = table.filter(ee.Filter.inList('NAME', ['Western Mau Forest', 'Eastern Mau Forest']));

// Compute annual hot season composites (Jan–Apr, 2000–2023)
var years = ee.List.sequence(2000, 2023);
var annualIC = ee.ImageCollection(years.map(function(y) {
  var start = ee.Date.fromYMD(ee.Number(y), 1, 1);
  var end = ee.Date.fromYMD(ee.Number(y), 5, 1);
  var col = modis.filterDate(start, end).filterBounds(nps).select('EVI');
  var img = col.max().set('year', y);
  return ee.Image(img).addBands(ee.Image.constant(y).rename('year')).select(['year', 'EVI']).rename(['year', 'max']);
}));

// Estimate trends (linear fit: slope per pixel)
var sens = annualIC.reduce(ee.Reducer.linearFit()).select(['scale', 'offset']).rename(['slope', 'offset']);

// Slope histogram for full forest area
function getHistogram(sensImg, geom, scale) {
  var hist = sensImg.select('slope').reduceRegion({
    reducer: ee.Reducer.histogram(50),
    geometry: geom,
    scale: scale || 250,
    maxPixels: 1e13
  });
  var histData = ee.Dictionary(hist.get('slope'));
  var bucketMeans = ee.Array(histData.get('bucketMeans'));
  var histCounts = ee.Array(histData.get('histogram'));
  var chart = ui.Chart.array.values(histCounts, 0, bucketMeans)
    .setChartType('LineChart')
    .setOptions({
      title: 'Forest condition trend histogram',
      hAxis: { title: 'Slope' },
      vAxis: { title: 'Pixel count' }
    });
  return chart;
}
print('Slope histogram (all forests)', getHistogram(sens, nps.geometry(), 250));

// Infer pixel-wise vegetation condition (greening / browning)
var cond = ee.Image.cat(
  sens.select('slope').gt(0).rename('greening'),
  sens.select('slope').lt(0).rename('browning')
);

// Calculate area under greening and browning in each national park
var areaImg = ee.Image.pixelArea();
var greeningArea = cond.select('greening').multiply(areaImg);
var browningArea = cond.select('browning').multiply(areaImg);
var forestArea = areaImg; // total forest area per pixel

var greeningStats = greeningArea.reduceRegions({
  collection: nps,
  reducer: ee.Reducer.sum(),
  scale: 250,
  crs: 'EPSG:4326'
}).map(function(f) { return f.set('greeningSqM', f.get('sum')); });
var browningStats = browningArea.reduceRegions({
  collection: nps,
  reducer: ee.Reducer.sum(),
  scale: 250,
  crs: 'EPSG:4326'
}).map(function(f) { return f.set('browningSqM', f.get('sum')); });
var totalStats = forestArea.reduceRegions({
  collection: nps,
  reducer: ee.Reducer.sum(),
  scale: 250,
  crs: 'EPSG:4326'
}).map(function(f) { return f.set('forestSqM', f.get('sum')); });

var nameFilter = ee.Filter.equals({ leftField: 'NAME', rightField: 'NAME' });
var join = ee.Join.inner('primary', 'secondary');
var withTotal = join.apply(greeningStats, totalStats, nameFilter);
var merged = ee.FeatureCollection(withTotal.map(function(p) {
  var g = ee.Feature(p.get('primary'));
  var t = ee.Feature(p.get('secondary'));
  return g.set('forestSqM', t.get('sum'));
}));
var withBrowning = join.apply(merged, browningStats, nameFilter);
var result = ee.FeatureCollection(withBrowning.map(function(p) {
  var a = ee.Feature(p.get('primary'));
  var b = ee.Feature(p.get('secondary'));
  var greeningSqM = ee.Number(a.get('greeningSqM'));
  var browningSqM = ee.Number(b.get('browningSqM'));
  var forestSqM = ee.Number(a.get('forestSqM'));
  return ee.Feature(null, {
    NAME: a.get('NAME'),
    'Browning sq km': browningSqM.divide(1e6),
    'Browning fraction': browningSqM.divide(forestSqM),
    'Greening sq km': greeningSqM.divide(1e6),
    'Greening fraction': greeningSqM.divide(forestSqM)
  });
}));

print('Vegetation condition summary', result);

// Display area summary as table chart
var tableChart = ui.Chart.feature.byFeature(result, 'NAME', ['Browning sq km', 'Browning fraction', 'Greening sq km', 'Greening fraction'])
  .setChartType('Table');
print(tableChart);

// Map display
Map.setOptions('SATELLITE');
Map.centerObject(nps, 10);

var slopeVis = {
  opacity: 1,
  bands: ['slope'],
  min: -55,
  max: 55,
  palette: ['8c510a', 'd8b365', 'f6e8c3', 'f5f5f5', 'd9f0d3', '7fbf7b', '1b7837']
};
Map.addLayer(sens.clip(nps), slopeVis, "Sen's slope");

var outline = ee.Image().byte().paint({ featureCollection: nps, color: 1, width: 2 });
Map.addLayer(outline.mask(outline), { palette: '000000' }, 'Forests');

// Trend in EVI by forest and year
var trendChart = ui.Chart.image.seriesByRegion({
  imageCollection: annualIC,
  regions: nps,
  reducer: ee.Reducer.median(),
  band: 'max',
  scale: 250,
  xProperty: 'year'
}).setChartType('ScatterChart').setOptions({
  title: 'Greening/browning trend in forest',
  hAxis: { title: 'Year' },
  vAxis: { title: 'Median of max. summer EVI' }
});
print(trendChart);
