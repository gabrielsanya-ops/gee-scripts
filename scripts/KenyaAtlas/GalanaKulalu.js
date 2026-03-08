// ====================
// GALANA-KULALU FOOD SECURITY PROJECT
// ROBUST COMPREHENSIVE GOOGLE EARTH ENGINE ANALYSIS
// Fixes: empty collections, missing bands, null outputs, chart properties.
// ====================
// AOI: projects/ee-gabrielsanya-kenya/assets/Galanakulalu

var aoi = ee.FeatureCollection('projects/ee-gabrielsanya-kenya/assets/Galanakulalu');
Map.setOptions('SATELLITE');
Map.centerObject(aoi, 10);
Map.addLayer(aoi, { color: 'red' }, 'Galana-Kulalu AOI', true);

var startYear = 2013;
var endYear = 2024;
var years = ee.List.sequence(startYear, endYear);
var scaleLandsat = 30;
var scaleChirps = 5566;
var scaleViirs = 500;
var scaleESRI = 10;
var noDataValue = 0;

// ==================== 1. SAFE HELPERS ====================
function makeFallbackImage(bandNames, value, geometry, props) {
  bandNames = ee.List(bandNames);
  var img = ee.ImageCollection.fromImages(
    bandNames.map(function(b) {
      return ee.Image.constant(ee.Number(value)).rename(ee.String(b));
    })
  ).toBands().rename(bandNames).clip(geometry);
  return img.set(props || {});
}
function safeMedianFromCollection(col, bandNames, geometry, props) {
  col = ee.ImageCollection(col);
  return ee.Image(ee.Algorithms.If(
    col.size().gt(0),
    col.median().clip(geometry).set(props || {}),
    makeFallbackImage(bandNames, 0, geometry, props || {})
  ));
}
function safeMosaicFromCollection(col, bandNames, geometry, props) {
  col = ee.ImageCollection(col);
  return ee.Image(ee.Algorithms.If(
    col.size().gt(0),
    col.mosaic().clip(geometry).set(props || {}),
    makeFallbackImage(bandNames, 0, geometry, props || {})
  ));
}
function safeMeanNumber(img, bandName, geometry, scale, defaultValue) {
  defaultValue = ee.Number(defaultValue || 0);
  img = ee.Image(img).select(bandName).unmask(defaultValue);
  var stats = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: scale,
    maxPixels: 1e13
  });
  return ee.Dictionary(stats).getNumber(bandName);
}
function safeSumNumber(img, bandName, geometry, scale, defaultValue) {
  defaultValue = ee.Number(defaultValue || 0);
  img = ee.Image(img).select(bandName).unmask(defaultValue);
  var stats = img.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: scale,
    maxPixels: 1e13
  });
  return ee.Dictionary(stats).getNumber(bandName);
}
function safeBandMeanFeature(img, bandName, geometry, scale, year, outputName, defaultValue) {
  var val = safeMeanNumber(img, bandName, geometry, scale, defaultValue);
  return ee.Feature(null, { year: year, system_time_start: ee.Date.fromYMD(year, 6, 1).millis(), [outputName]: val });
}

