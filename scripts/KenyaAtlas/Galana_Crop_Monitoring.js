// IGAD Crop Condition Monitoring and Forecasting System
// Site: Galana-Kulalu AOI
// Platform: Google Earth Engine JavaScript API
// Ultra-light stable version. Rewritten to avoid memory limit and hotspot errors.

// ==================== SECTION 1. USER PARAMETERS ====================
var AOI_ASSET = 'projects/ee-gabrielsanya-kenya/assets/Galanakulalu';
var START_YEAR = 2018;
var END_YEAR = 2026;
var ANALYSIS_YEAR = 2026;
var BASELINE_START = 2018;
var BASELINE_END = 2025;
var GROWING_SEASON_START_MONTH = 3;
var GROWING_SEASON_END_MONTH = 10;
var CLOUD_FILTER = 80;
var NDVI_CROP_THRESHOLD = 0.35;
var DISPLAY_SCALE_S2 = 20;
var DISPLAY_SCALE_LIGHT = 500;
var DISPLAY_SCALE_OUTLOOK = 100;
var CHART_SCALE = 500;
var AREA_SCALE = 30;
var SHOW_OPTIONAL_LAYER_PACK = false;
var RUN_SUPERVISED_CLASSIFICATION = false;
var RUN_CROP_TYPE_CLASSIFICATION = false;

// ==================== SECTION 2. AOI ====================
var aoiFc = ee.FeatureCollection(AOI_ASSET);
var aoi = aoiFc.geometry();
Map.clear();
Map.setOptions('HYBRID');
Map.centerObject(aoi, 11);
var aoiOutline = ee.Image().byte().paint({ featureCollection: aoiFc, color: 1, width: 2 });
Map.addLayer(aoiOutline, { palette: ['ff0000'] }, 'AOI Boundary', true, 1);

// ==================== SECTION 3. UI HELPERS ====================
var legendRegistry = {};
var dashboard = ui.Panel({ style: { position: 'top-left', width: '340px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.94)' } });
Map.add(dashboard);
var chartPanel = ui.Panel({ style: { position: 'bottom-right', width: '460px', maxHeight: '48%', padding: '8px', backgroundColor: 'rgba(255,255,255,0.92)' } });
Map.add(chartPanel);

function registerLegend(name, panel) {
  legendRegistry[name] = panel;
  panel.style().set('shown', false);
  Map.add(panel);
}
function hideAllLegends() {
  Object.keys(legendRegistry).forEach(function(name) { legendRegistry[name].style().set('shown', false); });
}
function showLegend(name) {
  hideAllLegends();
  if (legendRegistry[name]) legendRegistry[name].style().set('shown', true);
}
function createLegend(title, entries, position) {
  position = position || 'bottom-left';
  var panel = ui.Panel({ style: { position: position, padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.92)' } });
  panel.add(ui.Label(title, { fontWeight: 'bold', fontSize: '13px' }));
  entries.forEach(function(entry) {
    var row = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '2px 0' } });
    row.add(ui.Label(' ', { width: '16px', height: '12px', backgroundColor: entry.color }));
    row.add(ui.Label(entry.label, { fontSize: '12px' }));
    panel.add(row);
  });
  return panel;
}
function createContinuousLegend(title, palette, minVal, maxVal, position) {
  position = position || 'bottom-left';
  var panel = ui.Panel({ style: { position: position, padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.92)' } });
  panel.add(ui.Label(title, { fontWeight: 'bold', fontSize: '13px' }));
  var thumb = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0).subtract(ee.Image.pixelLonLat().select(0).min()).divide(ee.Image.pixelLonLat().select(0).max().subtract(ee.Image.pixelLonLat().select(0).min())),
    params: { bbox: [0, 0, 1, 1], dimensions: '220x16', min: 0, max: 1, palette: palette }
  });
  panel.add(thumb);
  var labelRow = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal') });
  labelRow.add(ui.Label(String(minVal), { fontSize: '11px' }));
  labelRow.add(ui.Label(String((minVal + maxVal) / 2), { fontSize: '11px' }));
  labelRow.add(ui.Label(String(maxVal), { fontSize: '11px' }));
  panel.add(labelRow);
  return panel;
}

