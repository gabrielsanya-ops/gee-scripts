// OPTRAM soil moisture. Imports: aoi (Aljouf_poly); optional imageVisParam for OPTRAM
var aoi = ee.FeatureCollection('projects/ee-gabrielsanya2/assets/Aljouf_poly');

var startDate = '2023-02-01';
var endDate = '2023-05-31';

var S2 = ee.ImageCollection('COPERNICUS/S2')
  .filterDate(startDate, endDate)
  .filterBounds(aoi)
  .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', 10);

var img = S2.median().clip(aoi).divide(10000);
Map.addLayer(img, { min: 0, max: 0.2, bands: ['B4', 'B3', 'B2'] }, 'S2');
Map.centerObject(aoi, 12);

// STR and NDVI
var SWIR = img.select('B12').rename('SWIR');
var STR = img.expression('((1-SWIR)**2)/(2*SWIR)', { SWIR: SWIR }).rename('STR');
var NDVI = img.normalizedDifference(['B8', 'B4']).rename('NDVI');

var ndviParams = { min: 0, max: 0.8, palette: ['red', 'yellow', 'green'] };
Map.addLayer(NDVI, ndviParams, 'ndvi');

function setNdviMinMax(img) {
  var ndviMin = img.select('NDVI').reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: img.geometry(),
    scale: 20,
    maxPixels: 1e13
  }).get('NDVI');
  var ndviMax = img.select('NDVI').reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: img.geometry(),
    scale: 20,
    maxPixels: 1e13
  }).get('NDVI');
  return img.set('NDVI_min', ndviMin).set('NDVI_max', ndviMax);
}

function collection_index(image) {
  var ndvi_param = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var SWIR_param = image.select('B12').divide(10000).rename('SWIR');
  var STR_param = image.expression('((1-SWIR)**2)/(2*SWIR)', { SWIR: SWIR_param }).rename('STR');
  ndvi_param = setNdviMinMax(ndvi_param.addBands(STR_param));
  return ndvi_param;
}

var coll = S2.map(collection_index);
print(coll);

// Full cover: NDVI >= 0.1; Bare soil: 0 <= NDVI <= 0.04
var STR_full_cover = coll.map(function(image) {
  var full_cover = image.select('NDVI').gte(0.1);
  return image.select('STR').updateMask(full_cover);
});

var STR_bare_soil = coll.map(function(image) {
  var bare_soil = image.select('NDVI').gte(0).and(image.select('NDVI').lte(0.04));
  return image.select('STR').updateMask(bare_soil);
});

var vw_opt = ee.Number(STR_full_cover.max().reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 20,
  maxPixels: 1e10
}).get('STR'));
var vd_opt = ee.Number(STR_full_cover.min().reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: aoi,
  scale: 20,
  maxPixels: 1e10
}).get('STR'));
var iw_opt = ee.Number(STR_bare_soil.max().reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 20,
  maxPixels: 1e10
}).get('STR'));
var id_opt = ee.Number(STR_bare_soil.min().reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: aoi,
  scale: 20,
  maxPixels: 1e10
}).get('STR'));

print(vw_opt, 'vw_opt');
print(vd_opt, 'vd_opt');
print(iw_opt, 'iw_opt');
print(id_opt, 'id_opt');

var sd_opt = vd_opt.subtract(id_opt);
var sw_opt = vw_opt.subtract(iw_opt);
print(sd_opt, 'sd_opt');
print(sw_opt, 'sw_opt');

// OPTRAM formula
var STR_img = coll.median();
var NDVI_img = STR_img.select('NDVI');
var STR_band = STR_img.select('STR');

var OPTRAM = STR_band.expression(
  '((id + (sd * NDVI) - STR) / ((id - iw) + ((sd - sw) * NDVI))) * 100',
  {
    STR: STR_band,
    NDVI: NDVI_img,
    id: id_opt,
    sd: sd_opt,
    iw: iw_opt,
    sw: sw_opt
  }
).rename('OPTRAM');

var OPTRAMParams = { min: 0, max: 100, palette: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue'] };
Map.centerObject(aoi, 7);
Map.addLayer(OPTRAM, OPTRAMParams, 'OPTRAM');

Export.image.toDrive({
  image: OPTRAM,
  description: 'OPTRAM',
  folder: 'Aljouf',
  fileNamePrefix: 'OPTRAM',
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});
