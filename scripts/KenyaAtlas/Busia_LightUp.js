// Busia_LightUp
// VIIRS night lights per constituency (2019-2025) - Busia County, Kenya
// Imports: FC = FeatureCollection (e.g. projects/ee-gabrielsanya-kenya/assets/Busia with property ADM2_EN for constituency name)

var FC = ee.FeatureCollection('projects/ee-gabrielsanya-kenya/assets/Busia');
var NAME = 'ADM2_EN';
var SCALE = 500;
var ILLUM_THR = 0.5;
var startYear = 2019;
var endYear = 2025;

Map.centerObject(FC, 10);

var slopePalette = ['red', 'white', 'blue'];
var radVis = { min: 0, max: 40, palette: ['black', 'navy', 'blue', 'cyan', 'green', 'yellow', 'orange', 'red', 'white'] };

var viirs = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG').select('avg_rad');
var years = ee.List.sequence(startYear, endYear);
var annualIC = ee.ImageCollection(years.map(function(y) {
  var start = ee.Date.fromYMD(ee.Number(y), 1, 1);
  var end = start.advance(1, 'year');
  var med = viirs.filterDate(start, end).median();
  return med.rename('mean_rad').set('year', y);
}));

var img2025 = annualIC.filter(ee.Filter.eq('year', 2025)).first();
Map.addLayer(img2025.clip(FC), radVis, 'VIIRS 2025 Median');
Map.addLayer(img2025.gte(ILLUM_THR).selfMask().clip(FC), { palette: ['yellow'] }, 'VIIRS 2025 Masked >= 0.5');

var slope = annualIC.map(function(img) {
  var y = ee.Number(img.get('year'));
  return ee.Image(img).select('mean_rad').addBands(ee.Image.constant(y.subtract(startYear)).rename('t'));
}).reduce(ee.Reducer.linearFit()).select('scale');
Map.addLayer(slope.clip(FC), { min: -0.5, max: 0.5, palette: slopePalette }, 'Night lights trend (slope)');

function addLegend(title, palette) {
  var legend = ui.Panel({
    style: { position: 'bottom-left', padding: '8px' }
  });
  legend.add(ui.Label(title, { fontWeight: 'bold' }));
  legend.add(ui.Label('Decreasing brightness', { color: 'red' }));
  legend.add(ui.Label('Increasing brightness', { color: 'blue' }));
  legend.add(ui.Label('White ~ Stable or no change', { color: 'gray' }));
  Map.add(legend);
}
addLegend('Night lights trend (slope)', slopePalette);

var perYearPerADM2 = ee.FeatureCollection(years.map(function(y) {
  var img = annualIC.filter(ee.Filter.eq('year', y)).first();
  var stats = img.reduceRegions({
    collection: FC,
    reducer: ee.Reducer.mean(),
    scale: SCALE
  });
  return stats.map(function(f) {
    return f.set({
      year: y,
      constituency: f.get(NAME),
      mean_rad: f.get('mean')
    }).select(['year', 'constituency', 'mean_rad']);
  });
})).flatten();
print('Annual mean illumination per constituency (2019-2025)', perYearPerADM2.limit(50));

var slopeByADM2 = slope.reduceRegions({
  collection: FC,
  reducer: ee.Reducer.mean(),
  scale: SCALE
}).map(function(f) {
  return f.set({
    constituency: f.get(NAME),
    slope_mean: f.get('mean')
  }).select(['constituency', 'slope_mean']);
});

var T_HIGH = 0.10;
var T_LOW = 0.03;
var tiered = slopeByADM2.map(function(f) {
  var s = ee.Number(f.get('slope_mean'));
  var tier = ee.Number(ee.Algorithms.If(s.gte(T_HIGH), 2, ee.Algorithms.If(s.gte(T_LOW), 1, 0)));
  var label = ee.String(ee.Algorithms.If(tier.eq(2), 'High increase', ee.Algorithms.If(tier.eq(1), 'Moderate increase', 'Low or decline')));
  return f.set({ tier: tier, tier_label: label });
});
var ranked = tiered.sort('slope_mean', false);
print('Ranked improvement (most progressive first)', ranked);

