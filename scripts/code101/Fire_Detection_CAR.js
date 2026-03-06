// Burn severity mapping using NBR (Normalized Burn Ratio). Imports: geometry (polygon study area)
// Optional: geometry3 (Table), worldcountries (Table)

// ========== USER INPUTS ==========
// SET TIME FRAME - before and after fire
var prefire_start = '2021-01-10';
var prefire_end = '2021-01-12';
var postfire_start = '2022-01-01';
var postfire_end = '2022-01-08';

// SELECT A SATELLITE PLATFORM: 'L8' or 'S2'
var platform = 'S2';

// DO NOT EDIT PAST THIS POINT (unless you know what you are doing)
// Translating User Inputs
if (platform === 'S2' || platform === '2') {
  var ImCol = 'COPERNICUS/S2';
  var pl = 'Sentinel-2';
} else {
  var ImCol = 'LANDSAT/LC08/C01/T1_SR';
  var pl = 'Landsat 8';
}
print('Data selected for analysis:', pl);
print('Fire incident occurred between', prefire_end, 'and', postfire_start);

var area = ee.FeatureCollection(geometry);
Map.centerObject(area);

var imagery = ee.ImageCollection(ImCol);
var prefireImCol = imagery.filterDate(prefire_start, prefire_end).filterBounds(area);
var postfireImCol = imagery.filterDate(postfire_start, postfire_end).filterBounds(area);
print('Pre-fire Image Collection:', prefireImCol);
print('Post-fire Image Collection:', postfireImCol);

function maskS2sr(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000).copyProperties(image, ['system:time_start']);
}

function maskL8sr(image) {
  var qa = image.select('pixel_qa');
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var snowBitMask = 1 << 4;
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
    .and(qa.bitwiseAnd(cloudsBitMask).eq(0))
    .and(qa.bitwiseAnd(snowBitMask).eq(0));
  return image.updateMask(mask).select('B[0-9]*').copyProperties(image, ['system:time_start']);
}

if (platform === 'S2' || platform === '2') {
  var prefire_CM_ImCol = prefireImCol.map(maskS2sr);
  var postfire_CM_ImCol = postfireImCol.map(maskS2sr);
} else {
  var prefire_CM_ImCol = prefireImCol.map(maskL8sr);
  var postfire_CM_ImCol = postfireImCol.map(maskL8sr);
}

var pre_mos = prefireImCol.mosaic().clip(area);
var post_mos = postfireImCol.mosaic().clip(area);
var pre_cm_mos = prefire_CM_ImCol.mosaic().clip(area);
var post_cm_mos = postfire_CM_ImCol.mosaic().clip(area);
print('Pre-fire True Color Image', pre_mos);
print('Post-fire True Color Image', post_mos);

// NBR = (NIR - SWIR2) / (NIR + SWIR2)
if (platform === 'S2' || platform === '2') {
  var preNBR = pre_cm_mos.normalizedDifference(['B8', 'B12']).rename('NBR');
  var postNBR = post_cm_mos.normalizedDifference(['B8', 'B12']).rename('NBR');
} else {
  var preNBR = pre_cm_mos.normalizedDifference(['B5', 'B7']).rename('NBR');
  var postNBR = post_cm_mos.normalizedDifference(['B5', 'B7']).rename('NBR');
}

var dNBR_unscaled = preNBR.subtract(postNBR);
var dNBR = dNBR_unscaled.multiply(1000).rename('dNBR');
print('Difference Normalized Burn Ratio', dNBR);

Map.addLayer(area.draw({ color: 'ffffff', strokeWidth: 5 }), {}, 'Study Area');
var vis = (platform === 'S2' || platform === '2')
  ? { bands: ['B4', 'B3', 'B2'], max: 2000, gamma: 1.5 }
  : { bands: ['B4', 'B3', 'B2'], min: 0, max: 4000, gamma: 1.5 };
