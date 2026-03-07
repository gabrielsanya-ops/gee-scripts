// Busia_Economic SocioEconomicgrowth
// BUSIA COUNTY DECISION-MAKER DASHBOARD - GOOGLE EARTH ENGINE ANALYSIS (FINAL VERSION)
// Imports: BUSIA (Table projects/ee-gabrielsanya-kenya/assets/Busia)
// Fixed: band selection, reducer group, chart xLabels, currentStats.get, nightLights5Year, legends, 5-year trend to 2024, robust error handling.

// ------------ 1) ADMIN BOUNDARIES ------------
var BUSIA_GEOM = BUSIA.geometry();
var BUSIA_CENTER = BUSIA_GEOM.centroid();
var BUDALANGI = BUSIA_CENTER.buffer(15000); // 15km buffer
Map.centerObject(BUSIA_GEOM, 10);

// ------------ 2) YEAR SETUP ------------
var START_YEAR = 2017;
var END_YEAR = 2024;
var LAST_5_YEARS = [2020, 2021, 2022, 2023, 2024];
print('Analysis Period:', START_YEAR, 'to', END_YEAR);
print('Last 5 Years for Night-lights:', LAST_5_YEARS);

// ------------ 3) CORE DATASETS ------------
var DYNAMIC_WORLD = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1');
var WATER_OCC = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence');
var WATER_CHANGE = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('change_abs');
var CHIRPS = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY');
var VIIRS = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG');
var VIIRS_MONTHLY = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG');
var DEM = ee.Image('USGS/SRTMGL1_003');
var S2 = ee.ImageCollection('COPERNICUS/S2_SR');

// ------------ 4) DYNAMIC WORLD CLASSES & PALETTE ------------
var DW_CLASSES = [
  { code: 0, name: 'Water', color: '#419BDF' },
  { code: 1, name: 'Trees', color: '#397D49' },
  { code: 2, name: 'Grass', color: '#7A87C6' },
  { code: 3, name: 'Flooded Vegetation', color: '#588627' },
  { code: 4, name: 'Crops', color: '#DFC35A' },
  { code: 5, name: 'Shrub and Scrub', color: '#C4281B' },
  { code: 6, name: 'Built', color: '#A59B8F' },
  { code: 7, name: 'Bare Ground', color: '#E49635' },
  { code: 8, name: 'Snow and Ice', color: '#B39FE1' }
];
function getDWPalette() {
  return DW_CLASSES.map(function(c) { return c.color; });
}

// ------------ 5) SAFE HELPER FUNCTIONS ------------
function safeGetFirst(collection) {
  return ee.Algorithms.If(collection.size().gt(0), collection.first(), ee.Image.constant(0));
}
function safeGetLast(collection) {
  return ee.Algorithms.If(collection.size().gt(0),
    collection.sort('system:time_start', false).first(),
    ee.Image.constant(0));
}
function safeGetMedian(collection) {
  return ee.Algorithms.If(collection.size().gt(0), collection.median(), ee.Image.constant(0));
}
function safeClip(image, geometry) {
  return ee.Algorithms.If(ee.Algorithms.IsEqual(image, null),
    ee.Image.constant(0).clip(geometry),
    ee.Image(image).clip(geometry));
}
function safeSelect(image, bands) {
  return ee.Algorithms.If(ee.Algorithms.IsEqual(image, null),
    ee.Image.constant(0),
    ee.Image(image).select(bands));
}
function safeLinearTrend(collection, bandName, startDate, unit) {
  var count = collection.size();
  var scaled = collection.map(function(img) {
    var t = ee.Date(img.get('system:time_start')).difference(ee.Date(startDate), unit);
    return ee.Image(img).select(bandName).addBands(ee.Image.constant(t).rename('t'));
  });
  var fit = ee.Algorithms.If(count.gt(1),
    scaled.reduce(ee.Reducer.linearFit()),
    ee.Image.cat([ee.Image.constant(0).rename('scale'), ee.Image.constant(0).rename('offset')]));
  return ee.Image(fit);
}