function addLayerToggleButton(label, legendName) {
  var btn = ui.Button(label, function() {
    var layers = Map.getLayers();
    for (var i = 0; i < layers.size(); i++) {
      var l = layers.get(i);
      if (l.getName() === label) { l.setShown(!l.isShown()); if (legendName) showLegend(legendName); return; }
    }
  });
  btn.style().set('stretch', 'horizontal').set('margin', '2px 0');
  return btn;
}
function clearCharts() { chartPanel.clear(); }
function addChartTitle(title) {
  chartPanel.add(ui.Label(title, { fontWeight: 'bold', fontSize: '13px' }).style({ margin: '4px 0' }));
}
function addChart(chart) { chartPanel.add(chart); }

// ==================== SECTION 4. HELPERS ====================
function safeDivide(a, b) {
  return a.divide(b.where(b.abs().lt(1e-6), ee.Image.constant(1e-6)));
}
function constantImage(names, value, proj) {
  var img = ee.Image.constant(value);
  if (names && names.length) img = img.rename(names[0]);
  if (proj) img = img.setDefaultProjection(proj);
  return img;
}
function constantMasked(names, proj) {
  return constantImage(names, 0, proj).mask(0);
}
function safeFirst(collection, fallbackImage) {
  var col = ee.ImageCollection(collection);
  return ee.Image(ee.Algorithms.If(col.size().gt(0), col.sort('system:time_start').first(), fallbackImage));
}
function yearlyCollection(startYear, endYear, builder) {
  var list = ee.List.sequence(startYear, endYear);
  return ee.ImageCollection(list.map(function(y) {
    var img = builder(ee.Number(y));
    return ee.Image(img).set('year', y).set('system:time_start', ee.Date.fromYMD(ee.Number(y), 6, 1).millis());
  }));
}
function meanValue(image, band, region, scale) {
  return ee.Dictionary(ee.Image(image).select(band).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: region,
    scale: scale,
    bestEffort: true,
    maxPixels: 1e10
  })).getNumber(band);
}
function sumAreaHa(maskImage, region, scale) {
  var area = ee.Image.pixelArea().divide(1e4).updateMask(ee.Image(maskImage).mask());
  return ee.Dictionary(area.reduceRegion({ reducer: ee.Reducer.sum(), geometry: region, scale: scale, maxPixels: 1e13 })).getNumber('area');
}
function setProj(img, proj) { return ee.Image(img).setDefaultProjection(proj); }
function coarse(img, proj, scale) { return ee.Image(img).reduceResolution(ee.Reducer.mean()).reproject(proj, null, scale); }
function printAreaStats(classImage, classValues, classNames, scale, title) {
  var areaImg = ee.Image.pixelArea().divide(1e4).addBands(ee.Image(classImage).toByte().rename('class'));
  var reduced = areaImg.reduceRegion({
    reducer: ee.Reducer.sum().group(1, 'class'),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e13
  });
  var valueList = ee.List(classValues);
  var nameList = ee.List(classNames);
  var nameDict = ee.Dictionary.fromLists(
    valueList.map(function(v) { return ee.Number(v).format(); }),
    nameList
  );
  var groups = ee.List(ee.Dictionary(reduced).get('groups'));
  var features = ee.FeatureCollection(groups.map(function(g) {
    var d = ee.Dictionary(g);
    var cls = ee.Number(d.get('class')).int();
    var name = nameDict.get(ee.Number(cls).format(), 'Other');
    return ee.Feature(null, { class: cls, area_ha: d.get('sum'), name: name });
  }));
  print(title, features.sort('area_ha', false));
}