var styled = FC.map(function(fc) {
  var match = ranked.filter(ee.Filter.eq('constituency', fc.get(NAME))).first();
  var tier = ee.Number(ee.Algorithms.If(match, match.get('tier'), 0));
  var fill = ee.String(ee.Algorithms.If(tier.eq(2), '#1a9850', ee.Algorithms.If(tier.eq(1), '#fee08b', '#bdbdbd')));
  return fc.set({ style: { color: '333333', width: 1, fillColor: fill } });
});
Map.addLayer(styled.style({ styleProperty: 'style' }), {}, 'Improvement tier (per constituency)', true);

var perYearT = perYearPerADM2.map(function(f) {
  return f.set('t', ee.Number(f.get('year')).subtract(startYear));
});
var consNames = FC.aggregate_array(NAME).distinct().sort();
var tsSlopes = ee.FeatureCollection(consNames.map(function(n) {
  var fc = perYearT.filter(ee.Filter.eq('constituency', n));
  var fitT = fc.reduceColumns(ee.Reducer.linearFit(), ['t', 'mean_rad']);
  var m = ee.Number(fitT.get('scale'));
  var label = ee.String(n).cat(' (m=').cat(m.format('%.3f')).cat(')');
  return ee.Feature(null, { constituency: n, ts_slope: m, series_label: label });
}));

var line = ui.Chart.feature.groups(perYearPerADM2, 'year', 'mean_rad', 'constituency')
  .setChartType('LineChart')
  .setOptions({
    title: 'Annual mean illumination by constituency (2019-2025)',
    hAxis: { title: 'Year' },
    vAxis: { title: 'Mean radiance' },
    lineWidth: 2,
    pointSize: 5
  });
print(line);

var barChart = ui.Chart.feature.byProperty(ranked, 'constituency', 'slope_mean')
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Trend slope by constituency (increase vs decline)',
    hAxis: { title: 'Constituency', slantedText: true },
    vAxis: { title: 'Slope' },
    colors: ['#1f78b4']
  });
print(barChart);

var baseline2019 = annualIC.filter(ee.Filter.eq('year', startYear)).first().reduceRegions({
  collection: FC,
  reducer: ee.Reducer.mean(),
  scale: SCALE
}).map(function(f) {
  return f.set({ constituency: f.get(NAME), baseline: f.get('mean') }).select(['constituency', 'baseline']);
});
var forScatter = slopeByADM2.map(function(f) {
  var match = baseline2019.filter(ee.Filter.eq('constituency', f.get('constituency'))).first();
  var b = ee.Number(ee.Algorithms.If(match, match.get('baseline'), 0));
  return f.set('baseline', b);
});
var scatter = ui.Chart.feature.byProperty(forScatter, 'baseline', 'slope_mean')
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Baseline brightness 2019 vs trend slope',
    hAxis: { title: 'Baseline 2019' },
    vAxis: { title: 'Slope' },
    pointSize: 5
  });
print(scatter);

var sparklines = ee.FeatureCollection(consNames.map(function(n) {
  var fc = perYearPerADM2.filter(ee.Filter.eq('constituency', n));
  var ch = ui.Chart.feature.groups(fc, 'year', 'mean_rad').setChartType('LineChart').setOptions({ title: n, legend: 'none' });
  return ee.Feature(null, { name: n, chart: ch });
}));
print('Constituency sparklines 2019-2025', sparklines);

