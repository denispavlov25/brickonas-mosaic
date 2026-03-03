/**
 * Pure computation functions extracted from algo.js.
 * No DOM dependencies - safe for Web Worker use.
 * All algorithm logic is identical to the original.
 */

// ============================================
// Utility functions
// ============================================

function hexToRgb(hex) {
    var hexInt = parseInt(hex.replace("#", ""), 16);
    var r = (hexInt >> 16) & 255;
    var g = (hexInt >> 8) & 255;
    var b = hexInt & 255;
    return [r, g, b];
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function inverseHex(hex) {
    return "#" + hex.match(/[a-f0-9]{2}/gi)
        .map(function(e) { return ((255 - parseInt(e, 16)) | 0).toString(16).replace(/^([a-f0-9])$/, "0$1"); })
        .join("");
}

function clamp255(input) {
    return Math.round(Math.min(Math.max(input, 0), 255));
}

function studMapToSortedColorList(studMap) {
    var result = Object.keys(studMap);
    result.sort();
    return result;
}

// ============================================
// Depth helpers
// ============================================

function getDiscreteDepthPixels(pixels, thresholds) {
    var result = [];
    for (var i = 0; i < pixels.length; i++) {
        if (i % 4 === 3) {
            result.push(255);
        } else {
            var pixelLevel = 0;
            for (var j = 0; j < thresholds.length; j++) {
                if (pixels[i] > thresholds[j]) {
                    pixelLevel = j + 1;
                }
            }
            result.push(pixelLevel);
        }
    }
    // make grayscale
    for (var i = 0; i < result.length; i += 4) {
        var val = 0;
        for (var j = 0; j < 3; j++) {
            val += result[i + j];
        }
        val = Math.floor(val / 3);
        for (var j = 0; j < 3; j++) {
            result[i + j] = val;
        }
    }
    return result;
}

function scaleUpDiscreteDepthPixelsForDisplay(pixels, numLevels) {
    var result = [];
    for (var i = 0; i < pixels.length; i++) {
        if (i % 4 === 3) {
            result.push(255);
        } else {
            result.push(Math.round(Math.min((255 * (pixels[i] + 1)) / numLevels, 255)));
        }
    }
    return result;
}

// ============================================
// Color quantization
// ============================================

function alignPixelsToStudMap(inputPixels, studMap, colorDistanceFunction) {
    var alignedPixels = new Uint8ClampedArray(inputPixels);
    var anchorPixels = studMapToSortedColorList(studMap).map(function(pixel) { return hexToRgb(pixel); });
    var colorCache = new Map();

    for (var i = 0; i < inputPixels.length / 4; i++) {
        var targetPixelIndex = i * 4;
        var r = inputPixels[targetPixelIndex];
        var g = inputPixels[targetPixelIndex + 1];
        var b = inputPixels[targetPixelIndex + 2];
        var cacheKey = (r << 16) | (g << 8) | b;

        var closestAnchor;
        if (colorCache.has(cacheKey)) {
            closestAnchor = colorCache.get(cacheKey);
        } else {
            var pixelToAlign = [r, g, b];
            var closestAnchorPixel = 0;
            var minDistance = colorDistanceFunction(pixelToAlign, anchorPixels[0]);
            for (var anchorPixelIndex = 1; anchorPixelIndex < anchorPixels.length; anchorPixelIndex++) {
                var distance = colorDistanceFunction(pixelToAlign, anchorPixels[anchorPixelIndex]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestAnchorPixel = anchorPixelIndex;
                }
            }
            closestAnchor = anchorPixels[closestAnchorPixel];
            colorCache.set(cacheKey, closestAnchor);
        }

        for (var j = 0; j < 3; j++) {
            alignedPixels[targetPixelIndex + j] = closestAnchor[j];
        }
    }
    return alignedPixels;
}

function getAverageQuantizationError(pixels1, pixels2, colorDistanceFunction) {
    var totalError = 0;
    for (var i = 0; i < pixels1.length / 4; i++) {
        var targetPixelIndex = i * 4;
        var pixel1 = [pixels1[targetPixelIndex], pixels1[targetPixelIndex + 1], pixels1[targetPixelIndex + 2]];
        var pixel2 = [pixels2[targetPixelIndex], pixels2[targetPixelIndex + 1], pixels2[targetPixelIndex + 2]];
        totalError += colorDistanceFunction(pixel1, pixel2);
    }
    return totalError / (pixels1.length / 4);
}

function getArrayWithOverridesApplied(inputPixels, overridePixels) {
    var resultPixels = [];
    for (var i = 0; i < inputPixels.length; i++) {
        if (overridePixels[i] != null) {
            resultPixels.push(overridePixels[i]);
        } else {
            resultPixels.push(inputPixels[i]);
        }
    }
    return resultPixels;
}

function getUsedPixelsStudMap(inputPixels) {
    var result = {};
    for (var i = 0; i < inputPixels.length / 4; i++) {
        var targetPixelIndex = i * 4;
        var pixelHexVal = rgbToHex(inputPixels[targetPixelIndex], inputPixels[targetPixelIndex + 1], inputPixels[targetPixelIndex + 2]);
        result[pixelHexVal] = (result[pixelHexVal] || 0) + 1;
    }
    return result;
}

function studMapDifference(map1, map2) {
    var hexCodes = Array.from(new Set(studMapToSortedColorList(map1).concat(studMapToSortedColorList(map2))));
    hexCodes.sort();
    var result = {};
    hexCodes.forEach(function(hexCode) {
        result[hexCode] = (map1[hexCode] || 0) - (map2[hexCode] || 0);
    });
    return result;
}

// ============================================
// Correction algorithm (Two-Phase)
// ============================================

var TIEBREAKER_RATIO = 0.001;

function correctPixelsForAvailableStuds(
    anchorAlignedPixels, availableStudMap, originalPixels, overridePixelArray,
    tieResolutionMethod, colorTieGroupingFactor, imageWidth, colorDistanceFunction
) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap));
    var usedPixelStudMap = getUsedPixelsStudMap(anchorAlignedPixels);
    var remainingStudMap = studMapDifference(availableStudMap, usedPixelStudMap);

    var problematicPixelsMap = {};
    studMapToSortedColorList(availableStudMap).forEach(function(color) { problematicPixelsMap[color] = []; });
    studMapToSortedColorList(usedPixelStudMap).forEach(function(color) { problematicPixelsMap[color] = []; });

    for (var i = 0; i < anchorAlignedPixels.length; i += 4) {
        var alignedHex = rgbToHex(anchorAlignedPixels[i], anchorAlignedPixels[i + 1], anchorAlignedPixels[i + 2]);
        var wasOverridden = overridePixelArray[i] != null && overridePixelArray[i + 1] != null && overridePixelArray[i + 2] != null;
        var originalRGB = wasOverridden
            ? [overridePixelArray[i], overridePixelArray[i + 1], overridePixelArray[i + 2]]
            : [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]];
        var alignedRGB = [anchorAlignedPixels[i], anchorAlignedPixels[i + 1], anchorAlignedPixels[i + 2]];
        var adjustedIndex = i / 4;
        var row = Math.floor(adjustedIndex / imageWidth);
        var col = adjustedIndex % imageWidth;
        var adjustedRow = Math.floor(row / colorTieGroupingFactor);
        var adjustedCol = Math.floor(col / colorTieGroupingFactor);
        var adjustedImageWidth = Math.floor(imageWidth / colorTieGroupingFactor);
        var tiebreakFactor = TIEBREAKER_RATIO;
        if (tieResolutionMethod === "random") {
            tiebreakFactor *= Math.random();
        } else if (tieResolutionMethod === "mod2") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 2;
        } else if (tieResolutionMethod === "mod3") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 3;
        } else if (tieResolutionMethod === "mod4") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 4;
        } else if (tieResolutionMethod === "mod5") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 5;
        } else if (tieResolutionMethod === "noisymod2") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 2) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod3") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 3) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod4") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 4) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod5") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 5) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "cascadingmod") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 5) * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "cascadingnoisymod") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                Math.random() * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "alternatingmod") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedImageWidth - adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedImageWidth - adjustedCol) % 5) * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "alternatingnoisymod") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedImageWidth - adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                Math.random() * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        }
        problematicPixelsMap[alignedHex].push({
            index: i, originalRGB: originalRGB, alignedRGB: alignedRGB,
            alignmentDistSquared: colorDistanceFunction(originalRGB, alignedRGB) + tiebreakFactor
        });
    }

    Object.keys(problematicPixelsMap).forEach(function(anchorPixel) {
        problematicPixelsMap[anchorPixel].sort(function(p1, p2) { return p2.alignmentDistSquared - p1.alignmentDistSquared; });
    });

    Object.keys(problematicPixelsMap).forEach(function(anchorPixel) {
        var availableStuds = availableStudMap[anchorPixel] || 0;
        var pixelArray = problematicPixelsMap[anchorPixel];
        while (pixelArray.length > 0 && availableStuds > 0) {
            pixelArray.pop();
            availableStuds--;
        }
    });

    var problematicPixels = [].concat.apply([], Object.values(problematicPixelsMap));
    problematicPixels.sort(function(p1, p2) { return p2.alignmentDistSquared - p1.alignmentDistSquared; });

    var correctedPixels = new Uint8ClampedArray(anchorAlignedPixels);
    Object.keys(remainingStudMap).forEach(function(stud) {
        if (remainingStudMap[stud] <= 0) delete remainingStudMap[stud];
    });

    var hexToRgbCache = {};
    Object.keys(remainingStudMap).forEach(function(hex) { hexToRgbCache[hex] = hexToRgb(hex); });

    for (var i = 0; i < problematicPixels.length; i++) {
        var problematicPixel = problematicPixels[i];
        var possibleReplacements = Object.keys(remainingStudMap);
        if (possibleReplacements.length === 0) break;
        var replacement = possibleReplacements[0];
        var minDist = colorDistanceFunction(problematicPixel.originalRGB, hexToRgbCache[replacement]);
        for (var j = 1; j < possibleReplacements.length; j++) {
            var candidate = possibleReplacements[j];
            var dist = colorDistanceFunction(problematicPixel.originalRGB, hexToRgbCache[candidate]);
            if (dist < minDist) { minDist = dist; replacement = candidate; }
        }
        var pixelIndex = problematicPixel.index;
        var replacementRGB = hexToRgbCache[replacement];
        for (var j = 0; j < 3; j++) { correctedPixels[pixelIndex + j] = replacementRGB[j]; }
        remainingStudMap[replacement]--;
        if (remainingStudMap[replacement] <= 0) { delete remainingStudMap[replacement]; delete hexToRgbCache[replacement]; }
    }

    return correctedPixels;
}