// ==================== SECTION 5. SENTINEL-2 ====================
function maskS2(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return image.updateMask(mask);
}
function addS2Indices(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var evi = image.expression('2.5 * ((NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1))', { NIR: image.select('B8'), Red: image.select('B4'), Blue: image.select('B2') }).rename('EVI');
  var savi = image.expression('1.5 * (NIR - Red) / (NIR + Red + 0.5)', { NIR: image.select('B8'), Red: image.select('B4') }).rename('SAVI');
  var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  var mndwi = image.normalizedDifference(['B3', 'B11']).rename('MNDWI');
  var nirv = ndvi.multiply(image.select('B8')).rename('NIRV');
  var nddi = ndvi.subtract(ndwi).divide(ndvi.add(ndwi)).rename('NDDI');
  return image.addBands([ndvi, evi, savi, ndmi, ndwi, mndwi, nirv, nddi]);
}
var s2Raw = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate(ee.Date.fromYMD(START_YEAR, 1, 1), ee.Date.fromYMD(END_YEAR, 12, 31))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', CLOUD_FILTER))
  .map(maskS2)
  .map(addS2Indices);
var s2Proj = s2Raw.first().select('B4').projection();
var s2Base = s2Raw.map(function(img) { return setProj(img, s2Proj); });

function getS2CompositeForYear(year, startMonth, endMonth) {
  var start = ee.Date.fromYMD(ee.Number(year), ee.Number(startMonth), 1);
  var end = ee.Date.fromYMD(ee.Number(year), ee.Number(endMonth), 1).advance(1, 'month');
  var subset = s2Base.filterDate(start, end);
  var bandNames = ['B2', 'B3', 'B4', 'B5', 'B8', 'B11', 'B12', 'NDVI', 'EVI', 'SAVI', 'NDMI', 'NDWI', 'MNDWI', 'NIRV', 'NDDI'];
  var composite = ee.Algorithms.If(
    subset.size().gt(8),
    subset.median().select(bandNames).set('year', year).set('system:time_start', start.millis()).set('defaultProjection', s2Proj),
    constantMasked(['NDVI'], s2Proj).set('year', year).set('system:time_start', start.millis())
  );
  return ee.Image(composite);
}
function getBestAvailableS2Composite(targetYear, startMonth, endMonth) {
  var yearsToTry = ee.List.sequence(targetYear, START_YEAR);
  var withCounts = ee.FeatureCollection(yearsToTry.map(function(y) {
    var start = ee.Date.fromYMD(ee.Number(y), ee.Number(startMonth), 1);
    var end = ee.Date.fromYMD(ee.Number(y), ee.Number(endMonth), 1).advance(1, 'month');
    var count = s2Base.filterDate(start, end).size();
    return ee.Feature(null, { year: y, count: count });
  }));
  var valid = withCounts.filter(ee.Filter.gt('count', 0));
  var fallbackYear = ee.Number(valid.size().gt(0) ? valid.first().get('year') : END_YEAR);
  return getS2CompositeForYear(fallbackYear, startMonth, endMonth);
}
var currentComposite = getBestAvailableS2Composite(ANALYSIS_YEAR, GROWING_SEASON_START_MONTH, GROWING_SEASON_END_MONTH);
var compositeYearUsed = ee.Image(currentComposite).get('year');
Map.addLayer(ee.Image(currentComposite).clip(aoi), { bands: ['B4', 'B3', 'B2'], min: 200, max: 3500, gamma: 1.2 }, 'Sentinel-2 RGB', false);
Map.addLayer(ee.Image(currentComposite).clip(aoi), { bands: ['B8', 'B4', 'B3'], min: 300, max: 4500 }, 'Sentinel-2 False Color', false);
print('Composite year used', compositeYearUsed);

// ==================== SECTION 6. OTHER DATASETS ====================
var worldCover10m = ee.Image('ESA/WorldCover/v200/2021').select('Map').clip(aoi);
var dynamicWorld = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(aoi).filterDate(ee.Date.fromYMD(END_YEAR, 1, 1), ee.Date.fromYMD(END_YEAR, 12, 31));
var modisLC = ee.ImageCollection('MODIS/061/MCD12Q1').filterBounds(aoi).filterDate(ee.Date.fromYMD(END_YEAR, 1, 1), ee.Date.fromYMD(END_YEAR, 12, 31)).select('LC_Type1');
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterBounds(aoi).filterDate(ee.Date.fromYMD(START_YEAR, 1, 1), ee.Date.fromYMD(END_YEAR, 12, 31));
var jrcWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').clip(aoi);
var srtm = ee.Image('USGS/SRTMGL1_003').clip(aoi);