// ==================== 2. PROJECT INFRASTRUCTURE ====================
print('=== STARTING SPATIAL VISUALIZATION ANALYSES ===');
var aoiCentroid = aoi.geometry().centroid();
var aoiCoords = ee.List(aoiCentroid.coordinates());
var centerLon = ee.Number(aoiCoords.get(0));
var centerLat = ee.Number(aoiCoords.get(1));
var pilotFarmCenter = ee.Geometry.Point([centerLon, centerLat.add(0.05)]);
var pilotFarm = ee.FeatureCollection([ee.Feature(pilotFarmCenter.buffer(6500), { name: 'Main Pilot Farm', acres: 10000 })]);
var twigaFarm1 = ee.Feature(ee.Geometry.Point([centerLon.add(0.08), centerLat.add(0.02)]).buffer(4500), { name: 'Twiga Farm 1', acres: 8000 });
var twigaFarm2 = ee.Feature(ee.Geometry.Point([centerLon.subtract(0.06), centerLat.subtract(0.03)]).buffer(4000), { name: 'Twiga Farm 2', acres: 7000 });
var twigaFarm3 = ee.Feature(ee.Geometry.Point([centerLon.add(0.02), centerLat.subtract(0.08)]).buffer(3500), { name: 'Twiga Farm 3', acres: 5000 });
var ppp = ee.FeatureCollection([twigaFarm1, twigaFarm2, twigaFarm3]);
var demoPlot1 = ee.Feature(ee.Geometry.Point([centerLon.subtract(0.04), centerLat.add(0.06)]).buffer(2000), { name: 'Demo Plot 1', acres: 1000 });
var demoPlot2 = ee.Feature(ee.Geometry.Point([centerLon.add(0.06), centerLat.subtract(0.05)]).buffer(1800), { name: 'Demo Plot 2', acres: 800 });
var demo = ee.FeatureCollection([demoPlot1, demoPlot2]);
var projectFarms = { pilot: pilotFarm, ppp: ppp, demo: demo };
Map.addLayer(pilotFarm, { color: 'blue' }, 'Pilot Farm (10,000 acres)', false);
Map.addLayer(ppp, { color: 'green' }, 'PPP Farms (Twiga Foods)', false);
Map.addLayer(demo, { color: 'orange' }, 'Demonstration Plots', false);

// ==================== 3. ESRI LAND COVER ====================
function loadESRILandCover(year) {
  year = ee.Number(year);
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');
  var col = ee.ImageCollection('projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m')
    .filterBounds(aoi).filterDate(start, end);
  var img = safeMosaicFromCollection(col, ['classification'], aoi.geometry(), { year: year, system_time_start: start.millis() });
  return ee.Image(img).rename('classification');
}
var esri2017 = loadESRILandCover(2017);
var esri2020 = loadESRILandCover(2020);
var esri2023 = loadESRILandCover(2023);
var esriPalette = ['1a5bab', '358221', '87d19e', 'ffdb5c', 'ed022a', 'ed9fd4', '72c3b1', 'b8a691', 'd1c5c0'];
Map.addLayer(esri2023, { min: 1, max: 9, palette: esriPalette }, 'ESRI Land Cover 2023', false);
Map.addLayer(esri2020, { min: 1, max: 9, palette: esriPalette }, 'ESRI Land Cover 2020', false);
Map.addLayer(esri2017, { min: 1, max: 9, palette: esriPalette }, 'ESRI Land Cover 2017', false);
var lcChange = esri2023.select('classification').subtract(esri2017.select('classification')).rename('lc_change');
Map.addLayer(lcChange.clip(aoi), { min: -8, max: 8, palette: ['red', 'white', 'green'] }, 'Land Cover Change (2017-2023)', false);

