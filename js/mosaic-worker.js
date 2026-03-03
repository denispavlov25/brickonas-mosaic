/**
 * Mosaic Configurator Web Worker
 * Handles all heavy computation off the main thread.
 *
 * Messages:
 *   filter    -> filterResult     (HSV/brightness/contrast + resize)
 *   quantize  -> quantizeResult   (color quantization + optional correction)
 *   correct   -> correctResult    (step 4 piece correction)
 */

importScripts('color-distance.js');
importScripts('worker-heap.js');
importScripts('bricklink-colors.js');
importScripts('worker-algo.js');

self.onmessage = function(e) {
    var msg = e.data;
    try {
        switch (msg.type) {
            case 'filter':
                handleFilter(msg);
                break;
            case 'quantize':
                handleQuantize(msg);
                break;
            case 'correct':
                handleCorrect(msg);
                break;
            default:
                self.postMessage({ type: 'error', message: 'Unknown message type: ' + msg.type });
        }
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message || String(err) });
    }
};

function handleFilter(msg) {
    var pixels = msg.pixels;
    var inputWidth = msg.inputWidth;
    var targetW = msg.targetW;
    var targetH = msg.targetH;
    var hue = msg.hue || 0;
    var sat = msg.sat || 0;
    var val = msg.val || 0;
    var brightness = msg.brightness || 0;
    var contrast = msg.contrast || 0;
    var interpolation = msg.interpolation || 'avg';

    self.postMessage({ type: 'progress', percent: 0, message: 'Resizing image...' });

    // Resize to target resolution
    var poolingFn = poolingFunctions[interpolation] || avgPoolingKernel;
    var resized = resizeImagePixelsWithAdaptivePooling(pixels, inputWidth, targetW, targetH, poolingFn);

    self.postMessage({ type: 'progress', percent: 30, message: 'Applying adjustments...' });

    // Apply HSV
    if (hue !== 0 || sat !== 0 || val !== 0) {
        resized = applyHSVAdjustment(resized, hue, sat / 100, val / 100);
    }

    // Apply brightness
    if (brightness !== 0) {
        resized = applyBrightnessAdjustment(resized, brightness);
    }

    // Apply contrast
    if (contrast !== 0) {
        resized = applyContrastAdjustment(resized, contrast);
    }

    self.postMessage({ type: 'progress', percent: 100, message: 'Done' });
    self.postMessage(
        { type: 'filterResult', pixels: resized, width: targetW, height: targetH },
        [resized.buffer]
    );
}

function handleQuantize(msg) {
    var pixels = msg.pixels;
    var width = msg.width;
    var height = msg.height;
    var studMap = msg.studMap;
    var algorithm = msg.algorithm;
    var distanceMethod = msg.distanceMethod || 'ciede2000';
    var bleedthrough = msg.bleedthrough || false;
    var overrides = msg.overrides || null;
    var assumeInfinite = msg.assumeInfinite !== false; // default true

    var colorDistFn = createColorDistanceFunction(distanceMethod);

    self.postMessage({ type: 'progress', percent: 0, message: 'Preparing colors...' });

    // Apply bleedthrough if needed
    var workStudMap = bleedthrough ? getDarkenedStudMap(studMap) : studMap;
    var workPixels = bleedthrough ? getDarkenedImage(pixels) : pixels;

    // Apply overrides to working pixels if present
    if (overrides) {
        workPixels = getArrayWithOverridesApplied(workPixels, bleedthrough ? getDarkenedImage(overrides) : overrides);
    }

    var result;
    var traditionalKernel = quantizationAlgorithmToTraditionalDitheringKernel[algorithm];

    if (traditionalKernel) {
        // Traditional dithering (Floyd-Steinberg, JJN, Atkinson, Sierra)
        self.postMessage({ type: 'progress', percent: 10, message: 'Applying dithering...' });
        result = alignPixelsWithTraditionalDithering(workStudMap, workPixels, width, colorDistFn, traditionalKernel);
    } else if (algorithm === 'greedy' || algorithm === 'GGD') {
        // GGD or Greedy - both use the GGD function
        var skipDithering = (algorithm === 'greedy');
        self.postMessage({ type: 'progress', percent: 10, message: 'Processing pixels...' });
        result = correctPixelsForAvailableStudsWithGreedyDynamicDithering(
            workStudMap, workPixels, width, colorDistFn, skipDithering, assumeInfinite,
            function(percent) {
                self.postMessage({ type: 'progress', percent: 10 + Math.round(percent * 0.85), message: 'Processing pixels... ' + percent + '%' });
            }
        );
    } else {
        // Two-Phase (default): simple nearest-color mapping
        self.postMessage({ type: 'progress', percent: 10, message: 'Mapping colors...' });
        result = alignPixelsToStudMap(workPixels, workStudMap, colorDistFn);
    }

    // Revert bleedthrough
    if (bleedthrough) {
        var darkenedStudsToStuds = getDarkenedStudsToStuds(Object.keys(studMap));
        result = revertDarkenedImage(result, darkenedStudsToStuds);
    }

    // Apply overrides on top of result (non-darkened)
    if (overrides) {
        var resultArr = new Uint8ClampedArray(result);
        for (var i = 0; i < overrides.length; i++) {
            if (overrides[i] != null) {
                resultArr[i] = overrides[i];
            }
        }
        result = resultArr;
    }

    var studCounts = getUsedPixelsStudMap(result);

    self.postMessage({ type: 'progress', percent: 100, message: 'Done' });
    self.postMessage(
        { type: 'quantizeResult', pixels: result, studCounts: studCounts, width: width, height: height },
        [result.buffer]
    );
}