// ==================== SECTION 7. LEGENDS ====================
registerLegend('LandCover', createLegend('Land Cover', [
  { color: '#66a61e', label: 'Cropland' }, { color: '#1b5e20', label: 'Forest' },
  { color: '#c6e48b', label: 'Grassland' }, { color: '#d4c4a8', label: 'Bare land' }, { color: '#2196f3', label: 'Water' }
]));
registerLegend('NDVI', createContinuousLegend('NDVI', ['#800000', '#673027', '#fdae61', '#fee08b', '#d9ef8b', '#66b063', '#1a9850'], -0.2, 0.9));
registerLegend('Stress Severity', createLegend('Stress Severity', [
  { color: '#860000', label: 'Extreme stress' }, { color: '#d73027', label: 'Severe stress' },
  { color: '#fc8d59', label: 'Moderate stress' }, { color: '#fee08b', label: 'Mild stress' }, { color: '#1a9850', label: 'Healthy' }
]));
registerLegend('Yield Outlook', createLegend('Yield Outlook', [
  { color: '#8b0000', label: 'Very low' }, { color: '#473827', label: 'Low' },
  { color: '#fee08b', label: 'Average' }, { color: '#91cf60', label: 'Good' }, { color: '#1a9850', label: 'Very good' }
]));
registerLegend('Cropland Water Regime', createLegend('Cropland Water Regime', [
  { color: '#3182bd', label: 'Likely irrigated' }, { color: '#fee08b', label: 'Likely rainfed' }
]));
registerLegend('Crop Condition Anomaly', createLegend('Crop Condition Anomaly', [
  { color: '#d73027', label: 'Severely below normal' }, { color: '#fc8d59', label: 'Below normal' },
  { color: '#ffffbf', label: 'Near normal' }, { color: '#91cf60', label: 'Above normal' }, { color: '#1a9850', label: 'Much above normal' }
]));

// ==================== SECTION 8. LAND COVER ====================
var dwMode = ee.Image(dynamicWorld.select('label').mode()).clip(aoi);
var dwCropProb = ee.Image(dynamicWorld.select('crops').mean()).clip(aoi);
var modisLCRecent = safeFirst(modisLC.sort('system:time_start'), ee.Image.constant(0).rename('LC_Type1').clip(aoi));
var worldCoverReclass = worldCover10m.remap([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100], [1, 2, 3, 3, 1, 3, 4, 5, 4, 5, 5]);
var dwReclass = dwMode.remap([0, 1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 3, 1, 3, 4, 5, 5]);
var modisReclass = modisLCRecent.remap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], [2, 2, 3, 3, 3, 2, 3, 4, 4, 3, 3, 1, 1, 1, 4, 4, 4]);
var landCoverConsensus = ee.ImageCollection([worldCoverReclass, dwReclass, modisReclass]).reduce(ee.Reducer.mode()).clip(aoi).setDefaultProjection(s2Proj);
Map.addLayer(worldCover10m, { min: 10, max: 100, palette: ['#1a5b2b', '#358221', '#87d19e', '#ffdb5c', '#ed022a', '#ed9fd4', '#72c3b1', '#b8a691', '#d1c5c0', '#1a5b2b', '#496aff'] }, 'ESA Land Cover 10 m', false);
Map.addLayer(landCoverConsensus, { min: 1, max: 5, palette: ['#66a61e', '#1b5e20', '#c6e48b', '#d4c4a8', '#2196f3'] }, 'Consensus Land Cover', false);
showLegend('LandCover');
printAreaStats(landCoverConsensus, [1, 2, 3, 4, 5], ['Cropland', 'Forest', 'Grassland', 'Bare land', 'Water'], AREA_SCALE, 'Land cover area statistics (ha)');