var pairs = ee.List([[2020, 2019], [2021, 2020], [2022, 2021], [2023, 2022], [2024, 2023], [2025, 2024]]);
var yoyTable = ee.FeatureCollection(pairs.map(function(p) {
  var y2 = ee.Number(ee.List(p).get(0));
  var y1 = ee.Number(ee.List(p).get(1));
  var i2 = annualIC.filter(ee.Filter.eq('year', y2)).first();
  var i1 = annualIC.filter(ee.Filter.eq('year', y1)).first();
  var diffImg = ee.Image(i2).subtract(ee.Image(i1));
  var stats = diffImg.reduceRegions({ collection: FC, reducer: ee.Reducer.mean(), scale: SCALE });
  return stats.map(function(f) {
    return f.set({ year_from: y1, year_to: y2, constituency: f.get(NAME), delta: f.get('mean') });
  });
})).flatten();
print('Year to year mean change', yoyTable.limit(50));

function diff(y2, y1) {
  var i2 = annualIC.filter(ee.Filter.eq('year', y2)).first();
  var i1 = annualIC.filter(ee.Filter.eq('year', y1)).first();
  return ee.Image(i2).subtract(ee.Image(i1));
}
function byCons(img, propName) {
  return img.reduceRegions({ collection: FC, reducer: ee.Reducer.mean(), scale: SCALE })
    .map(function(f) { return f.set('constituency', f.get(NAME)).set(propName, f.get('mean')); });
}
var d_23_22 = byCons(diff(2023, 2022), 'd_23_22');
var d_24_23 = byCons(diff(2024, 2023), 'd_24_23');
var d_25_24 = byCons(diff(2025, 2024), 'd_25_24');
var slope2325 = perYearT.filter(ee.Filter.gte('year', 2023)).map(function(f) {
  return f.set('t2325', ee.Number(f.get('year')).subtract(2023));
});
var slopeByCons2325 = ee.FeatureCollection(consNames.map(function(n) {
  var fc = slope2325.filter(ee.Filter.eq('constituency', n));
  var fit = fc.reduceColumns(ee.Reducer.linearFit(), ['t2325', 'mean_rad']);
  var m = ee.Number(fit.get('scale'));
  return ee.Feature(null, { constituency: n, m_23_25: m });
}));

var filterConst = ee.Filter.equals({ leftField: 'constituency', rightField: 'constituency' });
var joinInner = ee.Join.inner('primary', 'secondary');
var withD23 = joinInner.apply(slopeByCons2325, d_23_22, filterConst);
var merged23 = ee.FeatureCollection(withD23.map(function(p) {
  var prim = ee.Feature(p.get('primary'));
  var sec = ee.Feature(p.get('secondary'));
  return prim.set('d_23_22', sec.get('d_23_22'));
}));
var withD24 = joinInner.apply(merged23, d_24_23, filterConst);
var merged24 = ee.FeatureCollection(withD24.map(function(p) {
  var prim = ee.Feature(p.get('primary'));
  var sec = ee.Feature(p.get('secondary'));
  return prim.set('d_24_23', sec.get('d_24_23'));
}));
var withD25 = joinInner.apply(merged24, d_25_24, filterConst);
var merged25 = ee.FeatureCollection(withD25.map(function(p) {
  var prim = ee.Feature(p.get('primary'));
  var sec = ee.Feature(p.get('secondary'));
  return prim.set('d_25_24', sec.get('d_25_24'));
}));
var T_UP = 0.05;
var T_FLAT = 0.02;
var T_DOWN = T_FLAT.multiply(-1);
function verdict(x) {
  return ee.String(ee.Algorithms.If(ee.Number(x).gte(T_UP), 'Increase',
    ee.Algorithms.If(ee.Number(x).lte(T_DOWN), 'Decrease', 'Stable')));
}
var gradTable = merged25.map(function(f) {
  var m = ee.Number(f.get('m_23_25'));
  var d25 = ee.Number(f.get('d_25_24'));
  var d24 = ee.Number(f.get('d_24_23'));
  var d23 = ee.Number(f.get('d_23_22'));
  return f.set({
    verdict_m: verdict(m),
    verdict_d25: verdict(d25),
    verdict_d24: verdict(d24),
    verdict_d23: verdict(d23)
  });
});
var gradTableChart = ui.Chart.feature.byFeature(gradTable, 'constituency', ['m_23_25', 'd_25_24', 'd_24_23', 'd_23_22'])
  .setChartType('ColumnChart')
  .setOptions({ title: 'Gradient values after 2022 (per constituency)', hAxis: { slantedText: true } });
