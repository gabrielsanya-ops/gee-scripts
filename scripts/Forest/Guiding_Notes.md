### Guiding notes (Forest / Coffee_builtup)

These notes explain how to run and adapt `Coffee_builtup.js` in the Google Earth Engine Code Editor.

### What the script does

- Builds a **training dataset** from your imported class geometries.
- Uses **Google Satellite Embedding v1 (annual)** plus **Sentinel 2 bands** (Blue/Green/Red/NIR) as predictors.
- Trains a **Gradient Boosted Decision Trees** classifier (`smileGradientTreeBoost`).
- Evaluates model quality with a **confusion matrix**, overall accuracy, and kappa.
- Produces a **classified map** with a legend and (optional) Drive export.

### Required imports (must exist in the Code Editor)

In your Earth Engine script, you must have these **Geometry Imports** available (FeatureCollections):

- `farms`
- `water`
- `other`
- `coffee`
- `forest`
- `rock`
- `shrubland`

Each should contain polygons (recommended) or points representing training samples for that class.

### Key parameters to edit

In `Coffee_builtup.js`:

- **`EMBED_YEAR`**: which annual embedding mosaic to use (default `2023`).
- **Sentinel 2 filter**: date range and cloud percent (currently `CLOUDY_PIXEL_PERCENTAGE < 30` for the same year).
- **Classifier settings** (optional): `numberOfTrees`, `shrinkage`, `maxNodes`, `samplingRate`.

### Suggested workflow

1. **Ensure training data quality**
   - Use polygons that are clean and representative.
   - Avoid mixed pixels at boundaries (roads, edges of farms, water edges).
   - Keep classes balanced (don’t give one class 10× more area than others).

2. **Run the script**
   - Click **Run** in the GEE Code Editor.
   - In the Console, review:
     - `Confusion matrix`
     - `Overall accuracy`
     - `Kappa`

3. **Inspect the map**
   - Turn on `Coffee_builtup: classified`.
   - Compare against the basemap or a Sentinel 2 RGB layer to see obvious errors.

4. **Iterate**
   - If accuracy is low, improve training polygons first (usually the fastest win).
   - Then adjust model settings if needed (trees, maxNodes).

### Troubleshooting

- **“No such variable: farms / coffee / …”**
  - Your geometry imports are missing or named differently. Rename the imports to match exactly.

- **Empty training samples / `notNull` filtering removes everything**
  - Check AOI location and time window. If the Sentinel 2 median is empty (no images), relax cloud threshold or widen dates.

- **Memory limits**
  - Reduce AOI size, reduce bands, or classify at a coarser scale.
  - Use `tileScale` in `sampleRegions` (already set to `4`).

- **Model predicts one class everywhere**
  - Usually indicates poor training separation or class imbalance.
  - Add more diverse training polygons for confusing classes (e.g., coffee vs shrubland).

### Optional export

At the bottom of `Coffee_builtup.js` there is an `Export.image.toDrive` block commented out.

- Uncomment it to export the classified raster.
- Make sure `region: aoi` is correct for your area.