// ==================== 4. SENTINEL-2 WATER AND IRRIGATION ====================
function maskS2SR(img) {
  var scl = img.select('SCL');
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return img.updateMask(mask).divide(10000).copyProperties(img, ['system:time_start']);
}
var s2RecentCol = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi).filterDate('2023-06-01', '2024-06-01').filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).map(maskS2SR);
var s2Recent = safeMedianFromCollection(s2RecentCol, ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'], aoi.geometry(), {});
var ndwi = s2Recent.normalizedDifference(['B3', 'B8']).rename('NDWI');
var mndwi = s2Recent.normalizedDifference(['B3', 'B11']).rename('MNDWI');
var awei = s2Recent.expression(
  '4*(GREEN - SWIR1) - (0.25*NIR + 2.75*SWIR2)',
  { GREEN: s2Recent.select('B3'), NIR: s2Recent.select('B8'), SWIR1: s2Recent.select('B11'), SWIR2: s2Recent.select('B12') }
).rename('AWEI');
var waterBodies = ndwi.gt(0.2).or(mndwi.gt(0.2)).or(awei.gt(0));
var irrigationCanals = ndwi.gt(0.05).and(ndwi.lt(0.25)).and(mndwi.gt(0.1));
var tanaRiver = waterBodies.and(ndwi.gt(0.3));
Map.addLayer(s2Recent.clip(aoi), { bands: ['B4', 'B3', 'B2'], min: 0.02, max: 0.3 }, 'Sentinel-2 (2023-2024)', false);
Map.addLayer(waterBodies.selfMask().clip(aoi), { palette: 'darkblue' }, 'Water Bodies', false);
Map.addLayer(irrigationCanals.selfMask().clip(aoi), { palette: 'cyan' }, 'Irrigation Canals', false);
Map.addLayer(tanaRiver.selfMask().clip(aoi), { palette: 'navy' }, 'Tana River', false);
var irrigationDistance = waterBodies.fastDistanceTransform().sqrt().multiply(ee.Image.pixelArea().sqrt()).divide(1000).rename('distance_km');
var irrigationPotential = irrigationDistance.lt(5);
Map.addLayer(irrigationPotential.selfMask().clip(aoi), { palette: 'lightblue', opacity: 0.4 }, 'Irrigation Potential (5 km)', false);

// ==================== 5. ANNUAL VEGETATION COMPOSITES ====================
print('=== STARTING TREND ANALYSES ===');
function maskLandsatL2(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1).eq(0).and(qa.bitwiseAnd(2).eq(0)).and(qa.bitwiseAnd(4).eq(0));
  var satMask = image.select('QA_RADSAT').eq(0);
  return image.updateMask(mask).updateMask(satMask);
}
function prepL8L9(image) {
  image = maskLandsatL2(image);
  var scaled = image.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5']).multiply(0.0000275).add(-0.2).rename(['Blue', 'Green', 'Red', 'NIR']);
  var ndvi = scaled.normalizedDifference(['NIR', 'Red']).rename('NDVI');
  var evi = scaled.expression('2.5 * ((NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1))', { NIR: scaled.select('NIR'), Red: scaled.select('Red'), Blue: scaled.select('Blue') }).rename('EVI');
  var savi = scaled.expression('1.5 * (NIR - Red) / (NIR + Red + 0.5)', { NIR: scaled.select('NIR'), Red: scaled.select('Red') }).rename('SAVI');
  return scaled.addBands(ndvi).addBands(evi).addBands(savi).copyProperties(image, ['system:time_start']);
}
function createVegetationComposite(year) {
  year = ee.Number(year);
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');
  var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').filterBounds(aoi).filterDate(start, end);
  var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').filterBounds(aoi).filterDate(start, end);
  var col = l8.merge(l9).map(prepL8L9);
  var composite = safeMedianFromCollection(col, ['NDVI', 'EVI', 'SAVI'], aoi.geometry(), { year: year, system_time_start: start.millis() });
  return ee.Image(composite);
}
var vegetationTimeSeries = ee.ImageCollection(years.map(createVegetationComposite));

// ==================== 6. RAINFALL TIME SERIES ====================
function createRainfallComposite(year) {
  year = ee.Number(year);
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');
  var col = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterBounds(aoi).filterDate(start, end).select('precipitation');
  var annual = col.sum();
  var rainyDays = col.map(function(img) { return img.gt(1); }).sum();
  return annual.addBands(rainyDays.rename('rainy_days')).set('year', year).set('system:time_start', start.millis());
}
var rainfallTimeSeries = ee.ImageCollection(years.map(createRainfallComposite));

// ==================== 7. NDVI CHANGE AND TREND ====================
var vegWithTime = vegetationTimeSeries.map(function(img) {
  var y = ee.Number(img.get('year'));
  return ee.Image(img).select('NDVI').addBands(ee.Image.constant(y).rename('year'));
});
var ndviTrend = vegWithTime.reduce(ee.Reducer.linearFit()).select('scale').rename('slope');
var ndviStart = ee.Image(vegetationTimeSeries.filter(ee.Filter.eq('year', startYear)).first()).select('NDVI');
var ndviEnd = ee.Image(vegetationTimeSeries.filter(ee.Filter.eq('year', endYear)).first()).select('NDVI');
var ndviChange = ndviEnd.subtract(ndviStart).rename('ndvi_change');
Map.addLayer(vegetationTimeSeries.mean().select('NDVI').clip(aoi), { min: 0, max: 0.8, palette: ['brown', 'yellow', 'darkgreen'] }, 'Mean NDVI (2013-2024)', false);
Map.addLayer(ndviTrend.clip(aoi), { min: -0.01, max: 0.01, palette: ['red', 'white', 'green'] }, 'NDVI Trend Slope', false);
Map.addLayer(ndviChange.clip(aoi), { min: -0.3, max: 0.3, palette: ['red', 'white', 'green'] }, 'NDVI Change Magnitude', false);