// ==================== SECTION 9. CROPLAND MASK ====================
var ndvi = ee.Image(currentComposite).select('NDVI').clip(aoi);
var ndwi = ee.Image(currentComposite).select('NDWI').clip(aoi);
var ndmi = ee.Image(currentComposite).select('NDMI').clip(aoi);
var s2Crop = ndvi.gt(NDVI_CROP_THRESHOLD).and(ndmi.gt(0));
var wcCrop = worldCover10m.eq(48);
var dwCrop = dwCropProb.gt(0.35);
var modisCrop = modisLCRecent.eq(12).or(modisLCRecent.eq(14));
var waterMask = ndwi.gt(0.2).or(worldCover10m.eq(88)).or(worldCover10m.eq(90)).or(worldCover10m.eq(95));
var croplandMask = s2Crop.add(wcCrop).add(dwCrop).add(modisCrop).gte(2).and(waterMask.not()).selfMask().rename('cropland_mask').clip(aoi).setDefaultProjection(s2Proj);
Map.addLayer(croplandMask, { palette: ['ffd700'] }, 'Final Cropland Mask', false);
var croplandAreaHa = sumAreaHa(croplandMask, aoi, AREA_SCALE);
print('Cropland area (ha)', croplandAreaHa);

// ==================== SECTION 10. CURRENT CONDITION LAYERS ====================
var currentNDVI = ee.Image(currentComposite).select('NDVI').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
var currentEVI = ee.Image(currentComposite).select('EVI').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
var currentSAVI = ee.Image(currentComposite).select('SAVI').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
var currentNDMI = ee.Image(currentComposite).select('NDMI').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
var currentNDWI = ee.Image(currentComposite).select('NDWI').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
var currentNIRv = ee.Image(currentComposite).select('NIRV').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
Map.addLayer(currentNDVI, { min: 0, max: 0.9, palette: ['#800000', '#673027', '#fdae61', '#fee08b', '#d9ef8b', '#66b063', '#1a9850'] }, 'Current NDVI', false);
showLegend('NDVI');

// ==================== SECTION 11. BASELINE ====================
var baselineSeasonCollection = yearlyCollection(BASELINE_START, BASELINE_END, function(y) {
  return getS2CompositeForYear(y, GROWING_SEASON_START_MONTH, GROWING_SEASON_END_MONTH).select('NDVI').clip(aoi).setDefaultProjection(s2Proj);
});
var baselineSeasonMean = baselineSeasonCollection.reduce(ee.Reducer.mean());
var baselineSeasonStd = baselineSeasonCollection.reduce(ee.Reducer.stdDev());
var ndviMin = baselineSeasonCollection.reduce(ee.Reducer.min());
var ndviMax = baselineSeasonCollection.reduce(ee.Reducer.max());

// ==================== SECTION 12. ANOMALIES ====================
var currentNDVILight = coarse(currentNDVI, s2Proj, DISPLAY_SCALE_OUTLOOK);
var ndviAnomaly = currentNDVILight.subtract(baselineSeasonMean).rename('ndvi_anomaly').updateMask(croplandMask).setDefaultProjection(s2Proj);
var ndviZ = safeDivide(currentNDVILight.subtract(baselineSeasonMean), baselineSeasonStd).rename('NDVI_z').updateMask(croplandMask).setDefaultProjection(s2Proj);
var anomalyClass = ndviZ.expression(
  "var z = b('NDVI_z'); return (z < -2) ? 1 : (z < -1) ? 2 : (z < 1) ? 3 : (z < 2) ? 4 : 5;"
).rename('anomaly_class').updateMask(croplandMask).setDefaultProjection(s2Proj);
Map.addLayer(ndviAnomaly, { min: -0.3, max: 0.3, palette: ['#860000', '#d73027', '#ffffbf', '#91cf60', '#006837'] }, 'NDVI Anomaly', false);