Map.addLayer(pre_mos, vis, 'Pre-fire image');
Map.addLayer(post_mos, vis, 'Post-fire image');
Map.addLayer(pre_cm_mos, vis, 'Pre-fire True Color Image - Clouds masked');
Map.addLayer(post_cm_mos, vis, 'Post-fire True Color Image - Clouds masked');

var grey = ['white', 'black'];
Map.addLayer(dNBR, { min: -1000, max: 1000, palette: grey }, 'dNBR greyscale');

// Burn severity classification (dNBR intervals)
var sld_intervals =
  '<RasterSymbolizer><ColorMap type="intervals" extended="false">' +
  '<ColorMapEntry color="#ffffff" quantity="-500" label="-500"/>' +
  '<ColorMapEntry color="#7a8737" quantity="-251" label="-251"/>' +
  '<ColorMapEntry color="#acbe4d" quantity="-101" label="-101"/>' +
  '<ColorMapEntry color="#0ae042" quantity="99" label="99"/>' +
  '<ColorMapEntry color="#fff70b" quantity="269" label="269"/>' +
  '<ColorMapEntry color="#ffaf38" quantity="439" label="439"/>' +
  '<ColorMapEntry color="#ff641b" quantity="659" label="659"/>' +
  '<ColorMapEntry color="#a41fd6" quantity="2000" label="2000"/>' +
  '</ColorMap></RasterSymbolizer>';
Map.addLayer(dNBR.sldStyle(sld_intervals), {}, 'dNBR classified');

var thresholds = ee.Image([-1000, -251, -101, 99, 269, 439, 659, 2000]);
var classified = dNBR.lt(thresholds).reduce(ee.Reducer.sum()).toInt();

// Burned area statistics
var allpix = classified.updateMask(classified);
var pixstats = allpix.reduceRegion({ reducer: ee.Reducer.count(), geometry: area, scale: 30 });
var allpixels = ee.Number(pixstats.get('sum'));

var arealist = [];
function areacount(cnr, name) {
  var singleMask = classified.updateMask(classified.eq(cnr));
  var stats = singleMask.reduceRegion({ reducer: ee.Reducer.count(), geometry: area, scale: 30 });
  var pix = ee.Number(stats.get('sum'));
  var hect = pix.multiply(900).divide(10000);
  var perc = pix.divide(allpixels).multiply(10000).round().divide(100);
  arealist.push({ Class: name, Pixels: pix, Hectares: hect, Percentage: perc });
}
var names2 = ['NA', 'High Severity', 'Moderate-high Severity', 'Moderate-low Severity', 'Low Severity', 'Unburned', 'Enhanced Regrowth, Low', 'Enhanced Regrowth, High'];
for (var i = 0; i < 8; i++) { areacount(i, names2[i]); }
print('Burned Area by Severity Class', arealist);

// Legend
var legend = ui.Panel({ style: { position: 'bottom-left', padding: '8px 15px' } });
var legendTitle = ui.Label({ value: 'NBR Classes', style: { fontWeight: 'bold', fontSize: '18px', margin: '0 0 4px 0', padding: '0' } });
legend.add(legendTitle);
function makeRow(color, name) {
  var colorBox = ui.Label({ style: { backgroundColor: '#' + color, padding: '8px', margin: '0 0 4px 0' } });
  var description = ui.Label({ value: name, style: { margin: '0 0 4px 6px' } });
  return ui.Panel({ widgets: [colorBox, description], layout: ui.Panel.Layout.Flow('horizontal') });
}
var colors = ['7a8737', 'acbe4d', '0ae042', 'fff7eb', 'ffaf38', 'ff641b', 'a41fd6', 'ffffff'];
var names = ['Enhanced Regrowth, High', 'Enhanced Regrowth, Low', 'Unburned', 'Low Severity', 'Moderate-low Severity', 'Moderate-high Severity', 'High Severity', 'NA'];
for (var i = 0; i < 8; i++) { legend.add(makeRow(colors[i], names[i])); }
Map.add(legend);

Export.image.toDrive({ image: dNBR, description: 'dNBR_CAR', fileNamePrefix: 'dNBR', region: area, scale: 30, maxPixels: 1e10 });
