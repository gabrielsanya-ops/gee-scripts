// Imports: CHIRPS ImageCollection; Aljouf_poly Table
var CHIRPS = ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD');
var Aljouf_poly = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

// var countries = ee.FeatureCollection('USDOS/LSIB SIMPLE/2017');
// var saudiArabia = countries.filter(ee.Filter.eq('country_na', 'Saudi Arabia'));

Map.addLayer(Aljouf_poly, {}, 'saudi Arabia');

// CHIRPS data: 1981-01-01 to 2024-06-30
var precip = CHIRPS.filterDate('1981-01-01', '2024-06-30');

var TS5 = ui.Chart.image.series(precip, Aljouf_poly, ee.Reducer.mean(), 1000, 'system:time_start')
  .setOptions({
    title: 'Precipitation Full Time Series',
    vAxis: { title: 'mm/pentad' },
    hAxis: { title: 'Time frame/Year' }
  });
print(TS5);

// Charts One Year
var precip1year = CHIRPS.filterDate('2022-06-01', '2023-06-30');
var TS1 = ui.Chart.image.series(precip1year, Aljouf_poly, ee.Reducer.mean(), 1000, 'system:time_start')
  .setOptions({
    title: 'Precipitation 1-Year Time Series',
    vAxis: { title: 'mm/pentad' },
    hAxis: { title: 'Time frame/Year' }
  });
print(TS1);

var saudiArabiaPrecip1 = precip1year.mean().clip(Aljouf_poly);
var saudiArabiaPrecip = precip.mean().clip(Aljouf_poly);

Map.addLayer(saudiArabiaPrecip1, { min: 0, max: 70, palette: 'CCFFCC,00CC66,006600' }, 'Precip 2023-24');
// Map.addLayer(saudiArabiaPrecip, { min: 0, max: 70, palette: 'CCFFCC,00CC66,006600' }, 'Precip 1986-2015');

Map.centerObject(Aljouf_poly, 7);

Export.image.toDrive({
  image: saudiArabiaPrecip1,
  description: 'precip',
  folder: 'KSA_precip',
  fileNamePrefix: 'precip',
  region: Aljouf_poly,
  scale: 10,
  maxPixels: 1e13
});