// ------------ 6) ANALYSIS: DYNAMIC WORLD LAND COVER ------------
function dwLandCoverAnalysis(year, geom) {
  var yearStart = ee.Date.fromYMD(year, 1, 1);
  var yearEnd = yearStart.advance(1, 'year');
  var dwYear = DYNAMIC_WORLD.filterDate(yearStart, yearEnd).filterBounds(geom).select('label');
  var dwSize = dwYear.size();
  var dwImg = safeGetMedian(dwYear);
  var area = ee.Image.pixelArea().divide(10000);
  var combined = area.addBands(ee.Image(dwImg).rename('class'));
  var stats = combined.reduceRegion({
    reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'class' }),
    geometry: geom,
    scale: 10,
    maxPixels: 1e9
  });
  return { image: ee.Image(dwImg), stats: stats.get('groups'), size: dwSize };
}

// ------------ 7) NIGHT-LIGHTS ANALYSIS (to 2024) ------------
function nightLightsAnalysis(startYear, endYear, geom) {
  var start = ee.Date.fromYMD(startYear, 1, 1);
  var end = ee.Date.fromYMD(endYear, 12, 31);
  var nlAnnual = VIIRS.filterDate(start, end).filterBounds(geom).select('avg_rad');
  var nlMonthly = VIIRS_MONTHLY.filterDate(start, end).filterBounds(geom)
    .map(function(img) { return img.select('avg_rad').rename('average_masked'); });
  var nl = nlAnnual.merge(nlMonthly);
  var nlSize = nl.size();
  var trend = safeLinearTrend(nl, nlAnnual.first().bandNames().get(0), start, 'year');
  var meanImg = ee.Algorithms.If(nlSize.gt(0),
    nl.mean().updateMask(nl.mean().gt(0)),
    ee.Image.constant(0));
  var stats = ee.Image(meanImg).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geom,
    scale: 1000,
    maxPixels: 1e9
  });
  return { trend: trend, mean: ee.Image(meanImg), stats: stats, size: nlSize, collection: nl };
}

// ------------ 8) 5-YEAR NIGHT-LIGHTS TREND ------------
function nightLights5YearAnalysis(geom) {
  var results = {};
  for (var i = 0; i < LAST_5_YEARS.length; i++) {
    var year = LAST_5_YEARS[i];
    var yearStart = ee.Date.fromYMD(year, 1, 1);
    var yearEnd = ee.Date.fromYMD(year, 12, 31);
    var nlAnnual = VIIRS.filterDate(yearStart, yearEnd).filterBounds(geom).select('avg_rad');
    var nlMonthly = VIIRS_MONTHLY.filterDate(yearStart, yearEnd).filterBounds(geom)
      .map(function(img) { return img.select('avg_rad').rename('average_masked'); });
    var nlYear = nlAnnual.merge(nlMonthly);
    var nlSize = nlYear.size();
    var hasData = nlSize.gt(0);
    var nlImg = ee.Algorithms.If(hasData,
      nlYear.mean().updateMask(nlYear.mean().gt(0)),
      ee.Image.constant(0).updateMask(0));
    results[year] = { image: ee.Image(nlImg), nlSize: nlSize, hasData: hasData };
  }
  return results;
}

// ------------ 9) CROPLAND (DW class 4) ------------
function croplandAnalysis(year, geom) {
  var dw = dwLandCoverAnalysis(year, geom);
  var cropMask = ee.Image(dw.image).eq(4);
  var areaHa = ee.Image.pixelArea().divide(10000).updateMask(cropMask).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geom,
    scale: 10,
    maxPixels: 1e9
  });
  return { mask: cropMask, area: areaHa.get('area'), image: dw.image };
}