function handleCorrect(msg) {
    var quantizedPixels = msg.quantizedPixels;
    var originalPixels = msg.originalPixels;
    var width = msg.width;
    var studMap = msg.studMap;
    var algorithm = msg.algorithm;
    var distanceMethod = msg.distanceMethod || 'ciede2000';
    var bleedthrough = msg.bleedthrough || false;
    var overrides = msg.overrides || null;
    var tieResolutionMethod = msg.tieResolutionMethod || 'none';
    var colorTieGroupingFactor = msg.colorTieGroupingFactor || 1;

    var colorDistFn = createColorDistanceFunction(distanceMethod);

    self.postMessage({ type: 'progress', percent: 0, message: 'Correcting piece counts...' });

    var workStudMap = bleedthrough ? getDarkenedStudMap(studMap) : studMap;
    var workOriginal = bleedthrough ? getDarkenedImage(originalPixels) : originalPixels;
    var workQuantized = bleedthrough ? getDarkenedImage(quantizedPixels) : quantizedPixels;
    var workOverrides = overrides || [];
    if (bleedthrough && overrides) {
        workOverrides = getDarkenedImage(overrides);
    }

    var result;

    if (algorithm === 'GGD') {
        // Re-run GGD with finite counts
        var workPixels = originalPixels;
        if (overrides) {
            workPixels = getArrayWithOverridesApplied(workPixels, overrides);
        }
        if (bleedthrough) {
            workPixels = getDarkenedImage(workPixels);
        }
        result = correctPixelsForAvailableStudsWithGreedyDynamicDithering(
            workStudMap, workPixels, width, colorDistFn, false, false,
            function(percent) {
                self.postMessage({ type: 'progress', percent: Math.round(percent * 0.95), message: 'Correcting... ' + percent + '%' });
            }
        );
    } else {
        // Two-Phase / Greedy correction
        result = correctPixelsForAvailableStuds(
            workQuantized, workStudMap, workOriginal, workOverrides,
            tieResolutionMethod, colorTieGroupingFactor, width, colorDistFn
        );
    }

    // Revert bleedthrough
    if (bleedthrough) {
        var darkenedStudsToStuds = getDarkenedStudsToStuds(Object.keys(studMap));
        result = revertDarkenedImage(result, darkenedStudsToStuds);
    }

    // Apply overrides on top
    if (overrides) {
        var resultArr = new Uint8ClampedArray(result);
        for (var i = 0; i < overrides.length; i++) {
            if (overrides[i] != null) {
                resultArr[i] = overrides[i];
            }
        }
        result = resultArr;
    }

    var studCounts = getUsedPixelsStudMap(result);

    self.postMessage({ type: 'progress', percent: 100, message: 'Done' });
    self.postMessage(
        { type: 'correctResult', pixels: result, studCounts: studCounts, width: width },
        [result.buffer]
    );
}
