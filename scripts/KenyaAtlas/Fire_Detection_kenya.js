// 04-Change-Detection/Fire Detection_kenya
// Fire and change detection using dNBR. Imports: aoi (geometry), prefire_start, prefire_end, postfire_start, postfire_end, maxCloud, analysisScale

var s2 = ee.ImageCollection('COPERNICUS/S2_SR');

// ----------------------------------- CLOUD MASK (SCL) -----------------------------------
function maskS2(image) {
  var scl = image.select('SCL');
  var sclMask = scl.neq(1)   // saturated/defective
    .and(scl.neq(8))        // cloud medium probability
    .and(scl.neq(9))        // cloud high probability
    .and(scl.neq(10))       // thin cirrus
    .and(scl.neq(11));      // snow
  return image
    .updateMask(sclMask)
    .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'SCL'])
    .copyProperties(image, ['system:time_start']);
}

// ----------------------------------- COLLECTION BUILDER -----------------------------------
function getComposite(startDate, endDate) {
  var col = s2
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloud))
    .filterBounds(aoi)
    .map(maskS2);
  return {
    collection: col,
    count: col.size(),
    composite: col.median().clip(aoi)
  };
}

var pre = getComposite(prefire_start, prefire_end);
var post = getComposite(postfire_start, postfire_end);

print('Pre image count:', pre.count);
print('Post image count:', post.count);

// -------------------------------------- WATER MASK --------------------------------------
// Permanent/seasonal water often creates false dNBR signals.
// Build a conservative water mask using both periods.

function addWaterMask(img) {
  var mndwi = img.normalizedDifference(['B3', 'B11']).rename('MNDWI');
  var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
  // Water tends to have high MNDWI and low NDVI
  var water = mndwi.gt(0.15).and(ndvi.lt(0.2)).rename('water');
  return img.addBands([mndwi, ndvi, water]);
}

var preImg0 = addWaterMask(pre.composite);
var postImg0 = addWaterMask(post.composite);

// Union water from either period
var waterMask = preImg0.select('water').or(postImg0.select('water')).rename('water');

// Optional vegetation pre-mask to focus on likely burnable areas
var vegMask = preImg0.select('NDVI').gt(0.2);

// Final analysis mask
var analysisMask = waterMask.not().and(vegMask);

// Apply mask
var preImg = preImg0.updateMask(analysisMask);
var postImg = postImg0.updateMask(analysisMask);

// ------------------------------------ VISUALIZATION ------------------------------------
var trueColor = { bands: ['B4', 'B3', 'B2'], min: 200, max: 3500, gamma: 1.2 };
var swirFalse = { bands: ['B12', 'B8', 'B4'], min: 200, max: 3500, gamma: 1.2 };

Map.addLayer(preImg, trueColor, 'Pre true color', false);
Map.addLayer(postImg, trueColor, 'Post true color', false);
Map.addLayer(preImg, swirFalse, 'Pre SWIR false color', false);
Map.addLayer(postImg, swirFalse, 'Post SWIR false color', false);

Map.addLayer(
  waterMask.selfMask(),
  { palette: ['0000ff'] },
  'Masked water',
  false
);

Map.addLayer(
  vegMask.selfMask(),
  { palette: ['00aa00'] },
  'Pre-period vegetation mask',
  false
);

// ------------------------------------ NBR & dNBR ------------------------------------
var preNBR = preImg.normalizedDifference(['B8', 'B12']).rename('preNBR');
var postNBR = postImg.normalizedDifference(['B8', 'B12']).rename('postNBR');
var dNBR = preNBR.subtract(postNBR).multiply(1000).rename('dNBR');

Map.addLayer(dNBR, { min: -300, max: 900, palette: ['white', 'black'] }, 'dNBR greyscale', false);