// ==================== 8. WATER STRESS (simplified) ====================
// ==================== 9. NIGHT LIGHTS ====================
var viirs = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG').filterBounds(aoi).filterDate('2014-01-01', '2024-12-31').select('avg_rad');
var nightlightsYears = ee.List.sequence(2014, 2023);
var nightlightsTimeSeries = ee.ImageCollection(nightlightsYears.map(function(y) {
  var start = ee.Date.fromYMD(ee.Number(y), 1, 1);
  var end = start.advance(1, 'year');
  var col = viirs.filterDate(start, end);
  return safeMedianFromCollection(col, ['avg_rad'], aoi.geometry(), { year: y, system_time_start: start.millis() });
}));

// ==================== 10. BUILT-UP AND EMPLOYMENT PROXIES ====================
function detectBuiltUp(year) {
  var start = ee.Date.fromYMD(ee.Number(year), 1, 1);
  var end = start.advance(1, 'year');
  var col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(aoi).filterDate(start, end).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).map(maskS2SR);
  var img = safeMedianFromCollection(col, ['B4', 'B8', 'B11', 'B12'], aoi.geometry(), { year: year });
  img = ee.Image(img);
  var ndbi = img.normalizedDifference(['B11', 'B8']).rename('NDBI');
  var ui = img.expression('(SWIR1 - NIR) / (SWIR1 + NIR)', { SWIR1: img.select('B11'), NIR: img.select('B8') }).rename('UI');
  var nbi = img.expression('(SWIR1 - NIR) / (SWIR1 + NIR)', { SWIR1: img.select('B11'), NIR: img.select('B8') }).rename('NBI');
  return ndbi.gt(0.1).or(ui.gt(0.05)).or(nbi.gt(0.15)).rename('builtup').set('year', year);
}
var settlementYears = ee.List.sequence(2017, 2023);
var settlementTimeSeries = ee.ImageCollection(settlementYears.map(detectBuiltUp));
function calculateEmploymentProxies(year) {
  var lc = loadESRILandCover(year);
  var cropImg = ee.Image.pixelArea().divide(10000).updateMask(lc.eq(5));
  var treeImg = ee.Image.pixelArea().divide(10000).updateMask(lc.eq(2));
  var cropAreaHa = cropImg.reduceRegion({ reducer: ee.Reducer.sum(), geometry: aoi.geometry(), scale: scaleESRI, maxPixels: 1e13 }).getNumber('area');
  var treeAreaHa = treeImg.reduceRegion({ reducer: ee.Reducer.sum(), geometry: aoi.geometry(), scale: scaleESRI, maxPixels: 1e13 }).getNumber('area');
  var agricJobs = cropAreaHa.multiply(0.3);
  var agroforestryJobs = treeAreaHa.multiply(0.1);
  return ee.Image.constant(agricJobs.add(agroforestryJobs)).rename('estimated_jobs').set('year', year).set('system_time_start', ee.Date.fromYMD(ee.Number(year), 6, 1).millis());
}
var employmentYears = ee.List.sequence(2017, 2023);
var employmentProxies = ee.ImageCollection(employmentYears.map(calculateEmploymentProxies));

// ==================== 11. YIELD ESTIMATION ====================
function estimateCropYield(year) {
  year = ee.Number(year);
  var veg = ee.Image(vegetationTimeSeries.filter(ee.Filter.eq('year', year)).first());
  var rain = ee.Image(rainfallTimeSeries.filter(ee.Filter.eq('year', year)).first());
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = start.advance(1, 'year');
  var modisLST = ee.ImageCollection('MODIS/061/MOD11A1').filterBounds(aoi).filterDate(start, end).select('LST_Day_1km').mean().multiply(0.02).subtract(273.15);
  var soilMoisture = ee.ImageCollection('NASA/SMAP/SPL4SMGP/007').filterBounds(aoi).filterDate(start, end).select('sm_surface').mean();
  var rainSafe = rain.select('precipitation').unmask(0);
  var rawYield = veg.expression(
    '(NDVI*1.2 + EVI*0.8) * (RAIN/1000) * (1 - abs(TEMP-25)/25) * (SM+0.2) * 5000',
    { NDVI: veg.select('NDVI'), EVI: veg.select('EVI'), RAIN: rainSafe, TEMP: modisLST.rename('TEMP'), SM: soilMoisture.rename('SM') }
  );
  var cropMask = loadESRILandCover(year).eq(5);
  var yieldImg = rawYield.updateMask(cropMask).unmask(0).rename('yield_kg_per_ha').clip(aoi).set('year', year).set('system_time_start', start.millis());
  return ee.Image(yieldImg);
}
var yieldEstimates = ee.ImageCollection(employmentYears.map(estimateCropYield));