// ==================== SECTION 13. CLIMATE ANOMALIES ====================
function getYearRainImage(y) {
  var start = ee.Date.fromYMD(ee.Number(y), GROWING_SEASON_START_MONTH, 1);
  var end = ee.Date.fromYMD(ee.Number(y), GROWING_SEASON_END_MONTH, 1).advance(1, 'month');
  var img = chirps.filterDate(start, end).select('precipitation').sum().clip(aoi);
  return ee.Algorithms.If(chirps.filterDate(start, end).size().gt(0), img, ee.Image.constant(0).rename('precipitation').clip(aoi));
}
var currentRain = getYearRainImage(ANALYSIS_YEAR);
var baselineRainCollection = yearlyCollection(BASELINE_START, BASELINE_END, function(y) { return getYearRainImage(y); });
var rainMean = baselineRainCollection.reduce(ee.Reducer.mean());
var rainStd = baselineRainCollection.reduce(ee.Reducer.stdDev());
var rainAnomaly = ee.Image(currentRain).subtract(rainMean).rename('rain_anomaly');
var rainPct = safeDivide(ee.Image(currentRain).multiply(100), rainMean).rename('rain_pct');
var spi = safeDivide(ee.Image(currentRain).subtract(rainMean), rainStd).rename('spi');
Map.addLayer(rainAnomaly.clip(aoi), { min: -200, max: 200, palette: ['#860000', '#d73027', '#ffffbf', '#91cf60', '#006837'], opacity: 0.8 }, 'Rainfall Anomaly (mm)', false);
Map.addLayer(spi.clip(aoi), { min: -2, max: 2, palette: ['#860000', '#fc8d59', '#fee08b', '#ffffbf', '#d9ef8b', '#1a9850'], opacity: 0.8 }, 'SPI', false);

// ==================== SECTION 14. STRESS LAYERS (COARSE ONLY) ====================
var rainPctCoarseLight = coarse(rainPct, s2Proj, DISPLAY_SCALE_OUTLOOK);
var vci = safeDivide(currentNDVILight.subtract(ndviMin), ndviMax.subtract(ndviMin)).multiply(100).updateMask(croplandMask).rename('VCI');
var stressClass = vci.expression(
  "var v = b('VCI'); return (v < 10) ? 1 : (v < 20) ? 2 : (v < 35) ? 3 : (v < 50) ? 4 : 5;"
).rename('stress_class').updateMask(croplandMask);
var coarseCropMask = coarse(croplandMask, s2Proj, DISPLAY_SCALE_OUTLOOK);
var stressHotspots = vci.lt(35).and(ndviZ.lt(-1)).and(rainPctCoarseLight.lt(80)).and(coarseCropMask).selfMask();
var cropFailureRisk = vci.lt(20).and(ndviZ.lt(-1.5)).and(rainPctCoarseLight.lt(70)).and(coarseCropMask).selfMask();
var ewRisk = stressHotspots.add(cropFailureRisk).gte(1).selfMask().rename('ew_risk');
Map.addLayer(vci, { min: 0, max: 100, palette: ['#860000', '#d73027', '#fee08b', '#91cf60', '#1a9850'] }, 'Vegetation Condition Index', false);
Map.addLayer(stressClass, { min: 1, max: 5, palette: ['#860000', '#d73027', '#fc8d59', '#fee08b', '#1a9850'] }, 'Crop Stress Severity', false);
Map.addLayer(stressHotspots, { palette: 'ff00ff' }, 'Vegetation Stress Hotspots', false);
Map.addLayer(cropFailureRisk, { palette: '8b0000' }, 'Crop Failure Risk Zones', false);
Map.addLayer(ewRisk, { min: 0, max: 2, palette: ['#fee08b', '#d73027'] }, 'Early Warning Risk Score', false);

// ==================== SECTION 15. YIELD OUTLOOK ====================
var rainPctOutlook = rainPctCoarseLight;
var vciOutlook = vci;
var ndviOutlook = currentNDVILight;
var yieldScore = ee.Image(0).expression(
  "var n = b('NDVI'), v = b('VCI'), r = b('rain_pct'); r = r / 100; return (n * 40 + v * 0.4 + r * 20);",
  { NDVI: ndviOutlook, VCI: vciOutlook, rain_pct: rainPctOutlook }
).rename('yield_score').updateMask(coarseCropMask);
var yieldOutlook = yieldScore.expression(
  "var s = b('yield_score'); return (s < 25) ? 1 : (s < 40) ? 2 : (s < 55) ? 3 : (s < 78) ? 4 : 5;"
).rename('yield_outlook').updateMask(coarseCropMask);
Map.addLayer(yieldOutlook, { min: 1, max: 5, palette: ['#8b0000', '#473827', '#fee08b', '#91cf60', '#1a9850'] }, 'Crop Yield Outlook', false);