// dNBR change classes (SLD)
var sld =
  '<RasterSymbolizer><ColorMap type="intervals" extended="false">' +
  '<ColorMapEntry color="#1a9850" quantity="-250" label="Strong regrowth/wetter"/>' +
  '<ColorMapEntry color="#91cf60" quantity="-100" label="Regrowth/wetter"/>' +
  '<ColorMapEntry color="#d9ef8b" quantity="100" label="Stable or unburned"/>' +
  '<ColorMapEntry color="#fee08b" quantity="270" label="Low change"/>' +
  '<ColorMapEntry color="#fc8d59" quantity="440" label="Moderate change"/>' +
  '<ColorMapEntry color="#d73027" quantity="660" label="High change"/>' +
  '<ColorMapEntry color="#7f0000" quantity="2000" label="Very high change"/>' +
  '</ColorMap></RasterSymbolizer>';
Map.addLayer(dNBR.sldStyle(sld), {}, 'dNBR change classes');

// Classification (0-6)
var classified = dNBR.expression(
  'b("dNBR") < -250 ? 0 : ' +
  'b("dNBR") < -100 ? 1 : ' +
  'b("dNBR") < 100 ? 2 : ' +
  'b("dNBR") < 270 ? 3 : ' +
  'b("dNBR") < 440 ? 4 : ' +
  'b("dNBR") < 660 ? 5 : 6',
  { dNBR: dNBR }
).toInt().rename('class');

var classPalette = ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027', '#7f0000'];

Map.addLayer(classified, { min: 0, max: 6, palette: classPalette }, 'Change class raster', false);

// ------------------------------------ AREA STATS ------------------------------------
var classNames = [
  'Strong regrowth or wetter',
  'Regrowth or wetter',
  'Stable or unburned',
  'Low change',
  'Moderate change',
  'High change',
  'Very high change'
];

var areaImage = ee.Image.pixelArea().divide(10000).addBands(classified.rename('class'));
var areas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'class' }),
  geometry: aoi,
  scale: analysisScale,
  maxPixels: 1e12,
  bestEffort: true,
  tileScale: 4
});
var groups = ee.List(areas.get('groups'));
var statsFC = ee.FeatureCollection(groups.map(function(g) {
  var d = ee.Dictionary(g);
  var cls = ee.Number(d.get('class'));
  var areaHa = ee.Number(d.get('sum'));
  return ee.Feature(null, {
    class_id: cls,
    class_name: ee.List(classNames).get(cls),
    area_ha: areaHa
  });
}));

print('Area by change class:', statsFC);

// ------------------------------------ CHART ------------------------------------
var chart = ui.Chart.feature.byFeature(statsFC, 'class_name', ['area_ha'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Area by dNBR Change Class',
    legend: { position: 'none' },
    hAxis: { title: 'Class' },
    vAxis: { title: 'Area (ha)' }
  });
print(chart);

// ------------------------------------ LEGEND ------------------------------------
var legend = ui.Panel({
  style: { position: 'bottom-left', padding: '8px 12px' }
});
legend.add(ui.Label('dNBR Change Classes', {
  style: { fontWeight: 'bold', fontSize: '16px' }
}));

function makeRow(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });
  var description = ui.Label(name, {
    style: { margin: '0 0 4px 6px' }
  });
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
}

var legendColors = ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027', '#7f0000'];
var legendNames = [
  'Strong regrowth or wetter',
  'Regrowth or wetter',
  'Stable or unburned',
  'Low change',
  'Moderate change',
  'High change',
  'Very high change'
];

for (var i = 0; i < legendColors.length; i++) {
  legend.add(makeRow(legendColors[i], legendNames[i]));
}
Map.add(legend);

// ------------------------------------ EXPORTS ------------------------------------
Export.image.toDrive({
  image: dNBR.toFloat(),
  description: 'dNBR_change_2025_2026',
  fileNamePrefix: 'dNBR_change_2025_2026',
  region: aoi,
  scale: analysisScale,
  maxPixels: 1e12
});

Export.image.toDrive({
  image: classified.toInt(),
  description: 'dNBR_change_class_2025_2026',
  fileNamePrefix: 'dNBR_change_class_2025_2026',
  region: aoi,
  scale: analysisScale,
  maxPixels: 1e12
});

Export.table.toDrive({
  collection: statsFC,
  description: 'dNBR_change_stats_2025_2026',
  fileFormat: 'CSV'
});
