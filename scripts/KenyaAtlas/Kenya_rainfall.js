// Kenya annual rainfall by county (CHIRPS)
// Asset: projects/ee-gabrielsanya-kenya/assets/KeCounty

var countries = ee.FeatureCollection('projects/ee-gabrielsanya-kenya/assets/KeCounty');
var year = 2026; // Change this to your desired year

var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate(year + '-01-01', year + '-12-31')
  .select('precipitation');

var annualRainfall = chirps.sum();
var clippedRainfall = annualRainfall.clip(countries);

var rainfallByCounty = clippedRainfall.reduceRegions({
  collection: countries,
  reducer: ee.Reducer.mean(),
  scale: 5000
});

var meanRainfall = ee.Number(rainfallByCounty.aggregate_mean('mean'));
var meanArray = rainfallByCounty.aggregate_array('mean');
var stdDevRainfall = ee.Number(ee.Array(meanArray).reduce(ee.Reducer.stdDev(), [0]).get([0]));

print('Mean Rainfall:', meanRainfall);
print('Standard Deviation:', stdDevRainfall);
print('Annual Rainfall by County', rainfallByCounty);

var styledCounties = rainfallByCounty.map(function(feature) {
  var mean = ee.Number(feature.get('mean')).or(0);
  var fillColor = ee.Algorithms.If(
    mean.lt(meanRainfall.subtract(stdDevRainfall)),
    '#B3E5FC',
    ee.Algorithms.If(
      mean.lt(meanRainfall),
      '#6485F6',
      ee.Algorithms.If(
        mean.lt(meanRainfall.add(stdDevRainfall)),
        '#197602',
        '#0047A1'
      )
    )
  );
  return feature.set('style', {
    stroke: 'black',
    width: 1,
    fill: fillColor,
    fillOpacity: 0.7
  });
});

Map.centerObject(countries, 6);
Map.addLayer(styledCounties.style({ styleProperty: 'style' }), {}, 'Rainfall by County');

Export.table.toDrive({
  collection: rainfallByCounty,
  description: 'Kenya_Annual_Rainfall_' + year,
  fileFormat: 'CSV'
});

var legend = ui.Panel({
  style: { position: 'bottom-right', padding: '8px 15px', backgroundColor: 'white' }
});
legend.add(ui.Label('Rainfall (mm)', { fontWeight: 'bold', fontSize: '14px' }));
var row1 = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '4px 0' } });
row1.add(ui.Label(' ', { width: '20px', height: '14px', backgroundColor: '#B3E5FC' }));
row1.add(ui.Label('< Mean - 1\u03C3', { fontSize: '12px' }));
legend.add(row1);
var row2 = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '4px 0' } });
row2.add(ui.Label(' ', { width: '20px', height: '14px', backgroundColor: '#6485F6' }));
row2.add(ui.Label('Mean - 1\u03C3 to Mean', { fontSize: '12px' }));
legend.add(row2);
var row3 = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '4px 0' } });
row3.add(ui.Label(' ', { width: '20px', height: '14px', backgroundColor: '#197602' }));
row3.add(ui.Label('Mean to Mean + 1\u03C3', { fontSize: '12px' }));
legend.add(row3);
var row4 = ui.Panel({ layout: ui.Panel.Layout.Flow('horizontal'), style: { margin: '4px 0' } });
row4.add(ui.Label(' ', { width: '20px', height: '14px', backgroundColor: '#0047A1' }));
row4.add(ui.Label('> Mean + 1\u03C3', { fontSize: '12px' }));
legend.add(row4);
Map.add(legend);