// ------------ 10) NDVI ANALYSIS ------------
function ndviAnalysis(startYear, endYear, geom) {
  var start = ee.Date.fromYMD(startYear, 1, 1);
  var end = ee.Date.fromYMD(endYear, 12, 31);
  var s2 = S2.filterDate(start, end).filterBounds(geom).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
  var s2Size = s2.size();
  var addNDVI = function(img) {
    return ee.Image(img).normalizedDifference(['B8', 'B4']).rename('NDVI').copyProperties(img, ['system:time_start']);
  };
  var ndviCollection = s2.map(addNDVI);
  var years = ee.List.sequence(startYear, endYear);
  var annualCollection = ee.ImageCollection(years.map(function(y) {
    var ys = ee.Date.fromYMD(ee.Number(y), 1, 1);
    var ye = ys.advance(1, 'year');
    var yFiltered = ndviCollection.filterDate(ys, ye);
    var med = safeGetMedian(yFiltered);
    return ee.Image(med).rename('NDVI').set('system:time_start', ys.millis());
  }));
  var trend = safeLinearTrend(annualCollection, 'NDVI', start, 'year');
  var meanImg = safeGetMedian(annualCollection);
  return { annualCollection: annualCollection, collection: annualCollection, trend: trend, mean: meanImg, s2Size: s2Size };
}

// ------------ 11) WATER DYNAMICS ------------
function waterDynamics(geom) {
  var occ = WATER_OCC.clip(geom);
  var chg = WATER_CHANGE.clip(geom);
  var occStats = occ.reduceRegion({
    reducer: ee.Reducer.percentile([10, 25, 50, 75, 90]),
    geometry: geom,
    scale: 30,
    maxPixels: 1e9
  });
  var chgStats = chg.reduceRegion({
    reducer: ee.Reducer.percentile([10, 25, 50, 75, 90]),
    geometry: geom,
    scale: 30,
    maxPixels: 1e9
  });
  return { occurrence: occ, change: chg, occurrenceStats: occStats, changeStats: chgStats };
}

// ------------ 12) RAINFALL ANALYSIS ------------
function rainfallAnalysis(startYear, endYear, geom) {
  var start = ee.Date.fromYMD(startYear, 1, 1);
  var end = ee.Date.fromYMD(endYear, 12, 31);
  var daily = CHIRPS.filterDate(start, end).filterBounds(geom);
  var chirpsSize = daily.size();
  var years = ee.List.sequence(startYear, endYear);
  var annualList = years.map(function(y) {
    var ys = ee.Date.fromYMD(ee.Number(y), 1, 1);
    var ye = ys.advance(1, 'year');
    var yearData = daily.filterDate(ys, ye).sum();
    return yearData.set('system:time_start', ys.millis()).set('year', y);
  });
  var annualCollection = ee.ImageCollection(annualList);
  var climatology = annualCollection.mean();
  var anomalies = annualCollection.map(function(img) {
    return img.subtract(climatology).set('system:time_start', img.get('system:time_start'));
  });
  var trend = safeLinearTrend(annualCollection.map(function(img) {
    return img.rename('precipitation').addBands(ee.Image.constant(ee.Number(img.get('year')).subtract(startYear)).rename('t'));
  }), 'precipitation', ee.Date.fromYMD(startYear, 1, 1), 'year');
  return { annual: annualCollection, climatology: climatology, anomalies: anomalies, trend: trend, chirpsSize: chirpsSize };
}

// ------------ 13) FLOOD EXPOSURE ------------
function floodExposure(geom) {
  var low = DEM.lt(115);
  var near = WATER_OCC.gt(50).focal_max(2);
  var exposure = low.and(near);
  var areaHa = exposure.multiply(ee.Image.pixelArea().divide(10000)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geom,
    scale: 30,
    maxPixels: 1e9
  });
  return { exposure: exposure, lowElevation: low, nearWater: near, stats: areaHa };
}

// ------------ 14) MAIN PIPELINE ------------
function runAnalysis() {
  var currentYear = END_YEAR;
  var baselineYear = START_YEAR;
  var lcCurrent = dwLandCoverAnalysis(currentYear, BUSIA_GEOM);
  var lcBaseline = dwLandCoverAnalysis(baselineYear, BUSIA_GEOM);
  var nl = nightLightsAnalysis(START_YEAR, END_YEAR, BUSIA_GEOM);
  var crop = croplandAnalysis(currentYear, BUSIA_GEOM);
  var ndvi = ndviAnalysis(START_YEAR, END_YEAR, BUSIA_GEOM);
  var water = waterDynamics(BUSIA_GEOM);
  var rain = rainfallAnalysis(START_YEAR, END_YEAR, BUSIA_GEOM);
  var flood = floodExposure(BUDALANGI);
  var nl5Year = nightLights5YearAnalysis(BUSIA_GEOM);
  return {
    landCover: { current: lcCurrent, baseline: lcBaseline },
    economic: { nightLights: nl, cropland: crop },
    environment: { ndvi: ndvi, water: water, rainfall: rain },
    floodRisk: flood,
    nightLights5Year: nl5Year
  };
}

