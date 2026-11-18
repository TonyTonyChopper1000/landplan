// MapLibre 6 runs vector/GeoJSON work in a module worker that it looks for next to its own
// script. After bundling that file is not there, so GeoJSON layers silently never load
// (raster imagery still shows). Point MapLibre at the bundled worker explicitly.
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);

export {};
