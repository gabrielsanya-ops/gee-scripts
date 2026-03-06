// Imports (2 entries)
var geometry = /* color: #d63000 */ee.Geometry.Polygon(
        [[[0, 0]]], null, false);
var geometry2 = /* color: #98ff00 */ee.Geometry.Point([37.32, -0.16]);

// Load MODIS EVI imagery.
var collection = ee.ImageCollection('MODIS/006/MYD13A1').select('EVI');

// Define reference conditions from the first 10 years of data.
var reference = collection.filterDate('2001-01-01', '2010-12-31')
// Sort chronologically in descending order.
  .sort('system:time_start', false);

// Compute the mean of the first 10 years.
var mean = reference.mean();

// Compute anomalies by subtracting the 2001-2010 mean from each image in a
// collection of 2011-2014 images. Copy the time property for to the
// computed anomaly images in the new collection.
var series = collection.filterDate('2011-01-01', '2014-12-31').map(function(image) {
  return image.subtract(mean).set('system:time_start', image.get('system:time_start'));
});

// Display cumulative anomalies.
Map.setCenter(geometry2, 5);
Map.addLayer(series.sum(),
  {min: -6000, max: 6000, palette: ['ff0000', '000000', '00ff00']}, 'EVI anomaly');

// Get the timestamp from the most recent image in the reference collection.
var time0 = ee.Image(reference.first()).get('system:time_start');

// Use imageCollection.iterate() to make a collection of cumulative anomaly over time.
// The initial value for iterate() is a list of anomaly images already processed.
// The first anomaly image in the list is just 0, with the time0 timestamp.
var first = ee.List([
  // Rename the first band 'EVI'.
  ee.Image(0).set('system:time_start', time0).select([0], ['EVI'])
]);

// This is a function to pass to Iterate().
// As anomaly images are computed, add them to the list.
var accumulate = function(image, list) {
  // Get the latest cumulative anomaly image from the end of the list with
  // get(-1). Since the type of the list argument of the function is unknown,
  // it needs to be cast to a List. Since the return type of get() is unknown,
  // it cast to Image.
  var previous = ee.Image(ee.List(list).get(-1));
  // Add the current anomaly to make a new cumulative anomaly image.
  var added = image.add(previous);
  // Propagate metadata to the new image.
  // .set('system:time_start', image.get('system:time_start'));
  // Return the list with the cumulative anomaly inserted.
  return ee.List(list).add(added);
};

// Create an ImageCollection of cumulative anomaly images by iterating.
// Since the return type of iterate is unknown, it needs to be cast to a List.
var cumulative = ee.ImageCollection(ee.List(series.iterate(accumulate, first)));

// Predefine the chart titles.
var title = {
  title: 'Cumulative EVI anomaly over time',
  hAxis: {title: 'Time'},
  vAxis: {title: 'Cumulative EVI anomaly'},
};

// Chart some interesting locations.
var pt1 = ee.Geometry.Point(37.32, -0.16);
print('Mt. Kenya:',
  ui.Chart.image.series(
    cumulative, pt1, ee.Reducer.first(), 500).setOptions(title));

var pt2 = ee.Geometry.Point(116.4647, 40.1054);
print('Beijing urbanization:',
  ui.Chart.image.series(
    cumulative, pt2, ee.Reducer.first(), 500).setOptions(title));