// ------------ 15) MAP LAYERS ------------
function addMapLayers(result) {
  var dwImg = result.landCover.current.image;
  Map.addLayer(ee.Image(dwImg).clip(BUSIA_GEOM), { min: 0, max: 8, palette: getDWPalette() }, 'Dynamic World Land Cover ' + END_YEAR);
  var nlTrend = ee.Image(result.economic.nightLights.trend).select(['scale']);
  var nlMasked = nlTrend.updateMask(nlTrend.neq(0));
  Map.addLayer(nlMasked.clip(BUSIA_GEOM), { min: -0.1, max: 0.1, palette: ['red', 'white', 'green'] }, 'Night-lights Trend (Masked)');
  for (var i = 0; i < LAST_5_YEARS.length; i++) {
    var yr = LAST_5_YEARS[i];
    var nlYearData = result.nightLights5Year[yr];
    if (nlYearData && nlYearData.image) {
      Map.addLayer(ee.Image(nlYearData.image).clip(BUSIA_GEOM), { min: 0, max: 1, palette: ['black', 'yellow', 'white'] }, 'Night-lights ' + yr + (nlYearData.hasData ? '' : ' (No Data)'));
    }
  }
  var ndviTrend = ee.Image(result.environment.ndvi.trend).select(['scale']);
  Map.addLayer(ndviTrend.clip(BUSIA_GEOM), { min: -0.01, max: 0.01, palette: ['red', 'white', 'green'] }, 'NDVI Trend');
  Map.addLayer(result.environment.water.occurrence.clip(BUSIA_GEOM), { min: 0, max: 100, palette: ['white', 'blue'] }, 'Water Occurrence (%)');
  Map.addLayer(result.floodRisk.exposure.clip(BUDALANGI), { palette: ['ffffffee', 'ffeeee'] }, 'Flood Exposure Risk');
  var rainTrend = ee.Image(result.environment.rainfall.trend).select(['scale']);
  Map.addLayer(rainTrend.clip(BUSIA_GEOM), { min: -10, max: 10, palette: ['red', 'white', 'blue'] }, 'Rainfall Trend (mm/yr)');
}

// ------------ 16) CHARTS ------------
function createLandCoverChart(result) {
  var currentImg = result.landCover.current.image;
  var baselineImg = result.landCover.baseline.image;
  var combined = ee.Image.cat([ee.Image(currentImg).rename('current'), ee.Image(baselineImg).rename('baseline')]);
  var chart = ui.Chart.image.byClass({
    image: combined,
    classBand: 'current',
    region: BUSIA_GEOM,
    scale: 100,
    reducer: ee.Reducer.sum()
  });
  chart.setOptions({ title: 'Dynamic World Land Cover Comparison', curveType: 'function', lineWidth: 3, pointSize: 5 });
  print(chart);
}
function createNDVIChart(result) {
  var chart = ui.Chart.image.series({
    imageCollection: result.environment.ndvi.collection,
    region: BUSIA_GEOM,
    reducer: ee.Reducer.mean(),
    scale: 100
  });
  chart.setOptions({ title: 'NDVI Annual Trend', curveType: 'function', lineWidth: 3, pointSize: 5, colors: ['#2ca02c'] });
  print(chart);
}
function createRainfallChart(result) {
  var chart = ui.Chart.image.series({
    imageCollection: result.environment.rainfall.annual,
    region: BUSIA_GEOM,
    reducer: ee.Reducer.mean(),
    scale: 5000
  });
  chart.setOptions({ title: 'Annual Rainfall', curveType: 'function', lineWidth: 3, pointSize: 5, colors: ['#3b82f6'] });
  print(chart);
}
function createNightLightsChart(result) {
  var chart = ui.Chart.image.series({
    imageCollection: result.economic.nightLights.collection,
    region: BUSIA_GEOM,
    reducer: ee.Reducer.mean(),
    scale: 1000
  });
  chart.setOptions({ title: 'Night-lights Time Series - Extended to 2024', curveType: 'function', lineWidth: 3, pointSize: 5 });
  print(chart);
}
function create5YearNightLightsChart(result) {
  var features = ee.FeatureCollection(LAST_5_YEARS.map(function(yr) {
    var data = result.nightLights5Year[yr];
    var val = (data && data.hasData) ? ee.Image(data.image).reduceRegion(ee.Reducer.mean(), BUSIA_GEOM, 1000, 1e9).get('avg_rad') : 0;
    return ee.Feature(null, { year: yr, value: ee.Number(val), hasData: data && data.hasData });
  }));
  var chart = ui.Chart.feature.groups(features, 'year', 'value').setChartType('LineChart');
  chart.setOptions({ title: '5-Year Night-lights Comparison - Extended to 2024', curveType: 'function', lineWidth: 3, pointSize: 5 });
  print(chart);
}
function createWaterOccurrenceChart(result) {
  var p = result.environment.water.occurrence.reduceRegion(ee.Reducer.percentile([10, 25, 50, 75, 90]), BUSIA_GEOM, 30, 1e9);
  var chart = ui.Chart.array.values(ee.Array([p.get('occurrence_p10'), p.get('occurrence_p25'), p.get('occurrence_p50'), p.get('occurrence_p75'), p.get('occurrence_p90')]), 0, ['10th', '25th', '50th', '75th', '90th']);
  chart.setOptions({ title: 'Water Occurrence Percentiles', curveType: 'function', lineWidth: 3, pointSize: 5, colors: ['#3b82f6'] });
  print(chart);
}

