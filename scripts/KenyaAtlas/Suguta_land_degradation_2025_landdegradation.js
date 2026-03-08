// ENHANCED LAND DEGRADATION ANALYSIS WITH SOC INTEGRATION - FIXED VERSION
// Fixed AOI loading, Landsat NDVI by sensor, legend and visualization.
// Suguta AOI: projects/ee-gabrielsanya-kenya/assets/Suguta/Suguta_Map_aoi

var AOI_ASSET = 'projects/ee-gabrielsanya-kenya/assets/Suguta/Suguta_Map_aoi';
var aoiFc = ee.FeatureCollection(AOI_ASSET);
var aoi = aoiFc.geometry().dissolve();

var config = {
  baselineStart: '2000-01-01',
  baselineEnd: '2010-12-31',
  comparisonStart: '2015-01-01',
  comparisonEnd: '2024-12-31',
  cloudThreshold: 80,
  scale: 100,
  tileScale: 4,
  maxPixels: 1e13
};
var ndviTrendConfig = { startYear: 2000, endYear: 2024, minObservations: 5 };
var socConfig = {
  trendThresholds: {
    severeDecline: -0.30,
    moderateDecline: -0.15,
    slightDecline: -0.05,
    stableLow: 0.05,
    stableHigh: 0.15,
    slightIncrease: 0.25,
    moderateIncrease: 0.30
  }
};
var lcTransitionCodes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
var lcImpactValues = [-1, -0.5, 0, 0, 0.5, 0.5, 1, 1, 1];
var weights = { ndviTrend: 0.35, socTrend: 0.35, landCoverChange: 0.30 };

var paletteThemes = {
  productivity5Class: {
    colors: ['#d73027', '#fc8d59', '#ffffbf', '#91cf60', '#1a9850'],
    labels: ['Severe Decline', 'Moderate Decline', 'Stable', 'Moderate Improvement', 'Strong Improvement']
  },
  productivity3Class: {
    colors: ['#d73027', '#ffffbf', '#1a9850'],
    labels: ['Declining', 'Stable', 'Improving']
  },
  socSpectrum: {
    colors: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494', '#081d58'],
    labels: ['Very Low', 'Low', 'Moderate', 'Good', 'High', 'Very High', 'Exceptional']
  },
  ecosystemVitality: {
    colors: ['#a50026', '#d73027', '#fc8d59', '#ffffbf', '#d9ef8b', '#91cf60', '#1a9850'],
    labels: ['Severe Decline', 'Moderate Decline', 'Slight Decline', 'Stable', 'Slight Growth', 'Strong Growth', 'Exceptional Growth']
  },
  landTransformation: {
    colors: ['#d73027', '#ffffbf', '#1a9850'],
    labels: ['Degradation', 'No Change', 'Improvement']
  }
};

function loadEnhancedSOCData() {
  var soc = ee.Image('OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02');
  var soc0_5 = soc.select('b0').multiply(0.05);
  var soc5_15 = soc.select('b1').multiply(0.10);
  var soc15_30 = soc.select('b2').multiply(0.15);
  var soc_0_30cm = soc0_5.add(soc5_15).add(soc15_30).rename('soc_0_30cm');
  return soc_0_30cm.clip(aoi);
}