// ==================== SECTION 16. WATER AND TERRAIN ====================
var permanentWater = jrcWater.select('occurrence').gt(80).selfMask();
var currentSurfaceWater = ee.Image(currentComposite).normalizedDifference(['B3', 'B11']).gt(0.2).selfMask().updateMask(croplandMask);
var irrigationPotential = ndwi.gt(0).and(ndvi.gt(0.2)).and(rainPct.lt(80)).updateMask(croplandMask);
var irrigatedRainfed = ndwi.gt(0.15).multiply(2).add(ndwi.lte(0.15)).updateMask(croplandMask).rename('water_regime');
Map.addLayer(permanentWater.clip(aoi), { palette: 'darkblue' }, 'Permanent Water', false);
Map.addLayer(currentSurfaceWater.clip(aoi), { palette: 'cyan' }, 'Current Surface Water', false);
Map.addLayer(irrigationPotential.clip(aoi), { palette: 'lightblue', opacity: 0.5 }, 'Irrigation Potential', false);
Map.addLayer(irrigatedRainfed.clip(aoi), { min: 1, max: 2, palette: ['#fee08b', '#3182bd'] }, 'Irrigated vs Rainfed', false);
var elevation = srtm.select('elevation');
var slope = ee.Terrain.slope(elevation);
var aspect = ee.Terrain.aspect(elevation);
Map.addLayer(elevation, { min: 0, max: 2000, palette: ['#2d5016', '#8b4513', '#f5f5dc', '#ffffff'] }, 'Elevation', false);
Map.addLayer(slope, { min: 0, max: 45, palette: ['#fff7bc', '#fec44f', '#d95f0e', '#993404'] }, 'Slope', false);
Map.addLayer(aspect, { min: 0, max: 360, palette: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494'] }, 'Aspect', false);

// ==================== SECTION 17. CHART COLLECTIONS ====================
var seasonalNdviCollection = yearlyCollection(START_YEAR, END_YEAR, function(y) {
  return getS2CompositeForYear(y, GROWING_SEASON_START_MONTH, GROWING_SEASON_END_MONTH).select('NDVI').updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj);
});
var seasonalRainCollection = yearlyCollection(START_YEAR, END_YEAR, function(y) {
  var start = ee.Date.fromYMD(ee.Number(y), GROWING_SEASON_START_MONTH, 1);
  var end = ee.Date.fromYMD(ee.Number(y), GROWING_SEASON_END_MONTH, 1).advance(1, 'month');
  return chirps.filterDate(start, end).select('precipitation').sum().rename('rainfall').clip(aoi).setDefaultProjection(s2Proj);
});
var analysisMonthlyNdvi = ee.ImageCollection.fromImages(ee.List.sequence(1, 12).map(function(m) {
  m = ee.Number(m);
  var start = ee.Date.fromYMD(ANALYSIS_YEAR, m, 1);
  var end = start.advance(1, 'month');
  var subset = s2Base.filterDate(start, end).select('NDVI');
  var img = ee.Algorithms.If(subset.size().gt(0), subset.median().rename('NDVI'), constantImage(['NDVI'], 0, s2Proj));
  return ee.Image(img).updateMask(croplandMask).clip(aoi).setDefaultProjection(s2Proj).set('month', m).set('system:time_start', start.millis());
}));
var analysisMonthlyRain = ee.ImageCollection.fromImages(ee.List.sequence(1, 12).map(function(m) {
  m = ee.Number(m);
  var start = ee.Date.fromYMD(ANALYSIS_YEAR, m, 1);
  var end = start.advance(1, 'month');
  var subset = chirps.filterDate(start, end).select('precipitation').sum();
  var img = ee.Algorithms.If(chirps.filterDate(start, end).size().gt(0), subset.rename('rainfall'), constantImage(['rainfall'], 0, s2Proj));
  return ee.Image(img).clip(aoi).setDefaultProjection(s2Proj).set('month', m).set('system:time_start', start.millis());
}));

// ==================== SECTION 18. CHARTS ====================
clearCharts();
addChartTitle('Seasonal NDVI Trend');
addChart(ui.Chart.image.series(seasonalNdviCollection, aoi, ee.Reducer.mean(), CHART_SCALE).setOptions({
  title: 'Growing Season NDVI by Year', hAxis: { title: 'Year' }, vAxis: { title: 'Mean NDVI' },
  lineWidth: 2, pointSize: 4, curveType: 'function', legend: { position: 'none' }, colors: ['#1a9856']
}));
addChartTitle('Seasonal Rainfall Trend');
addChart(ui.Chart.image.series(seasonalRainCollection, aoi, ee.Reducer.mean(), CHART_SCALE).setOptions({
  title: 'Growing Season Rainfall by Year', hAxis: { title: 'Year' }, vAxis: { title: 'Rainfall (mm)' },
  lineWidth: 2, pointSize: 4, colors: ['#1e90ff']
}));
addChartTitle('Monthly NDVI for Composite Year');
addChart(ui.Chart.image.series(analysisMonthlyNdvi, aoi, ee.Reducer.mean(), CHART_SCALE).setOptions({
  title: 'Monthly NDVI', hAxis: { title: 'Date' }, vAxis: { title: 'Mean NDVI' },
  lineWidth: 1, pointSize: 3, curveType: 'function', colors: ['#2ca25f']
}));
addChartTitle('Monthly Rainfall for Composite Year');
addChart(ui.Chart.image.series(analysisMonthlyRain, aoi, ee.Reducer.mean(), CHART_SCALE).setOptions({
  title: 'Monthly Rainfall', hAxis: { title: 'Date' }, vAxis: { title: 'Rainfall (mm)' }, colors: ['#3182bd']
}));

// ==================== SECTION 19. DASHBOARD ====================
dashboard.clear();
dashboard.add(ui.Label('IGAD Crop Monitoring Dashboard', { fontWeight: 'bold', fontSize: '16px' }));
dashboard.add(ui.Label('AOI: Galana-Kulalu'));
dashboard.add(ui.Label('Requested analysis year: ' + ANALYSIS_YEAR));
dashboard.add(ui.Label('Composite year used: loading...', { id: 'compositeYearLabel' }));
dashboard.add(ui.Label('Cropland area (ha): loading...', { id: 'croplandAreaLabel' }));
compositeYearUsed.evaluate(function(val) {
  var el = document.getElementById('compositeYearLabel');
  if (el) el.innerText = 'Composite year used: ' + val;
});
croplandAreaHa.evaluate(function(val) {
  var el = document.getElementById('croplandAreaLabel');
  if (el) el.innerText = 'Cropland area (ha): ' + (val != null ? Math.round(val) : 'n/a');
});
dashboard.add(ui.Label('Layer controls', { fontWeight: 'bold' }));
var buttonPanel = ui.Panel({ layout: ui.Panel.Layout.Flow('vertical'), style: { stretch: 'horizontal' } });
buttonPanel.add(addLayerToggleButton('Consensus Land Cover', 'LandCover'));
buttonPanel.add(addLayerToggleButton('Final Cropland Mask'));
buttonPanel.add(addLayerToggleButton('Current NDVI', 'NDVI'));
buttonPanel.add(addLayerToggleButton('NDVI Anomaly', 'Crop Condition Anomaly'));
buttonPanel.add(addLayerToggleButton('Crop Stress Severity', 'Stress Severity'));
buttonPanel.add(addLayerToggleButton('Crop Yield Outlook', 'Yield Outlook'));
buttonPanel.add(addLayerToggleButton('Irrigated vs Rainfed', 'Cropland Water Regime'));
dashboard.add(buttonPanel);

// ==================== SECTION 20. PRINTS ====================
print('Cropland area ha', croplandAreaHa);
print('Composite year used', compositeYearUsed);
print('Seasonal NDVI collection size', seasonalNdviCollection.size());
print('Seasonal rainfall collection size', seasonalRainCollection.size());
print('Monthly NDVI collection size', analysisMonthlyNdvi.size());
print('Monthly rainfall collection size', analysisMonthlyRain.size());

// ==================== SECTION 21. OPTIONAL PLACEHOLDERS ====================
if (SHOW_OPTIONAL_LAYER_PACK) { print('Optional layer pack enabled'); }
if (RUN_SUPERVISED_CLASSIFICATION) { print('Supervised classification enabled'); }
if (RUN_CROP_TYPE_CLASSIFICATION) { print('Crop type classification enabled'); }

print('Script completed successfully.');