// ------------ 17) UI & STARTUP ------------
function buildUI() {
  var panel = ui.Panel({ style: { width: '350px', padding: '10px' } });
  panel.add(ui.Label('Busia County Decision Dashboard', { style: { fontWeight: 'bold', fontSize: '18px' } }));
  panel.add(ui.Label('Analysis Period: ' + START_YEAR + ' to ' + END_YEAR, { style: { fontSize: '14px', color: '#666' } }));
  panel.add(ui.Label('Vision 2030 NEMA SOE Extended to 2024', { style: { fontSize: '12px', color: '#888' } }));
  panel.add(ui.Button('Run Complete Analysis', function() {
    var result = runAnalysis();
    addMapLayers(result);
    print(createLandCoverChart(result)); print(createNDVIChart(result)); print(createRainfallChart(result));
    print(createNightLightsChart(result)); print(create5YearNightLightsChart(result)); print(createWaterOccurrenceChart(result));
    print('Analysis Complete - Extended to 2024!');
  }));
  panel.add(ui.Button('Generate All Charts', function() {
    var result = runAnalysis();
    print(createLandCoverChart(result)); print(createNDVIChart(result)); print(createRainfallChart(result));
    print(createNightLightsChart(result)); print(create5YearNightLightsChart(result)); print(createWaterOccurrenceChart(result));
  }));
  panel.add(ui.Button('Add Map Layers Only', function() {
    addMapLayers(runAnalysis());
  }));
  panel.add(ui.Button('Show 5-Year Night-lights Only', function() {
    var result = runAnalysis();
    Map.clear();
    for (var i = 0; i < LAST_5_YEARS.length; i++) {
      var yr = LAST_5_YEARS[i];
      var nlYearData = result.nightLights5Year[yr];
      if (nlYearData && nlYearData.image) {
        Map.addLayer(ee.Image(nlYearData.image).clip(BUSIA_GEOM), { min: 0, max: 1, palette: ['black', 'yellow', 'white'] }, 'Night-lights ' + yr + (nlYearData.hasData ? '' : ' (No Data)'));
      }
    }
  }));
  ui.root.insert(0, panel);
}

buildUI();
var initialResult = runAnalysis();
addMapLayers(initialResult);
print(createLandCoverChart(initialResult));
print(createNDVIChart(initialResult));
print(createRainfallChart(initialResult));
print(createNightLightsChart(initialResult));
print(create5YearNightLightsChart(initialResult));
print(createWaterOccurrenceChart(initialResult));
print('Busia County Dashboard Ready - Extended to 2024!');