// ============================================
// Dithering kernels
// ============================================

var GAUSSIAN_DITHERING_KERNEL = [
    [1, 4, 6, 4, 1],
    [4, 16, 26, 16, 4],
    [7, 26, 0, 26, 7],
    [4, 16, 26, 16, 4],
    [1, 4, 6, 4, 1]
];

var FLOYD_STEINBERG_DITHERING_KERNEL = [
    { row: 0, col: 1, val: 7 },
    { row: 1, col: -1, val: 3 },
    { row: 1, col: 0, val: 5 },
    { row: 1, col: 1, val: 1 }
];

var JARVIS_JUDICE_NINKE_DITHERING_KERNEL = [
    { row: 0, col: 1, val: 7 }, { row: 0, col: 2, val: 5 },
    { row: 1, col: -2, val: 3 }, { row: 1, col: -1, val: 5 },
    { row: 1, col: 0, val: 7 }, { row: 1, col: 1, val: 5 }, { row: 1, col: 2, val: 3 },
    { row: 2, col: -2, val: 1 }, { row: 2, col: -1, val: 3 },
    { row: 2, col: 0, val: 5 }, { row: 2, col: 1, val: 3 }, { row: 2, col: 2, val: 1 }
];

var ATKINSON_DITHERING_KERNEL = [
    { row: 0, col: 1, val: 1 }, { row: 0, col: 2, val: 1 },
    { row: 1, col: -1, val: 1 }, { row: 1, col: 0, val: 1 }, { row: 1, col: 1, val: 1 },
    { row: 2, col: 0, val: 1 }
].map(function(entry) { entry.val = (entry.val * 3) / 4; return entry; });