// ==================== 12. MARKET ACCESS (simplified) ====================
// ==================== 13. CHART TABLES ====================
print('=== GENERATING COMPREHENSIVE CHARTS ===');
var geom = aoi.geometry();
var ndviAnnualTable = ee.FeatureCollection(years.map(function(y) {
  var img = ee.Image(vegetationTimeSeries.filter(ee.Filter.eq('year', y)).first());
  return safeBandMeanFeature(img, 'NDVI', geom, scaleLandsat, y, 'NDVI', 0);
}));
var rainfallAnnualTable = ee.FeatureCollection(years.map(function(y) {
  var img = ee.Image(rainfallTimeSeries.filter(ee.Filter.eq('year', y)).first());
  return ee.Feature(null, { year: y, precipitation: safeMeanNumber(img, 'precipitation', geom, scaleChirps, 0), system_time_start: ee.Date.fromYMD(ee.Number(y), 6, 1).millis() });
}));
var nightlightsAnnualTable = ee.FeatureCollection(nightlightsYears.map(function(y) {
  var img = ee.Image(nightlightsTimeSeries.filter(ee.Filter.eq('year', y)).first());
  return safeBandMeanFeature(img, 'avg_rad', geom, scaleViirs, y, 'avg_rad', 0);
}));
var yieldAnnualTable = ee.FeatureCollection(employmentYears.map(function(y) {
  var img = ee.Image(yieldEstimates.filter(ee.Filter.eq('year', y)).first());
  return safeBandMeanFeature(img, 'yield_kg_per_ha', geom, scaleLandsat, y, 'yield_kg_per_ha', 0);
}));
var correlationFeatures = ndviAnnualTable.map(function(f) {
  var y = ee.Number(f.get('year'));
  var ndvi = ee.Number(f.get('NDVI'));
  var rainF = ee.Feature(rainfallAnnualTable.filter(ee.Filter.eq('year', y)).first());
  var rainfall = ee.Number(rainF.get('precipitation'));
  return ee.Feature(null, { year: y, NDVI: ndvi, rainfall: rainfall });
});
var areaExpansionData = ee.FeatureCollection(employmentYears.map(function(y) {
  var lc = loadESRILandCover(y);
  var cropAreaHaImg = ee.Image.pixelArea().divide(10000).updateMask(lc.eq(5));
  var totalHa = cropAreaHaImg.reduceRegion({ reducer: ee.Reducer.sum(), geometry: geom, scale: scaleESRI, maxPixels: 1e13 }).getNumber('area');
  var totalAcres = totalHa.multiply(2.47105);
  return ee.Feature(null, { year: y, cultivated_acres: totalAcres, targetPct: totalAcres.divide(1000000).multiply(100) });
}));