function maskCloudsLandsat(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1).eq(0).and(qa.bitwiseAnd(2).eq(0)).and(qa.bitwiseAnd(4).eq(0));
  return image.updateMask(mask).copyProperties(image, ['system:time_start']);
}
function maskCloudsSentinel(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).copyProperties(image, ['system:time_start']);
}
function addNDVI_L57(image) {
  return image.addBands(image.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI'));
}
function addNDVI_L89(image) {
  return image.addBands(image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI'));
}
function addNDVI_S2(image) {
  return image.addBands(image.normalizedDifference(['B8', 'B4']).rename('NDVI'));
}

function loadAndProcessImagery() {
  print('Loading imagery...');
  var l5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filterBounds(aoi).filter(ee.Filter.lt('CLOUD_COVER_LAND', config.cloudThreshold))
    .filterDate(config.baselineStart, config.comparisonEnd).map(maskCloudsLandsat).map(addNDVI_L57);
  var l7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
    .filterBounds(aoi).filter(ee.Filter.lt('CLOUD_COVER_LAND', config.cloudThreshold))
    .filterDate(config.baselineStart, config.comparisonEnd).map(maskCloudsLandsat).map(addNDVI_L57);
  var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(aoi).filter(ee.Filter.lt('CLOUD_COVER_LAND', config.cloudThreshold))
    .filterDate(config.baselineStart, config.comparisonEnd).map(maskCloudsLandsat).map(addNDVI_L89);
  var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
    .filterBounds(aoi).filter(ee.Filter.lt('CLOUD_COVER_LAND', config.cloudThreshold))
    .filterDate(config.baselineStart, config.comparisonEnd).map(maskCloudsLandsat).map(addNDVI_L89);
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', config.cloudThreshold))
    .filterDate(config.baselineStart, config.comparisonEnd).map(maskCloudsSentinel).map(addNDVI_S2);
  var combinedNDVI = l5.merge(l7).merge(l8).merge(l9).merge(s2)
    .filterDate(config.baselineStart, config.comparisonEnd).select('NDVI');
  return combinedNDVI;
}

function calculateSmoothNDVITrend(ndviCollection) {
  var years = ee.List.sequence(ndviTrendConfig.startYear, ndviTrendConfig.endYear);
  var annualImages = ee.ImageCollection(years.map(function(y) {
    var start = ee.Date.fromYMD(ee.Number(y), 1, 1);
    var end = start.advance(1, 'year');
    var med = ndviCollection.filterDate(start, end).median();
    return med.set('year', y).set('system:time_start', start.millis());
  }));
  var trend = annualImages.select('NDVI').reduce(ee.Reducer.linearFit()).select('scale').rename('ndvi_slope');
  var slope = trend;
  var ndvi_trend_7class = slope
    .where(slope.lt(-0.015), 1)
    .where(slope.gte(-0.015).and(slope.lt(-0.008)), 2)
    .where(slope.gte(-0.008).and(slope.lt(-0.002)), 3)
    .where(slope.gte(-0.002).and(slope.lte(0.002)), 4)
    .where(slope.gt(0.002).and(slope.lte(0.008)), 5)
    .where(slope.gt(0.008).and(slope.lte(0.015)), 6)
    .where(slope.gt(0.015), 7)
    .rename('ndvi_trend_7class');
  return ndvi_trend_7class.clip(aoi);
}

function reclassifyToUNCCD(image) {
  return image
    .where(image.eq(10), 1).where(image.eq(20), 1).where(image.eq(30), 2).where(image.eq(40), 2)
    .where(image.eq(50), 3).where(image.eq(60), 3).where(image.eq(70), 4).where(image.eq(80), 5)
    .where(image.eq(90), 6).where(image.eq(95), 7).where(image.eq(100), 8);
}
function calculateLandCoverChange() {
  var lc2020 = ee.Image('ESA/WorldCover/v100/2020').select('Map').clip(aoi);
  var lc2021 = ee.Image('ESA/WorldCover/v200/2021').select('Map').clip(aoi);
  var lc2020r = reclassifyToUNCCD(lc2020);
  var lc2025r = reclassifyToUNCCD(lc2021);
  var changeMatrix = lc2020r.multiply(10).add(lc2025r);
  var degradationCodes = [12, 13, 14, 15, 16, 17, 18, 21, 31, 41, 51, 61, 71];
  var improvementCodes = [87, 76, 65, 54, 43, 32, 78, 68, 58];
  var changeClassified = ee.Image(0);
  degradationCodes.forEach(function(c) { changeClassified = changeClassified.where(changeMatrix.eq(c), 1); });
  improvementCodes.forEach(function(c) { changeClassified = changeClassified.where(changeMatrix.eq(c), 2); });
  changeClassified = changeClassified.rename('land_cover_change').clip(aoi);
  return changeClassified;
}

function calculateEnhancedSOCTrend(socData, ndviCollection, landCoverChange) {
  var baselineSOC = socData;
  var ndviTrend = calculateSmoothNDVITrend(ndviCollection);
  var ndviSlope = ndviTrend.select('ndvi_trend_7class').subtract(4).divide(4);
  var socFromNDVI = ndviSlope.multiply(10).add(baselineSOC);
  var socFromLC = landCoverChange.multiply(5).add(baselineSOC);
  var combinedSOCTrend = socFromNDVI.multiply(0.6).add(socFromLC.multiply(0.4)).subtract(baselineSOC).divide(ee.Image(10));
  var t = socConfig.trendThresholds;
  var socTrendClassified = ee.Image(0)
    .where(combinedSOCTrend.lt(t.severeDecline), 1)
    .where(combinedSOCTrend.gte(t.severeDecline).and(combinedSOCTrend.lt(t.moderateDecline)), 2)
    .where(combinedSOCTrend.gte(t.moderateDecline).and(combinedSOCTrend.lt(t.slightDecline)), 3)
    .where(combinedSOCTrend.gte(t.slightDecline).and(combinedSOCTrend.lt(t.stableHigh)), 4)
    .where(combinedSOCTrend.gte(t.stableHigh).and(combinedSOCTrend.lt(t.slightIncrease)), 5)
    .where(combinedSOCTrend.gte(t.slightIncrease).and(combinedSOCTrend.lt(t.moderateIncrease)), 6)
    .where(combinedSOCTrend.gte(t.moderateIncrease), 7)
    .rename('soc_trend').clip(aoi);
  return socTrendClassified;
}

function calculateSOCState(socData, socTrend) {
  var baselineSOC = socData;
  var currentSOC = baselineSOC.add(socTrend.select('soc_trend').subtract(4).multiply(2)).rename('soc_current');
  var stats = currentSOC.reduceRegion({ reducer: ee.Reducer.percentile([10, 25, 75, 90]), geometry: aoi, scale: config.scale, maxPixels: config.maxPixels });
  var p10 = ee.Number(ee.Dictionary(stats).get('soc_current_p10'));
  var p25 = ee.Number(ee.Dictionary(stats).get('soc_current_p25'));
  var p75 = ee.Number(ee.Dictionary(stats).get('soc_current_p75'));
  var p90 = ee.Number(ee.Dictionary(stats).get('soc_current_p90'));
  var socStateClassified = ee.Image(0)
    .where(currentSOC.lt(p10), 1)
    .where(currentSOC.gte(p10).and(currentSOC.lt(p25)), 2)
    .where(currentSOC.gte(p25).and(currentSOC.lt(p75)), 3)
    .where(currentSOC.gte(p75).and(currentSOC.lt(p90)), 4)
    .where(currentSOC.gte(p90), 5)
    .rename('soc_state').clip(aoi);
  return socStateClassified;
}

function calculateEnhancedProductivity(ndviTrend, socTrend, landCoverChange, socState) {
  var ndviNorm = ndviTrend.select('ndvi_trend_7class').subtract(1).divide(6);
  var socNorm = socTrend.select('soc_trend').subtract(1).divide(6);
  var lcNorm = landCoverChange.add(1).divide(2);
  var productivityIndex = ndviNorm.multiply(weights.ndviTrend)
    .add(socNorm.multiply(weights.socTrend))
    .add(lcNorm.multiply(weights.landCoverChange));
  var productivity5Class = productivityIndex
    .where(productivityIndex.lt(0.2), 1)
    .where(productivityIndex.gte(0.2).and(productivityIndex.lt(0.4)), 2)
    .where(productivityIndex.gte(0.4).and(productivityIndex.lt(0.6)), 3)
    .where(productivityIndex.gte(0.6).and(productivityIndex.lt(0.8)), 4)
    .where(productivityIndex.gte(0.8), 5)
    .rename('productivity_5class').clip(aoi);
  var productivity3Class = productivityIndex
    .where(productivityIndex.lt(0.4), 1)
    .where(productivityIndex.gte(0.4).and(productivityIndex.lt(0.6)), 2)
    .where(productivityIndex.gte(0.6), 3)
    .rename('productivity_3class').clip(aoi);
  var riskAssessment = ee.Image(1)
    .where(socState.lte(2).and(ndviNorm.lt(0.3)), 5)
    .where(socState.lte(3).and(ndviNorm.lt(0.5)), 3)
    .rename('risk').clip(aoi);
  return { productivity5Class: productivity5Class, productivity3Class: productivity3Class, productivityIndex: productivityIndex, riskAssessment: riskAssessment };
}

function processEnhancedLandDegradation() {
  var ndviCol = loadAndProcessImagery();
  var socData = loadEnhancedSOCData();
  var ndviTrend = calculateSmoothNDVITrend(ndviCol);
  var landCoverChange = calculateLandCoverChange();
  var socTrend = calculateEnhancedSOCTrend(socData, ndviCol, landCoverChange);
  var socState = calculateSOCState(socData, socTrend);
  var productivity = calculateEnhancedProductivity(ndviTrend, socTrend, landCoverChange, socState);
  return {
    ndviTrend: ndviTrend,
    socTrend: socTrend,
    socState: socState,
    landCoverChange: landCoverChange,
    socData: socData,
    productivity5Class: productivity.productivity5Class,
    productivity3Class: productivity.productivity3Class,
    productivityIndex: productivity.productivityIndex,
    riskAssessment: productivity.riskAssessment
  };
}

function addLegend(title, colors, labels) {
  var panel = ui.Panel({ style: { position: 'top-right', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.95)' } });
  panel.add(ui.Label(title, { fontWeight: 'bold', fontSize: '13px' }));
  for (var i = 0; i < colors.length; i++) {
    var row = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '2px 0' } });
    row.add(ui.Label(' ', { width: '16px', height: '12px', backgroundColor: colors[i] }));
    row.add(ui.Label(labels[i], { fontSize: '12px' }));
    panel.add(row);
  }
  Map.add(panel);
}

function addLayersToMap(results) {
  Map.clear();
  Map.setOptions('HYBRID');
  Map.centerObject(aoi, 8);
  var boundary = ee.Image().byte().paint({ featureCollection: aoiFc, color: 1, width: 2 });
  Map.addLayer(boundary, { palette: ['FFFFFF'] }, 'Boundary', true);
  Map.addLayer(results.productivity5Class, { min: 1, max: 5, palette: paletteThemes.productivity5Class.colors }, 'Enhanced Productivity 5-Class', false);
  Map.addLayer(results.productivity3Class, { min: 1, max: 3, palette: paletteThemes.productivity3Class.colors }, 'Enhanced Productivity 3-Class', false);
  Map.addLayer(results.socData, { min: 5, max: 50, palette: paletteThemes.socSpectrum.colors }, 'SOC Baseline', false);
  Map.addLayer(results.socTrend, { min: 1, max: 7, palette: paletteThemes.ecosystemVitality.colors }, 'SOC Trend 7-Class', false);
  Map.addLayer(results.socState, { min: 1, max: 5, palette: paletteThemes.productivity5Class.colors }, 'SOC State 5-Class', false);
  Map.addLayer(results.ndviTrend, { min: 1, max: 7, palette: paletteThemes.ecosystemVitality.colors }, 'NDVI Trend 7-Class', false);
  Map.addLayer(results.landCoverChange, { min: 0, max: 2, palette: paletteThemes.landTransformation.colors }, 'Land Cover Change', false);
  addLegend('Enhanced Productivity', paletteThemes.productivity5Class.colors, paletteThemes.productivity5Class.labels);
}

function calculateAreaStats(image, classValues, labels, title, bandName) {
  bandName = bandName || 'productivity_5class';
  print('Area statistics for: ' + title);
  var areaImg = ee.Image.pixelArea().divide(1e6).addBands(ee.Image(image).select(bandName).toByte().rename('class'));
  classValues.forEach(function(cls) {
    var area = areaImg.updateMask(areaImg.select('class').eq(cls)).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: config.scale,
      maxPixels: config.maxPixels
    });
    var val = ee.Number(ee.Dictionary(area).get('area'));
    var idx = classValues.indexOf(cls);
    var label = idx >= 0 ? labels[idx] : 'Class ' + cls;
    print(label + ': ' + val + ' km²');
  });
}

var results = processEnhancedLandDegradation();
addLayersToMap(results);
calculateAreaStats(results.productivity5Class, [1, 2, 3, 4, 5], paletteThemes.productivity5Class.labels, 'Enhanced Productivity 5-Class', 'productivity_5class');
calculateAreaStats(results.productivity3Class, [1, 2, 3], paletteThemes.productivity3Class.labels, 'Enhanced Productivity 3-Class', 'productivity_3class');
print('Analysis completed successfully.');