var SIERRA_DITHERING_KERNEL = [
    { row: 0, col: 1, val: 5 }, { row: 0, col: 2, val: 3 },
    { row: 1, col: -2, val: 2 }, { row: 1, col: -1, val: 4 },
    { row: 1, col: 0, val: 5 }, { row: 1, col: 1, val: 4 }, { row: 1, col: 2, val: 2 },
    { row: 2, col: -1, val: 2 }, { row: 2, col: 0, val: 3 }, { row: 2, col: 1, val: 2 }
];

var quantizationAlgorithmToTraditionalDitheringKernel = {
    floydSteinberg: FLOYD_STEINBERG_DITHERING_KERNEL,
    jarvisJudiceNinke: JARVIS_JUDICE_NINKE_DITHERING_KERNEL,
    atkinson: ATKINSON_DITHERING_KERNEL,
    sierra: SIERRA_DITHERING_KERNEL
};

// ============================================
// Helper: find best replacement color
// ============================================

function findReplacement(pixelRGB, remainingStudMap, colorDistanceFunction, hexToRgbCache) {
    var possibleReplacements = Object.keys(remainingStudMap);
    var replacement = possibleReplacements[0];
    var getRgb = hexToRgbCache ? function(hex) { return hexToRgbCache[hex]; } : hexToRgb;
    var minDistance = colorDistanceFunction(pixelRGB, getRgb(replacement));
    for (var i = 1; i < possibleReplacements.length; i++) {
        var candidate = possibleReplacements[i];
        if (remainingStudMap[candidate] > 0) {
            var dist = colorDistanceFunction(pixelRGB, getRgb(candidate));
            if (dist < minDistance) { minDistance = dist; replacement = candidate; }
        }
    }
    return getRgb(replacement);
}

// ============================================
// GGD: Greedy Gaussian Dithering
// ============================================