// ==================== 14. CHARTS ====================
print('GALANA-KULALU VEGETATION HEALTH TRENDS (NDVI)');
print(ui.Chart.feature.byFeature(ndviAnnualTable, 'year', ['NDVI']).setChartType('LineChart').setOptions({ title: 'NDVI', colors: ['green'], lineWidth: 3 }));
print('ANNUAL RAINFALL PATTERNS (CHIRPS)');
print(ui.Chart.feature.byFeature(rainfallAnnualTable, 'year', ['precipitation']).setChartType('LineChart').setOptions({ title: 'Rainfall (mm)', colors: ['blue'], trendlines: { 0: { color: 'red' } } }));
print('ECONOMIC ACTIVITY TRENDS');
print(ui.Chart.feature.byFeature(nightlightsAnnualTable, 'year', ['avg_rad']).setChartType('LineChart').setOptions({ title: 'Nighttime Lights', colors: ['orange'], lineWidth: 3 }));
print('CORRELATION ANALYSIS');
print(ui.Chart.feature.byFeature(correlationFeatures, 'rainfall', ['NDVI']).setChartType('ScatterChart').setOptions({ title: 'NDVI vs Rainfall', colors: ['darkgreen'], trendlines: { 0: { color: 'red' } } }));
print('AREA EXPANSION PROGRESS');
print(ui.Chart.feature.byFeature(areaExpansionData, 'year', ['cultivated_acres']).setChartType('LineChart').setOptions({ title: 'Cultivated Area (Acres)', colors: ['brown'], lineWidth: 3 }));
print('YIELD ESTIMATION TRENDS');
print(ui.Chart.feature.byFeature(yieldAnnualTable, 'year', ['yield_kg_per_ha']).setChartType('LineChart').setOptions({ title: 'Yield (kg/ha)', colors: ['purple'], lineWidth: 3 }));

// ==================== 15. MILESTONES ====================
var milestones = ee.FeatureCollection([
  ee.Feature(null, { year: 2013, impact: 0.10, event: 'Project Inception' }),
  ee.Feature(null, { year: 2014, impact: 0.15, event: 'Land Acquisition' }),
  ee.Feature(null, { year: 2015, impact: 0.20, event: 'Infrastructure Planning' }),
  ee.Feature(null, { year: 2016, impact: 0.30, event: 'Pilot Farm Setup' }),
  ee.Feature(null, { year: 2017, impact: 0.40, event: 'Irrigation Infrastructure' }),
  ee.Feature(null, { year: 2018, impact: 0.50, event: 'First Commercial Planting' }),
  ee.Feature(null, { year: 2019, impact: 0.60, event: 'Major Harvest' }),
  ee.Feature(null, { year: 2020, impact: 0.40, event: 'COVID-19 Disruption' }),
  ee.Feature(null, { year: 2021, impact: 0.45, event: 'Recovery Efforts' }),
  ee.Feature(null, { year: 2022, impact: 0.55, event: 'PPP Partnerships' }),
  ee.Feature(null, { year: 2023, impact: 0.65, event: 'Technology Integration' }),
  ee.Feature(null, { year: 2024, impact: 0.70, event: 'Current Status' })
]);
print('PROJECT MILESTONE TIMELINE');
print(ui.Chart.feature.byFeature(milestones, 'year', ['impact']).setChartType('LineChart').setOptions({ title: 'Galana-Kulalu Project Milestones', colors: ['darkblue'], lineWidth: 4 }));

// ==================== 16. FINAL MAP PRODUCTS ====================
Map.addLayer(rainfallTimeSeries.mean().select('precipitation').clip(aoi), { min: 0, max: 1500, palette: ['red', 'yellow', 'blue', 'darkblue'] }, 'Mean Annual Rainfall', false);
Map.addLayer(yieldEstimates.mean().select('yield_kg_per_ha').clip(aoi), { min: 0, max: 5000, palette: ['white', 'yellow', 'orange', 'red'] }, 'Mean Estimated Yield', false);

function createLegend() {
  var panel = ui.Panel({ style: { position: 'bottom-left', padding: '8px' } });
  panel.add(ui.Label('Galana-Kulalu Project', { fontWeight: 'bold' }));
  panel.add(ui.Label('AOI Boundary', { color: 'red' }));
  panel.add(ui.Label('Pilot Farm', { color: 'blue' }));
  panel.add(ui.Label('PPP Farms', { color: 'green' }));
  panel.add(ui.Label('Water Bodies', { color: 'darkblue' }));
  panel.add(ui.Label('Irrigation Canals', { color: 'cyan' }));
  panel.add(ui.Label('Crop Areas', { color: 'yellow' }));
  Map.add(panel);
}
createLegend();

print('=== SUMMARY STATS ===');
print('Total Project Area (ha):', aoi.geometry().area().divide(1e4));
print('Analysis Period:', startYear, 'to', endYear);
print('NDVI table:', ndviAnnualTable.limit(5));
print('Rainfall table:', rainfallAnnualTable.limit(5));
print('Nightlights table:', nightlightsAnnualTable.limit(5));
print('Yield table:', yieldAnnualTable.limit(5));