print(gradTableChart);
print('Gradient table', gradTable);

var currentImg = annualIC.filter(ee.Filter.eq('year', 2025)).first();
var currentTable = currentImg.reduceRegions({ collection: FC, reducer: ee.Reducer.mean(), scale: SCALE })
  .map(function(f) { return f.set('constituency', f.get(NAME)).set('mean_rad', f.get('mean')); });
var total = currentTable.aggregate_sum('mean_rad');
var currentPct = currentTable.map(function(f) {
  return f.set('pct', ee.Number(f.get('mean_rad')).divide(total).multiply(100));
});
print('Current illumination share (%) by constituency', currentPct);

var illumMask = currentImg.gte(ILLUM_THR);
var nonIllumMask = currentImg.lt(ILLUM_THR);
var areaImg = ee.Image.pixelArea().divide(1e6);
var illumAreaImg = areaImg.updateMask(illumMask);
var nonIllumAreaImg = areaImg.updateMask(nonIllumMask);
var illumStats = illumAreaImg.reduceRegions({ collection: FC, reducer: ee.Reducer.sum(), scale: SCALE })
  .map(function(f) { return f.set('constituency', f.get(NAME)).set('illum_km2', f.get('sum')); });
var nonStats = nonIllumAreaImg.reduceRegions({ collection: FC, reducer: ee.Reducer.sum(), scale: SCALE })
  .map(function(f) { return f.set('constituency', f.get(NAME)).set('nonillum_km2', f.get('sum')); });

var joinIllum = ee.Join.inner('primary', 'secondary');
var combined = joinIllum.apply(illumStats, nonStats, filterConst);
var areaTable = ee.FeatureCollection(combined.map(function(pair) {
  var a = ee.Feature(pair.get('primary'));
  var b = ee.Feature(pair.get('secondary'));
  var illumKm2 = ee.Number(a.get('illum_km2'));
  var nonillumKm2 = ee.Number(b.get('nonillum_km2'));
  var totalKm2 = illumKm2.add(nonillumKm2);
  return ee.Feature(null, {
    constituency: a.get('constituency'),
    illum_km2: illumKm2,
    nonillum_km2: nonillumKm2,
    total_km2: totalKm2,
    illum_pct: illumKm2.divide(totalKm2).multiply(100),
    nonillum_pct: nonillumKm2.divide(totalKm2).multiply(100)
  });
}));
print('Illuminated vs non illuminated area per constituency 2025', areaTable);

var areaBarPct = ui.Chart.feature.byProperty(areaTable, 'constituency', ['illum_pct', 'nonillum_pct'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Area share illuminated vs non illuminated 2025 (threshold 0.5)',
    hAxis: { title: 'Constituency', slantedText: true },
    vAxis: { title: 'Percent' },
    colors: ['#1f78b4', '#bdbdbd']
  });
print(areaBarPct);
var areaBarKm2 = ui.Chart.feature.byProperty(areaTable, 'constituency', ['illum_km2', 'nonillum_km2'])
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Area illuminated vs non illuminated (km2) 2025',
    hAxis: { title: 'Constituency', slantedText: true },
    vAxis: { title: 'km2' },
    colors: ['#1f78b4', '#bdbdbd']
  });
print(areaBarKm2);

var outlineTop = FC.style({ color: '000000', width: 4, fillColor: '00000000' });
Map.addLayer(outlineTop, {}, 'Busia Outline (TOP)');
// Optional: add subcounty labels at centroids using users/gena/packages:text in GEE