function correctPixelsForAvailableStudsWithGreedyDynamicDithering(
    availableStudMap, originalPixels, imageWidth, colorDistanceFunction, skipDithering, assumeInfinitePixelCounts, progressCallback
) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap));

    var hexToRgbCache = {};
    Object.keys(availableStudMap).forEach(function(hex) { hexToRgbCache[hex] = hexToRgb(hex); });

    var pixelMatrix = [];
    var height = Math.floor(originalPixels.length / 4 / imageWidth);
    for (var row = 0; row < height; row++) {
        pixelMatrix[row] = [];
        for (var col = 0; col < imageWidth; col++) {
            var i = (row * imageWidth + col) * 4;
            var pixelRGB = [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]];
            var tentativeReplacementRGB = findReplacement(pixelRGB, availableStudMap, colorDistanceFunction, hexToRgbCache);
            var tentativeReplacementDistance = colorDistanceFunction(pixelRGB, tentativeReplacementRGB);
            pixelMatrix[row][col] = {
                pixelRGB: pixelRGB,
                isInPixelQueue: true,
                row: row,
                col: col,
                tentativeReplacementRGB: tentativeReplacementRGB,
                tentativeReplacementDistance: tentativeReplacementDistance,
                heapGeneration: 0
            };
        }
    }

    var comparator = function(b, a) { return a.tentativeReplacementDistance - b.tentativeReplacementDistance; };
    var pixelQueue = new Heap(comparator);

    var wrappers = [];
    for (var r = 0; r < pixelMatrix.length; r++) {
        for (var c = 0; c < pixelMatrix[r].length; c++) {
            var p = pixelMatrix[r][c];
            wrappers.push({ pixel: p, generation: 0, tentativeReplacementDistance: p.tentativeReplacementDistance });
        }
    }
    pixelQueue.init(wrappers);

    var totalPixels = imageWidth * height;
    var processedCount = 0;
    var lastProgressReport = 0;

    while (!pixelQueue.isEmpty()) {
        var entry = pixelQueue.pop();
        var nextPixel = entry.pixel;

        if (!nextPixel.isInPixelQueue) continue;
        if (nextPixel.heapGeneration !== entry.generation) continue;

        var dequeuedPixelQuantizationError = [
            nextPixel.pixelRGB[0] - nextPixel.tentativeReplacementRGB[0],
            nextPixel.pixelRGB[1] - nextPixel.tentativeReplacementRGB[1],
            nextPixel.pixelRGB[2] - nextPixel.tentativeReplacementRGB[2]
        ];

        nextPixel.isInPixelQueue = false;
        nextPixel.pixelRGB = nextPixel.tentativeReplacementRGB;

        processedCount++;
        // Report progress every 5000 pixels
        if (progressCallback && processedCount - lastProgressReport >= 5000) {
            lastProgressReport = processedCount;
            progressCallback(Math.round((processedCount / totalPixels) * 100));
        }

        if (!assumeInfinitePixelCounts) {
            var pixelHex = rgbToHex(nextPixel.pixelRGB[0], nextPixel.pixelRGB[1], nextPixel.pixelRGB[2]);
            availableStudMap[pixelHex] = availableStudMap[pixelHex] - 1;
            if (availableStudMap[pixelHex] === 0) {
                var exhaustedRGB = hexToRgbCache[pixelHex];
                delete availableStudMap[pixelHex];
                delete hexToRgbCache[pixelHex];

                var needsRebuild = false;
                pixelQueue.heapArray.forEach(function(wrapper) {
                    var p = wrapper.pixel;
                    if (p.isInPixelQueue &&
                        p.tentativeReplacementRGB[0] === exhaustedRGB[0] &&
                        p.tentativeReplacementRGB[1] === exhaustedRGB[1] &&
                        p.tentativeReplacementRGB[2] === exhaustedRGB[2]) {
                        var newRGB = findReplacement(p.pixelRGB, availableStudMap, colorDistanceFunction, hexToRgbCache);
                        var newDist = colorDistanceFunction(p.pixelRGB, newRGB);
                        p.tentativeReplacementRGB = newRGB;
                        p.tentativeReplacementDistance = newDist;
                        wrapper.tentativeReplacementDistance = newDist;
                        needsRebuild = true;
                    }
                });
                if (needsRebuild) pixelQueue.init();
            }
        }

        if (!skipDithering) {
            var kernel = GAUSSIAN_DITHERING_KERNEL;
            var kernelHeight = kernel.length;
            var kernelWidth = kernel[0].length;
            var kernelRowMiddle = Math.floor(kernelHeight / 2);
            var kernelColMiddle = Math.floor(kernelWidth / 2);

            var errorDenominator = 0;
            for (var kr = 0; kr < kernelHeight; kr++) {
                for (var kc = 0; kc < kernelWidth; kc++) {
                    if (kr != kernelRowMiddle || kc != kernelColMiddle) {
                        var pixelMatrixRow = nextPixel.row - kernelRowMiddle + kr;
                        var pixelMatrixCol = nextPixel.col - kernelColMiddle + kc;
                        var neighborhoodPixel = (pixelMatrix[pixelMatrixRow] || {})[pixelMatrixCol];
                        if (neighborhoodPixel != null && neighborhoodPixel.isInPixelQueue) {
                            errorDenominator += kernel[kr][kc];
                        }
                    }
                }
            }

            if (errorDenominator > 0) {
                for (var kr = 0; kr < kernelHeight; kr++) {
                    for (var kc = 0; kc < kernelWidth; kc++) {
                        if (kr != kernelRowMiddle || kc != kernelColMiddle) {
                            var pixelMatrixRow = nextPixel.row - kernelRowMiddle + kr;
                            var pixelMatrixCol = nextPixel.col - kernelColMiddle + kc;
                            var neighborhoodPixel = (pixelMatrix[pixelMatrixRow] || {})[pixelMatrixCol];
                            if (neighborhoodPixel != null && neighborhoodPixel.isInPixelQueue) {
                                var errorWeight = kernel[kr][kc] / errorDenominator;
                                neighborhoodPixel.pixelRGB = [
                                    clamp255(neighborhoodPixel.pixelRGB[0] + dequeuedPixelQuantizationError[0] * errorWeight),
                                    clamp255(neighborhoodPixel.pixelRGB[1] + dequeuedPixelQuantizationError[1] * errorWeight),
                                    clamp255(neighborhoodPixel.pixelRGB[2] + dequeuedPixelQuantizationError[2] * errorWeight)
                                ];

                                var tentativeReplacementRGB = findReplacement(
                                    neighborhoodPixel.pixelRGB, availableStudMap, colorDistanceFunction, hexToRgbCache
                                );
                                var tentativeReplacementDistance = colorDistanceFunction(neighborhoodPixel.pixelRGB, tentativeReplacementRGB);
                                var oldReplacementRGB = neighborhoodPixel.tentativeReplacementRGB;
                                neighborhoodPixel.tentativeReplacementRGB = tentativeReplacementRGB;
                                neighborhoodPixel.tentativeReplacementDistance = tentativeReplacementDistance;

                                if (oldReplacementRGB[0] != tentativeReplacementRGB[0] ||
                                    oldReplacementRGB[1] != tentativeReplacementRGB[1] ||
                                    oldReplacementRGB[2] != tentativeReplacementRGB[2]) {
                                    neighborhoodPixel.heapGeneration++;
                                    pixelQueue.add({
                                        pixel: neighborhoodPixel,
                                        generation: neighborhoodPixel.heapGeneration,
                                        tentativeReplacementDistance: neighborhoodPixel.tentativeReplacementDistance
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    var resultLength = imageWidth * height * 4;
    var result = new Uint8ClampedArray(resultLength);
    var idx = 0;
    pixelMatrix.forEach(function(row) {
        row.forEach(function(pixel) {
            result[idx++] = pixel.pixelRGB[0];
            result[idx++] = pixel.pixelRGB[1];
            result[idx++] = pixel.pixelRGB[2];
            result[idx++] = 255;
        });
    });
    return result;
}

// ============================================
// Traditional dithering (Floyd-Steinberg, JJN, Atkinson, Sierra)
// ============================================

function alignPixelsWithTraditionalDithering(availableStudMap, originalPixels, imageWidth, colorDistanceFunction, kernel) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap));

    var hexToRgbCache = {};
    Object.keys(availableStudMap).forEach(function(hex) { hexToRgbCache[hex] = hexToRgb(hex); });

    var pixelMatrix = [];
    var height = Math.floor(originalPixels.length / 4 / imageWidth);
    for (var row = 0; row < height; row++) {
        pixelMatrix[row] = [];
        for (var col = 0; col < imageWidth; col++) {
            var i = (row * imageWidth + col) * 4;
            pixelMatrix[row][col] = { pixelRGB: [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]] };
        }
    }

    var kernelDenominator = kernel.reduce(function(sum, entry) { return sum + entry.val; }, 0);

    for (var row = 0; row < height; row++) {
        for (var col = 0; col < imageWidth; col++) {
            var currentPixel = pixelMatrix[row][col];
            var replacementRGB = findReplacement(currentPixel.pixelRGB, availableStudMap, colorDistanceFunction, hexToRgbCache);
            var currentPixelQuantizationError = [
                currentPixel.pixelRGB[0] - replacementRGB[0],
                currentPixel.pixelRGB[1] - replacementRGB[1],
                currentPixel.pixelRGB[2] - replacementRGB[2]
            ];

            kernel.forEach(function(kernelEntry) {
                var forwardPixel = (pixelMatrix[row + kernelEntry.row] || {})[col + kernelEntry.col];
                if (forwardPixel != null) {
                    forwardPixel.pixelRGB = [
                        clamp255(forwardPixel.pixelRGB[0] + (currentPixelQuantizationError[0] * kernelEntry.val) / kernelDenominator),
                        clamp255(forwardPixel.pixelRGB[1] + (currentPixelQuantizationError[1] * kernelEntry.val) / kernelDenominator),
                        clamp255(forwardPixel.pixelRGB[2] + (currentPixelQuantizationError[2] * kernelEntry.val) / kernelDenominator)
                    ];
                }
            });

            currentPixel.pixelRGB = replacementRGB;
        }
    }

    var resultLength = imageWidth * height * 4;
    var result = new Uint8ClampedArray(resultLength);
    var idx = 0;
    pixelMatrix.forEach(function(row) {
        row.forEach(function(pixel) {
            result[idx++] = pixel.pixelRGB[0];
            result[idx++] = pixel.pixelRGB[1];
            result[idx++] = pixel.pixelRGB[2];
            result[idx++] = 255;
        });
    });
    return result;
}

// ============================================
// HSV / Brightness / Contrast adjustments
// ============================================

function rgb2hsv(r, g, b) {
    var v = Math.max(r, g, b), n = v - Math.min(r, g, b);
    var h = n && (v == r ? (g - b) / n : v == g ? 2 + (b - r) / n : 4 + (r - g) / n);
    return [60 * (h < 0 ? h + 6 : h), v && n / v, v];
}

function hsv2rgb(h, s, v) {
    var f = function(n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0); };
    return [f(5), f(3), f(1)];
}

function adjustHSV(rgbPixel, h, s, v) {
    var scaledRGB = rgbPixel.map(function(pixel) { return pixel / 255; });
    var baseHSV = rgb2hsv(scaledRGB[0], scaledRGB[1], scaledRGB[2]);
    var resultHue = (baseHSV[0] + Math.round(h)) % 360;
    var resultSaturation = Math.min(Math.max(baseHSV[1] + s, 0), 1);
    var resultValue = Math.min(Math.max(baseHSV[2] + v, 0), 1);
    var resultRGB = hsv2rgb(resultHue, resultSaturation, resultValue);
    return resultRGB.map(function(pixel) { return Math.round(pixel * 255); });
}

function applyPixelFilter(inputPixels, rgbFilter) {
    var outputPixels = new Uint8ClampedArray(inputPixels);
    for (var i = 0; i < inputPixels.length; i += 4) {
        var filteredPixel = rgbFilter([inputPixels[i], inputPixels[i + 1], inputPixels[i + 2]]);
        for (var j = 0; j < 3; j++) { outputPixels[i + j] = filteredPixel[j]; }
    }
    return outputPixels;
}

function applyHSVAdjustment(inputPixels, h, s, v) {
    return applyPixelFilter(inputPixels, function(pixel) { return adjustHSV(pixel, h, s, v); });
}

function adjustBrightness(rgbPixel, brightnessOffset) {
    return rgbPixel.map(function(channel) { return Math.round(Math.min(Math.max(channel + brightnessOffset, 0), 255)); });
}

function applyBrightnessAdjustment(inputPixels, brightnessOffset) {
    return applyPixelFilter(inputPixels, function(pixel) { return adjustBrightness(pixel, brightnessOffset); });
}

function adjustContrast(rgbPixel, contrastFactor) {
    return rgbPixel.map(function(channel) { return Math.round(Math.min(Math.max(contrastFactor * (channel - 128) + 128, 0), 255)); });
}

function applyContrastAdjustment(inputPixels, contrastOffset) {
    var contrastFactor = (259 * (255 + contrastOffset)) / (255 * (259 - contrastOffset));
    return applyPixelFilter(inputPixels, function(pixel) { return adjustContrast(pixel, contrastFactor); });
}

// ============================================
// Bleedthrough (darkening for round pieces)
// ============================================

function getDarkenedPixel(rgbPixel) {
    return rgbPixel.map(function(color) { return Math.round((color * Math.PI) / 4); });
}

function getDarkenedStudsToStuds(studList) {
    var result = {};
    studList.forEach(function(stud) {
        var darkenedRGB = getDarkenedPixel(hexToRgb(stud));
        result[rgbToHex(darkenedRGB[0], darkenedRGB[1], darkenedRGB[2])] = stud;
    });
    return result;
}

function getDarkenedStudMap(studMap) {
    var result = {};
    Object.keys(studMap).forEach(function(stud) {
        var darkenedRGB = getDarkenedPixel(hexToRgb(stud));
        result[rgbToHex(darkenedRGB[0], darkenedRGB[1], darkenedRGB[2])] = studMap[stud];
    });
    return result;
}

function getDarkenedImage(pixels) {
    var outputPixels = new Uint8ClampedArray(pixels);
    for (var i = 0; i < pixels.length; i += 4) {
        if (pixels[i] != null && pixels[i + 1] != null && pixels[i + 2] != null) {
            var darkenedPixel = getDarkenedPixel([pixels[i], pixels[i + 1], pixels[i + 2]]);
            for (var j = 0; j < 3; j++) { outputPixels[i + j] = darkenedPixel[j]; }
        }
    }
    return outputPixels;
}

function revertDarkenedImage(pixels, darkenedStudsToStuds) {
    var outputPixels = new Uint8ClampedArray(pixels);
    for (var i = 0; i < pixels.length; i += 4) {
        var pixelHex = rgbToHex(pixels[i], pixels[i + 1], pixels[i + 2]);
        var revertedPixelHex = pixelHex === "#000000" ? "#000000" : darkenedStudsToStuds[pixelHex];
        var revertedPixelRGB = hexToRgb(revertedPixelHex);
        for (var j = 0; j < 3; j++) { outputPixels[i + j] = revertedPixelRGB[j]; }
    }
    return outputPixels;
}

// ============================================
// Image resizing (adaptive pooling)
// ============================================

function convertPixelArrayToMatrix(pixelArray, totalWidth) {
    var result = [];
    for (var i = 0; i < pixelArray.length / 4; i++) {
        var iHorizontal = i % totalWidth;
        var iVertical = Math.floor(i / totalWidth);
        result[iVertical] = result[iVertical] || [];
        result[iVertical][iHorizontal] = [pixelArray[4 * i], pixelArray[4 * i + 1], pixelArray[4 * i + 2]];
    }
    return result;
}

function maxPoolingKernel(inputPixels) {
    var result = [0, 0, 0];
    inputPixels.forEach(function(pixel) {
        pixel.forEach(function(val, channel) { result[channel] = Math.max(result[channel], val); });
    });
    return result;
}

function minPoolingKernel(inputPixels) {
    var result = [255, 255, 255];
    inputPixels.forEach(function(pixel) {
        pixel.forEach(function(val, channel) { result[channel] = Math.min(result[channel], val); });
    });
    return result;
}

function avgPoolingKernel(inputPixels) {
    var sum = [0, 0, 0];
    inputPixels.forEach(function(pixel) {
        pixel.forEach(function(val, channel) { sum[channel] += val; });
    });
    return sum.map(function(channel) { return Math.round(channel / inputPixels.length); });
}

function dualMinMaxPoolingKernel(inputPixels) {
    var maxPool = maxPoolingKernel(inputPixels);
    var minPool = minPoolingKernel(inputPixels);
    var avgPool = avgPoolingKernel(inputPixels);
    return [0, 1, 2].map(function(channel) {
        var min = minPool[channel], max = maxPool[channel], avg = avgPool[channel];
        return avg - min < max - avg ? min : max;
    });
}

var poolingFunctions = {
    avg: avgPoolingKernel,
    min: minPoolingKernel,
    max: maxPoolingKernel,
    dualMinMax: dualMinMaxPoolingKernel
};

function resizeImageArrayWithAdaptivePooling(input2DArray, outputWidth, outputHeight, subArrayPoolingFunction) {
    var result = [];
    for (var h = 0; h < outputHeight; h++) {
        var row = [];
        for (var w = 0; w < outputWidth; w++) {
            var startW = Math.floor((w * input2DArray[1].length) / outputWidth);
            var endW = Math.ceil(((w + 1) * input2DArray[1].length) / outputWidth);
            var startH = Math.floor((h * input2DArray.length) / outputHeight);
            var endH = Math.ceil(((h + 1) * input2DArray.length) / outputHeight);
            var kernelPixels = [];
            for (var k_w = startW; k_w < endW; k_w++) {
                for (var k_h = startH; k_h < endH; k_h++) {
                    kernelPixels.push(input2DArray[k_h][k_w]);
                }
            }
            row.push(subArrayPoolingFunction(kernelPixels));
        }
        result.push(row);
    }
    return result;
}

function resizeImagePixelsWithAdaptivePooling(inputPixels, inputImageWidth, outputWidth, outputHeight, subArrayPoolingFunction) {
    var pixelMatrix = convertPixelArrayToMatrix(inputPixels, inputImageWidth);
    var outputPixels = resizeImageArrayWithAdaptivePooling(pixelMatrix, outputWidth, outputHeight, subArrayPoolingFunction);
    var result = [];
    outputPixels.forEach(function(row) {
        row.forEach(function(pixel) {
            pixel.forEach(function(channel) { result.push(channel); });
            result.push(255);
        });
    });
    return new Uint8ClampedArray(result);
}

// ============================================
// Variable pixel piece placement
// ============================================

function getSetPixelMatrixFromInputMatrix(inputMatrix, isSetFunction) {
    var result = [];
    for (var i = 0; i < inputMatrix.length; i++) {
        result[i] = [];
        for (var j = 0; j < inputMatrix[0].length; j++) {
            result[i][j] = isSetFunction(inputMatrix[i][j], i, j);
        }
    }
    return result;
}

function getRequiredPartMatrixFromSetPixelMatrix(setPixelMatrix, partDimensions, boundaryWidth) {
    if (boundaryWidth === undefined) boundaryWidth = null;
    var result = [];
    for (var i = 0; i < setPixelMatrix.length; i++) {
        result[i] = [];
        for (var j = 0; j < setPixelMatrix[0].length; j++) {
            result[i][j] = null;
        }
    }

    partDimensions = JSON.parse(JSON.stringify(partDimensions));
    partDimensions.sort(function(part1, part2) {
        return part2[0] * part2[1] - part2[0] * 0.01 - part1[0] * part1[1] + part1[0] * 0.01;
    });

    for (var i = 0; i < partDimensions.length; i++) {
        var part = partDimensions[i];
        for (var row = 0; row < setPixelMatrix.length - part[0] + 1; row++) {
            for (var col = 0; col < setPixelMatrix[0].length - part[1] + 1; col++) {
                var canPlacePiece = true;
                for (var pRow = 0; pRow < part[0] && canPlacePiece; pRow++) {
                    for (var pCol = 0; pCol < part[1] && canPlacePiece; pCol++) {
                        canPlacePiece = canPlacePiece && !setPixelMatrix[row + pRow][col + pCol];
                    }
                }
                if (boundaryWidth && boundaryWidth > 1) {
                    canPlacePiece = canPlacePiece &&
                        Math.floor(row / boundaryWidth) === Math.floor((row + part[0] - 1) / boundaryWidth) &&
                        Math.floor(col / boundaryWidth) === Math.floor((col + part[1] - 1) / boundaryWidth);
                }
                if (canPlacePiece) {
                    result[row][col] = [part[0], part[1]];
                    for (var pRow = 0; pRow < part[0]; pRow++) {
                        for (var pCol = 0; pCol < part[1]; pCol++) {
                            setPixelMatrix[row + pRow][col + pCol] = true;
                        }
                    }
                }
            }
        }
    }
    return result;
}

// ============================================
// BrickLink wanted list XML generation
// ============================================

var PLATE_DIMENSIONS_DEPTH_SEPERATOR = " X ";

function getPlateDimensionsString(part) {
    return part[0] < part[1]
        ? part[0] + PLATE_DIMENSIONS_DEPTH_SEPERATOR + part[1]
        : part[1] + PLATE_DIMENSIONS_DEPTH_SEPERATOR + part[0];
}

var TILE_DIMENSIONS_TO_PART_ID = {
    "1 X 1": "3070b", "1 X 2": "3069b", "1 X 3": 63864, "1 X 4": 2431,
    "1 X 6": 6636, "1 X 8": 4162, "2 X 2": "3068b", "2 X 3": 26603,
    "2 X 4": 87079, "2 X 6": 69729
};

var PLATE_DIMENSIONS_TO_PART_ID = {
    "1 X 1": 3024, "1 X 2": 3023, "1 X 3": 3623, "1 X 4": 3710,
    "1 X 6": 3666, "1 X 8": 3460, "2 X 2": 3022, "2 X 3": 3021,
    "2 X 4": 3020, "2 X 6": 3795, "2 X 8": 3034, "4 X 4": 3031,
    "4 X 8": 3035, "4 X 10": 3030
};

var BRICK_DIMENSIONS_TO_PART_ID = {
    "1 X 1": 3005, "1 X 2": 3004, "1 X 3": 3622, "1 X 4": 3010,
    "1 X 6": 3009, "1 X 8": 3008, "2 X 2": 3003, "2 X 3": 3002,
    "2 X 4": 3001, "2 X 6": 2456, "2 X 8": 3007
};

var DEFAULT_DISABLED_DEPTH_PLATES = ["4 X 10", "4 X 8"];

var DEPTH_FILLER_PARTS = Object.keys(PLATE_DIMENSIONS_TO_PART_ID).map(function(part) {
    return part.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR).map(function(d) { return Number(d); });
});
Object.keys(PLATE_DIMENSIONS_TO_PART_ID).forEach(function(part) {
    var splitPart = part.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
    if (splitPart[0] !== splitPart[1]) {
        DEPTH_FILLER_PARTS.push([Number(splitPart[1]), Number(splitPart[0])]);
    }
});

// These functions need HEX_TO_COLOR_NAME and COLOR_NAME_TO_ID from bricklink-colors.js
// They'll be available as globals when loaded in the worker via importScripts

function getDepthWantedListXML(depthPartsMap) {
    var items = Object.keys(depthPartsMap).map(function(part) {
        return '<ITEM>\n      <ITEMTYPE>P</ITEMTYPE>\n      <ITEMID>' + PLATE_DIMENSIONS_TO_PART_ID[part] +
            '</ITEMID>\n      <COLOR>11</COLOR>\n      <MINQTY>' + depthPartsMap[part] + '</MINQTY>\n    </ITEM>';
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n  <INVENTORY>\n    \n' + items.join("\n") + '\n\n  </INVENTORY>';
}

function getWantedListXML(studMap, partID) {
    var items = Object.keys(studMap).map(function(stud) {
        return '<ITEM>\n      <ITEMTYPE>P</ITEMTYPE>\n      <ITEMID>' + partID +
            '</ITEMID>\n      <COLOR>' + COLOR_NAME_TO_ID[HEX_TO_COLOR_NAME[stud]] +
            '</COLOR>\n      <MINQTY>' + studMap[stud] + '</MINQTY>\n    </ITEM>';
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n  <INVENTORY>\n    \n' + items.join("\n") + '\n\n  </INVENTORY>';
}

function getSubPixelArray(pixelArray, index, width, plateWidth) {
    var result = [];
    var horizontalOffset = (index * plateWidth) % width;
    var verticalOffset = plateWidth * Math.floor((index * plateWidth) / width);
    for (var i = 0; i < pixelArray.length / 4; i++) {
        var iHorizontal = i % width;
        var iVertical = Math.floor(i / width);
        if (horizontalOffset <= iHorizontal && iHorizontal < horizontalOffset + plateWidth &&
            verticalOffset <= iVertical && iVertical < verticalOffset + plateWidth) {
            for (var p = 0; p < 4; p++) { result.push(pixelArray[4 * i + p]); }
        }
    }
    return result;
}

function getSubPixelMatrix(pixelMatrix, horizontalOffset, verticalOffset, width, height) {
    var result = [];
    for (var iHorizontal = 0; iHorizontal < pixelMatrix[0].length; iHorizontal++) {
        for (var iVertical = 0; iVertical < pixelMatrix.length; iVertical++) {
            if (horizontalOffset <= iHorizontal && iHorizontal < horizontalOffset + width &&
                verticalOffset <= iVertical && iVertical < verticalOffset + height) {
                var targetVertical = iVertical - verticalOffset;
                var targetHorizontal = iHorizontal - horizontalOffset;
                result[targetVertical] = result[targetVertical] || [];
                result[targetVertical][targetHorizontal] = pixelMatrix[iVertical][iHorizontal];
            }
        }
    }
    return result;
}

function getUsedDepthPartsMap(perDepthLevelMatrices) {
    var result = {};
    perDepthLevelMatrices.forEach(function(matrix) {
        matrix.forEach(function(row) {
            row.forEach(function(part) {
                if (part != null) {
                    result[getPlateDimensionsString(part)] = (result[getPlateDimensionsString(part)] || 0) + 1;
                }
            });
        });
    });
    return result;
}
