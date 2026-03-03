/**
 * BRICKONAS Mosaic Configurator - Main Application Controller
 * Replaces the original 3149-line index.js with Web Worker architecture.
 *
 * Key changes:
 * - Heavy computation runs in Web Worker (filter, quantize, correct)
 * - Only 3 persistent canvases (crop, preview, result)
 * - Pixel data stored in state objects, not hidden canvases
 * - Native CIEDE2000 replaces d3.js dependency
 * - MAX_CANVAS_DIMENSION reduced to 2048 for memory safety at 288x288
 */

// ============================================
// Constants
// ============================================

var SERIALIZE_EDGE_LENGTH = 512;
var PIXEL_WIDTH_CM = 0.8;
var DEBOUNCE_DELAY = 150;

// ============================================
// State
// ============================================

var inputImage = null;
var inputImageCropper = null;
var targetResolution = [48, 48];
var plateWidth = 16;
var plateHeight = 16;

var quantizationAlgorithm = 'twoPhase';
var colorDistanceMethodName = defaultDistanceFunctionKey; // from color-distance.js
var selectedPixelPartNumber = PIXEL_TYPE_OPTIONS[0].number;
var selectedInterpolationAlgorithm = 'avg';
var selectedTiebreakTechnique = 'alternatingmod';

var DEFAULT_STUD_MAP_KEY = 'all_tile_colors';
var selectedStudMap = {};
var selectedSortedStuds = [];
var selectedFullSetName = '';

var overridePixelArray = [];
var overrideDepthPixelArray = [];
var selectedPaintbrushTool = 'paintbrush';
var activePaintbrushHex = null;
var wasPaintbrushUsed = false;
var step3CanvasHoveredPixel = null;

// Step result caches (pixel arrays in memory, not on canvases)
var stepResults = {
    inputPixels: null,        // 512x512 serialized input
    croppedPixels: null,      // Cropped from step 1
    croppedWidth: 0,
    croppedHeight: 0,
    filteredPixels: null,     // After HSV/brightness/contrast + resize
    quantizedPixels: null,    // After color quantization
    correctedPixels: null,    // After piece availability correction
    studCounts: null,         // { hex: count } of final result
    quantizedForEraser: null, // Pre-override quantized (for eraser tool)
    variablePixelPieceDims: null
};

var stepProcessed = { 1: false, 2: false, 3: false, 4: false };
var currentStep = 1;
var isProcessing = false;

// Depth state
var depthEnabled = false;
var depthPixels = null;

// ============================================
// Web Worker
// ============================================

var mosaicWorker = new Worker('js/mosaic-worker.js');
var workerCallId = 0;
var workerCallbacks = {};

mosaicWorker.onmessage = function(e) {
    var msg = e.data;
    if (msg.type === 'progress') {
        updateProgressBar(msg.percent, msg.message);
    } else if (msg.type === 'error') {
        console.error('Worker error:', msg.message);
        enableInteraction();
    } else {
        // Result message - resolve the corresponding promise
        var cb = workerCallbacks[msg.type];
        if (cb) {
            delete workerCallbacks[msg.type];
            cb(msg);
        }
    }
};

function workerCall(message, transferables) {
    return new Promise(function(resolve) {
        var resultType = message.type + 'Result';
        workerCallbacks[resultType] = resolve;
        if (transferables) {
            mosaicWorker.postMessage(message, transferables);
        } else {
            mosaicWorker.postMessage(message);
        }
    });
}

// ============================================
// Utility
// ============================================

function debounce(func, wait) {
    var timeout;
    return function() {
        var args = arguments;
        var context = this;
        clearTimeout(timeout);
        timeout = setTimeout(function() { func.apply(context, args); }, wait);
    };
}

function $(id) { return document.getElementById(id); }

function isBleedthroughEnabled() {
    return [PIXEL_TYPE_OPTIONS[0].number, PIXEL_TYPE_OPTIONS[1].number].indexOf(selectedPixelPartNumber) !== -1;
}

function isInfiniteCountEnabled() {
    var cb = $('infinite-piece-count-check');
    if (!cb) return true;
    return cb.checked ||
        !!quantizationAlgorithmToTraditionalDitheringKernel[quantizationAlgorithm] ||
        ("" + selectedPixelPartNumber).match("^variable.*$");
}

// ============================================
// UI Helpers
// ============================================

function showLoading(message) {
    var overlay = $('loading-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        var statusText = $('loading-status-text');
        if (statusText) statusText.textContent = message || '';
    }
    isProcessing = true;
}

function hideLoading() {
    var overlay = $('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
    isProcessing = false;
}

function updateProgressBar(percent, message) {
    var bar = $('pdf-progress-bar');
    if (bar) bar.style.width = percent + '%';
    var statusText = $('loading-status-text');
    if (statusText && message) statusText.textContent = message;
}

function disableInteraction() {
    showLoading(t('loadingProcessing'));
    document.querySelectorAll('input, button, .btn, select').forEach(function(el) {
        el.disabled = true;
    });
    if (inputImageCropper) {
        try { inputImageCropper.disable(); } catch(e) {}
    }
}

function enableInteraction() {
    hideLoading();
    document.querySelectorAll('input, button, .btn, select').forEach(function(el) {
        if (!el.classList.contains('always-disabled')) {
            el.disabled = false;
        }
    });
    if (inputImageCropper) {
        try { inputImageCropper.enable(); } catch(e) {}
    }
    // Ensure upload button is enabled
    var uploadBtn = $('input-image-selector');
    if (uploadBtn) uploadBtn.disabled = false;
}

function invalidateStepsFrom(stepNumber) {
    for (var i = stepNumber; i <= 4; i++) {
        stepProcessed[i] = false;
    }
}

function resetOverrideArrays() {
    var totalPixels = targetResolution[0] * targetResolution[1] * 4;
    overridePixelArray = new Array(totalPixels).fill(null);
    overrideDepthPixelArray = new Array(totalPixels).fill(null);
}

// ============================================
// Image Loading
// ============================================

function handleInputImage(imgSrc) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        inputImage = img;

        // Serialize to 512x512
        var serializeCanvas = document.createElement('canvas');
        serializeCanvas.width = SERIALIZE_EDGE_LENGTH;
        serializeCanvas.height = SERIALIZE_EDGE_LENGTH;
        var ctx = serializeCanvas.getContext('2d');

        // Fill white background (handle transparency)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SERIALIZE_EDGE_LENGTH, SERIALIZE_EDGE_LENGTH);
        ctx.drawImage(img, 0, 0, SERIALIZE_EDGE_LENGTH, SERIALIZE_EDGE_LENGTH);

        stepResults.inputPixels = getPixelArrayFromCanvas(serializeCanvas);
        serializeCanvas.width = 0;
        serializeCanvas.height = 0;

        // Show the configurator UI
        $('image-input-card').style.display = 'none';
        $('steps-row').style.display = '';

        resetOverrideArrays();
        initializeCropper();
    };
    img.src = imgSrc;
}

function handleFileInput(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(event) {
        handleInputImage(event.target.result);
    };
    reader.readAsDataURL(file);
}

// ============================================
// Cropper
// ============================================

function initializeCropper() {
    var cropCanvas = $('step-1-canvas-upscaled');
    if (!cropCanvas) return;

    // Draw input image onto crop canvas
    cropCanvas.width = SERIALIZE_EDGE_LENGTH;
    cropCanvas.height = SERIALIZE_EDGE_LENGTH;
    drawPixelsOnCanvas(stepResults.inputPixels, cropCanvas);

    // Destroy old cropper
    if (inputImageCropper) {
        try { inputImageCropper.destroy(); } catch(e) {}
    }

    inputImageCropper = new Cropper(cropCanvas, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        checkCrossOrigin: false,
        ready: function() {
            runStep1();
        }
    });
}

// ============================================
// Step 1: Crop
// ============================================

function runStep1() {
    if (!stepResults.inputPixels) return;

    invalidateStepsFrom(2);
    stepProcessed[1] = true;

    updateStudCountText();
}

// ============================================
// Step 2: Filter (via Worker)
// ============================================

async function runStep2() {
    if (!stepResults.inputPixels || !inputImageCropper) return;

    disableInteraction();
    invalidateStepsFrom(3);

    showLoading(t('loadingProcessing'));

    // Get cropped region from Cropper.js
    var croppedCanvas = inputImageCropper.getCroppedCanvas({
        width: SERIALIZE_EDGE_LENGTH,
        height: SERIALIZE_EDGE_LENGTH,
        imageSmoothingQuality: 'high'
    });

    if (!croppedCanvas) {
        enableInteraction();
        return;
    }

    var croppedPixels = getPixelArrayFromCanvas(croppedCanvas);
    croppedCanvas.width = 0;
    croppedCanvas.height = 0;

    stepResults.croppedPixels = croppedPixels;
    stepResults.croppedWidth = SERIALIZE_EDGE_LENGTH;
    stepResults.croppedHeight = SERIALIZE_EDGE_LENGTH;

    // Read slider values
    var hue = parseInt($('hue-slider').value) || 0;
    var sat = parseInt($('saturation-slider').value) || 0;
    var val = parseInt($('value-slider').value) || 0;
    var brightness = parseInt($('brightness-slider').value) || 0;
    var contrast = parseInt($('contrast-slider').value) || 0;

    // Send to worker for resize + filter
    var pixelsCopy = new Uint8ClampedArray(croppedPixels);
    var result = await workerCall({
        type: 'filter',
        pixels: pixelsCopy,
        inputWidth: SERIALIZE_EDGE_LENGTH,
        targetW: targetResolution[0],
        targetH: targetResolution[1],
        hue: hue,
        sat: sat,
        val: val,
        brightness: brightness,
        contrast: contrast,
        interpolation: selectedInterpolationAlgorithm
    }, [pixelsCopy.buffer]);

    stepResults.filteredPixels = result.pixels;

    // Draw preview
    var previewCanvas = $('preview-canvas');
    if (previewCanvas) {
        var sf = getScalingFactor(targetResolution[0], targetResolution[1]);
        previewCanvas.width = targetResolution[0] * sf;
        previewCanvas.height = targetResolution[1] * sf;
        var ctx = previewCanvas.getContext('2d');

        // Draw upscaled pixel image
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetResolution[0];
        tempCanvas.height = targetResolution[1];
        drawPixelsOnCanvas(result.pixels, tempCanvas);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
        tempCanvas.width = 0;
        tempCanvas.height = 0;

        // Show preview area
        var previewArea = $('preview-canvas-area');
        if (previewArea) previewArea.style.display = '';
    }

    stepProcessed[2] = true;
    enableInteraction();
}

// ============================================
// Step 3: Quantize (via Worker)
// ============================================

async function runStep3() {
    if (!stepResults.filteredPixels) return;

    disableInteraction();
    invalidateStepsFrom(4);

    showLoading(t('loadingMapping'));

    var bleedthrough = isBleedthroughEnabled();
    var assumeInfinite = isInfiniteCountEnabled();

    // Clone pixels for worker transfer
    var pixelsCopy = new Uint8ClampedArray(stepResults.filteredPixels);

    // Prepare overrides - convert null array to transferable format
    var overridesForWorker = null;
    if (overridePixelArray.some(function(v) { return v !== null; })) {
        overridesForWorker = overridePixelArray.slice();
    }

    var result = await workerCall({
        type: 'quantize',
        pixels: pixelsCopy,
        width: targetResolution[0],
        height: targetResolution[1],
        studMap: selectedStudMap,
        algorithm: quantizationAlgorithm,
        distanceMethod: colorDistanceMethodName,
        bleedthrough: bleedthrough,
        overrides: overridesForWorker,
        assumeInfinite: assumeInfinite
    }, [pixelsCopy.buffer]);

    stepResults.quantizedPixels = result.pixels;
    stepResults.studCounts = result.studCounts;
    stepResults.quantizedForEraser = new Uint8ClampedArray(result.pixels);

    // Draw stud visualization on preview canvas
    var previewCanvas = $('preview-canvas');
    if (previewCanvas) {
        var sf = getScalingFactor(targetResolution[0], targetResolution[1]);
        drawStudImageOnCanvas(result.pixels, targetResolution[0], sf, previewCanvas, selectedPixelPartNumber, stepResults.variablePixelPieceDims);

        // Show preview area
        var previewArea = $('preview-canvas-area');
        if (previewArea) previewArea.style.display = '';
    }

    stepProcessed[3] = true;
    enableInteraction();
}

// ============================================
// Step 4: Correct + Final Result
// ============================================

async function runStep4() {
    if (!stepResults.quantizedPixels) return;

    disableInteraction();
    showLoading(t('loadingProcessing'));

    var canSidestep = isInfiniteCountEnabled() ||
        !!quantizationAlgorithmToTraditionalDitheringKernel[quantizationAlgorithm] ||
        ("" + selectedPixelPartNumber).match("^variable.*$");

    var finalPixels;
    var finalStudCounts;

    if (canSidestep) {
        // No correction needed
        finalPixels = stepResults.quantizedPixels;
        finalStudCounts = stepResults.studCounts;
    } else {
        // Run correction via worker
        var quantizedCopy = new Uint8ClampedArray(stepResults.quantizedPixels);
        var filteredCopy = new Uint8ClampedArray(stepResults.filteredPixels);

        var overridesForWorker = null;
        if (overridePixelArray.some(function(v) { return v !== null; })) {
            overridesForWorker = overridePixelArray.slice();
        }

        var result = await workerCall({
            type: 'correct',
            quantizedPixels: quantizedCopy,
            originalPixels: filteredCopy,
            width: targetResolution[0],
            studMap: selectedStudMap,
            algorithm: quantizationAlgorithm,
            distanceMethod: colorDistanceMethodName,
            bleedthrough: isBleedthroughEnabled(),
            overrides: overridesForWorker,
            tieResolutionMethod: selectedTiebreakTechnique,
            colorTieGroupingFactor: 1
        }, [quantizedCopy.buffer, filteredCopy.buffer]);

        finalPixels = result.pixels;
        finalStudCounts = result.studCounts;
    }

    stepResults.correctedPixels = finalPixels;
    stepResults.studCounts = finalStudCounts;

    // Draw final result on result canvas
    var resultCanvas = $('result-canvas');
    if (resultCanvas) {
        var sf = getScalingFactor(targetResolution[0], targetResolution[1]);
        drawStudImageOnCanvas(finalPixels, targetResolution[0], sf, resultCanvas, selectedPixelPartNumber, stepResults.variablePixelPieceDims);
    }

    // Build pieces table
    buildPiecesTable(finalStudCounts);

    stepProcessed[4] = true;
    enableInteraction();
}

// ============================================
// Pieces Table
// ============================================

function buildPiecesTable(studCounts) {
    var tbody = $('studs-used-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    var totalPieces = 0;
    selectedSortedStuds.forEach(function(hex) {
        var count = studCounts[hex] || 0;
        if (count === 0) return;
        totalPieces += count;

        var tr = document.createElement('tr');
        var colorName = HEX_TO_COLOR_NAME[hex] || hex;

        tr.innerHTML = '<td><div style="width:20px;height:20px;border-radius:50%;background:' + hex + ';border:1px solid #ccc;display:inline-block;vertical-align:middle;"></div></td>' +
            '<td>' + translateColor(colorName) + '</td>' +
            '<td>' + count + '</td>';
        tbody.appendChild(tr);
    });

    // Update total
    var totalEl = $('total-pieces-count');
    if (totalEl) totalEl.textContent = totalPieces;

    // Physical dimensions
    var dimEl = $('physical-dimensions');
    if (dimEl) {
        var w = (targetResolution[0] * PIXEL_WIDTH_CM).toFixed(1);
        var h = (targetResolution[1] * PIXEL_WIDTH_CM).toFixed(1);
        dimEl.textContent = w + ' x ' + h + ' cm';
    }

    // Color count
    var colorCountEl = $('stud-count-result');
    if (colorCountEl) {
        var colorCount = 0;
        selectedSortedStuds.forEach(function(hex) {
            if (studCounts[hex] && studCounts[hex] > 0) colorCount++;
        });
        colorCountEl.textContent = colorCount;
    }
}

// ============================================
// Stud Map Management
// ============================================

function updateStudCountText() {
    var el = $('stud-count-text');
    if (el) {
        el.textContent = selectedSortedStuds.length + ' ' + t('colors');
    }
}

function populateStudTable(studMap) {
    var tbody = $('custom-stud-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    selectedStudMap = {};
    selectedSortedStuds = [];

    var sortedKeys = Object.keys(studMap).sort();
    sortedKeys.forEach(function(hex) {
        selectedStudMap[hex] = studMap[hex];
        selectedSortedStuds.push(hex);
        addStudRow(hex, studMap[hex]);
    });

    updateStudCountText();
}

function addStudRow(hex, count) {
    var tbody = $('custom-stud-table-body');
    if (!tbody) return;

    var tr = document.createElement('tr');
    tr.dataset.hex = hex;
    var colorName = HEX_TO_COLOR_NAME[hex] || hex;

    tr.innerHTML = '<td><div class="stud-color-swatch" style="background:' + hex + ';"></div></td>' +
        '<td class="stud-color-name">' + translateColor(colorName) + '</td>' +
        '<td><input type="number" class="piece-count-input" value="' + count + '" min="0" max="99999"></td>' +
        '<td><button class="btn btn-sm stud-remove-btn">&times;</button></td>';

    tr.querySelector('.stud-remove-btn').addEventListener('click', function() {
        tr.remove();
        readStudTableIntoState();
        if (stepProcessed[1]) runStep1();
    });

    tr.querySelector('.piece-count-input').addEventListener('change', function() {
        readStudTableIntoState();
        if (stepProcessed[1]) runStep1();
    });

    tbody.appendChild(tr);
}

function readStudTableIntoState() {
    selectedStudMap = {};
    selectedSortedStuds = [];
    var rows = document.querySelectorAll('#custom-stud-table-body tr');
    rows.forEach(function(row) {
        var hex = row.dataset.hex;
        var countInput = row.querySelector('.piece-count-input');
        var count = parseInt(countInput.value) || 0;
        if (hex && count > 0) {
            selectedStudMap[hex] = count;
            selectedSortedStuds.push(hex);
        }
    });
    updateStudCountText();
}

function loadStudMapByKey(key) {
    if (!STUD_MAPS[key]) return;
    var map = STUD_MAPS[key];
    selectedFullSetName = map.officialName || key;
    populateStudTable(map.studMap);
    invalidateStepsFrom(2);
    if (stepProcessed[1]) runStep1();
}

function mixInStudMap(studMap) {
    Object.keys(studMap).forEach(function(hex) {
        if (selectedStudMap[hex]) {
            selectedStudMap[hex] += studMap[hex];
            // Update existing row count
            var row = document.querySelector('#custom-stud-table-body tr[data-hex="' + hex + '"]');
            if (row) {
                row.querySelector('.piece-count-input').value = selectedStudMap[hex];
            }
        } else {
            selectedStudMap[hex] = studMap[hex];
            selectedSortedStuds.push(hex);
            addStudRow(hex, studMap[hex]);
        }
    });
    updateStudCountText();
    invalidateStepsFrom(2);
    if (stepProcessed[1]) runStep1();
}

// ============================================
// Stud Map Dropdown Population
// ============================================

function populateStudMapDropdowns() {
    var startingOptions = $('select-starting-custom-stud-map-options');
    var mixInOptions = $('mix-in-stud-map-options');

    STUD_MAP_KEYS.forEach(function(key) {
        if (key === 'DIVIDER') return;
        var map = STUD_MAPS[key];
        if (!map) return;

        var displayName = map.officialName || key;

        // Starting dropdown
        if (startingOptions) {
            var option = document.createElement('a');
            option.className = 'dropdown-item';
            option.href = '#';
            option.textContent = displayName;
            option.addEventListener('click', function(e) {
                e.preventDefault();
                loadStudMapByKey(key);
            });
            startingOptions.appendChild(option);
        }

        // Mix-in dropdown
        if (mixInOptions) {
            var option2 = document.createElement('a');
            option2.className = 'dropdown-item';
            option2.href = '#';
            option2.textContent = displayName;
            option2.addEventListener('click', function(e) {
                e.preventDefault();
                mixInStudMap(map.studMap);
            });
            mixInOptions.appendChild(option2);
        }
    });
}

// ============================================
// Paintbrush Tool (on preview-canvas during step 3)
// ============================================

function setupPaintbrushHandlers() {
    var canvas = $('preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', function(e) {
        if (currentStep !== 1 || !stepProcessed[3]) return;
        wasPaintbrushUsed = true;
        activePaintbrushHex = getSelectedPaintbrushColor();
        onPaintbrushAction(e);
    });

    canvas.addEventListener('mousemove', function(e) {
        if (activePaintbrushHex) onPaintbrushAction(e);
    });

    canvas.addEventListener('mouseup', onPaintbrushRelease);
    canvas.addEventListener('mouseleave', onPaintbrushRelease);
}

function getSelectedPaintbrushColor() {
    // Read from the color selector
    var btn = document.querySelector('#paintbrush-color-selector .stud-color-swatch');
    if (btn) {
        var bg = btn.style.backgroundColor;
        if (bg) {
            var match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) return rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
        }
    }
    return '#42c0fb'; // default
}

function onPaintbrushAction(e) {
    var canvas = $('preview-canvas');
    if (!canvas || !stepResults.quantizedPixels) return;

    var rect = canvas.getBoundingClientRect();
    var sf = getScalingFactor(targetResolution[0], targetResolution[1]);
    var col = Math.floor((e.clientX - rect.left) / (2 * sf / 2));
    var row = Math.floor((e.clientY - rect.top) / (2 * sf / 2));

    if (col < 0 || col >= targetResolution[0] || row < 0 || row >= targetResolution[1]) return;

    var idx = (row * targetResolution[0] + col) * 4;

    if (selectedPaintbrushTool === 'paintbrush' && activePaintbrushHex) {
        var rgb = hexToRgb(activePaintbrushHex);
        overridePixelArray[idx] = rgb[0];
        overridePixelArray[idx + 1] = rgb[1];
        overridePixelArray[idx + 2] = rgb[2];
        overridePixelArray[idx + 3] = 255;

        // Draw directly on canvas for instant feedback
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = activePaintbrushHex;
        var radius = sf / 2;
        ctx.beginPath();
        ctx.arc(col * sf + radius, row * sf + radius, radius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (selectedPaintbrushTool === 'eraser') {
        overridePixelArray[idx] = null;
        overridePixelArray[idx + 1] = null;
        overridePixelArray[idx + 2] = null;
        overridePixelArray[idx + 3] = null;
    }
}

function onPaintbrushRelease() {
    if (activePaintbrushHex && wasPaintbrushUsed) {
        activePaintbrushHex = null;
        wasPaintbrushUsed = false;
        // Re-run step 3 to get proper stud rendering with overrides
        invalidateStepsFrom(3);
        runStep3();
    }
    activePaintbrushHex = null;
}

// ============================================
// Step Navigation (2-step visual stepper)
// ============================================

function updateStepper(activeVisualStep) {
    document.querySelectorAll('.mosaic-stepper-step').forEach(function(step) {
        var stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum < activeVisualStep) step.classList.add('completed');
        else if (stepNum === activeVisualStep) step.classList.add('active');
    });
}

async function goToVisualStep(visualStep) {
    if (isProcessing) return;

    if (visualStep === 1) {
        // Configure step
        currentStep = 1;
        $('step-1-container').style.display = '';
        $('step-4-container').style.display = 'none';
        updateStepper(1);
        // Cropper.js doesn't render properly when container was hidden; trigger resize
        if (inputImageCropper) {
            setTimeout(function() {
                try { inputImageCropper.resize(); } catch(e) {}
            }, 50);
        }
    } else if (visualStep === 4) {
        // Result step - need to process steps 2, 3, 4
        currentStep = 4;
        $('step-1-container').style.display = 'none';
        $('step-4-container').style.display = '';
        updateStepper(4);

        // Run pipeline
        if (!stepProcessed[2]) await runStep2();
        if (!stepProcessed[3]) await runStep3();
        if (!stepProcessed[4]) await runStep4();
    }
}

// ============================================
// PDF Download
// ============================================

async function handleDownloadInstructions() {
    if (!stepResults.correctedPixels && !stepResults.quantizedPixels) return;

    var finalPixels = stepResults.correctedPixels || stepResults.quantizedPixels;
    var isHQ = $('high-quality-instructions-check') ? $('high-quality-instructions-check').checked : false;

    // Create a preview canvas for the title page
    var previewCanvas = document.createElement('canvas');
    var sf = getScalingFactor(targetResolution[0], targetResolution[1]);
    drawStudImageOnCanvas(finalPixels, targetResolution[0], sf, previewCanvas, selectedPixelPartNumber, stepResults.variablePixelPieceDims);

    var pdfProgress = $('pdf-progress-container');
    var pdfBtn = $('download-instructions-button');
    if (pdfProgress) pdfProgress.hidden = false;
    if (pdfBtn) pdfBtn.hidden = true;

    await generateInstructions({
        pixelArray: finalPixels,
        targetResolution: targetResolution,
        plateWidth: plateWidth,
        plateHeight: plateHeight,
        selectedSortedStuds: selectedSortedStuds,
        pixelType: selectedPixelPartNumber,
        variablePixelPieceDimensions: stepResults.variablePixelPieceDims,
        previewCanvas: previewCanvas,
        isHighQuality: isHQ,
        baseScalingFactor: BASE_SCALING_FACTOR,
        pixelWidthCm: PIXEL_WIDTH_CM,
        onProgress: function(fraction) {
            var bar = $('pdf-progress-bar');
            if (bar) bar.style.width = (fraction * 100) + '%';
        }
    });

    previewCanvas.width = 0;
    previewCanvas.height = 0;

    if (pdfProgress) pdfProgress.hidden = true;
    if (pdfBtn) pdfBtn.hidden = false;
}

// ============================================
// BrickLink Export
// ============================================

function handleBricklinkExport() {
    var finalPixels = stepResults.correctedPixels || stepResults.quantizedPixels;
    if (!finalPixels) return;

    var studCounts = getUsedPixelsStudMap(finalPixels);
    var partID = selectedPixelPartNumber;
    var xml = getWantedListXML(studCounts, partID);

    // Copy to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(xml).then(function() {
            alert(t('bricklinkExportSuccess') || 'BrickLink XML copied to clipboard!');
        });
    } else {
        // Fallback: create download
        var blob = new Blob([xml], { type: 'application/xml' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'bricklink-wanted-list.xml';
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================
// Iframe Communication
// ============================================

var isInIframe = window.parent !== window;

if (isInIframe) {
    document.documentElement.classList.add('in-iframe');
}

function getContentHeight() {
    var mosaicPage = document.querySelector('.mosaic-page');
    if (mosaicPage) {
        var rect = mosaicPage.getBoundingClientRect();
        return Math.ceil(rect.bottom);
    }
    return document.documentElement.scrollHeight;
}

function notifyParentResize() {
    if (isInIframe) {
        window.parent.postMessage({ type: 'mosaic-resize', height: getContentHeight() }, '*');
    }
}

if (typeof ResizeObserver !== 'undefined') {
    var resizeObserver = new ResizeObserver(notifyParentResize);
    resizeObserver.observe(document.body);
}
window.addEventListener('load', notifyParentResize);
setTimeout(notifyParentResize, 500);
setTimeout(notifyParentResize, 1500);

// Language from URL parameter
(function() {
    var params = new URLSearchParams(window.location.search);
    var lang = params.get('lang');
    if (lang === 'en' || lang === 'de') {
        localStorage.setItem('language', lang);
    }
})();

// ============================================
// Initialization
// ============================================

function initApp() {
    // Apply i18n
    if (typeof updatePageLanguage === 'function') updatePageLanguage();

    // Read initial resolution from sliders
    var wSlider = $('width-slider');
    var hSlider = $('height-slider');
    if (wSlider) targetResolution[0] = parseInt(wSlider.value) || 48;
    if (hSlider) targetResolution[1] = parseInt(hSlider.value) || 48;

    // Initialize stud map
    if (STUD_MAPS && STUD_MAPS[DEFAULT_STUD_MAP_KEY]) {
        loadStudMapByKey(DEFAULT_STUD_MAP_KEY);
    }

    // Populate dropdowns
    populateStudMapDropdowns();

    resetOverrideArrays();

    // Wire up event handlers
    wireEventHandlers();

    // Enable upload button
    enableInteraction();
}

function wireEventHandlers() {
    // File input
    var fileInput = $('input-image-selector-hidden');
    if (fileInput) fileInput.addEventListener('change', handleFileInput);

    var uploadBtn = $('input-image-selector');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            $('input-image-selector-hidden').click();
        });
    }

    // Paste
    document.addEventListener('paste', function(e) {
        var items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                var blob = items[i].getAsFile();
                var reader = new FileReader();
                reader.onload = function(event) { handleInputImage(event.target.result); };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });

    // Resolution sliders
    var wSlider = $('width-slider');
    var hSlider = $('height-slider');

    var debouncedResize = debounce(function() {
        resetOverrideArrays();
        invalidateStepsFrom(2);
        if (stepProcessed[1]) runStep1();
    }, DEBOUNCE_DELAY);

    if (wSlider) {
        wSlider.addEventListener('input', function() {
            targetResolution[0] = parseInt(this.value);
            var txt = $('width-text');
            if (txt) txt.textContent = this.value;
            debouncedResize();
        });
        wSlider.addEventListener('change', function() {
            targetResolution[0] = parseInt(this.value);
            resetOverrideArrays();
            invalidateStepsFrom(2);
            if (stepProcessed[1]) runStep1();
        });
    }

    if (hSlider) {
        hSlider.addEventListener('input', function() {
            targetResolution[1] = parseInt(this.value);
            var txt = $('height-text');
            if (txt) txt.textContent = this.value;
            debouncedResize();
        });
        hSlider.addEventListener('change', function() {
            targetResolution[1] = parseInt(this.value);
            resetOverrideArrays();
            invalidateStepsFrom(2);
            if (stepProcessed[1]) runStep1();
        });
    }

    // Width/height step selects
    var wStep = $('width-step-select');
    var hStep = $('height-step-select');
    if (wStep) {
        wStep.addEventListener('change', function() {
            var step = parseInt(this.value);
            if (wSlider) {
                wSlider.step = step;
                wSlider.value = Math.round(parseInt(wSlider.value) / step) * step;
                targetResolution[0] = parseInt(wSlider.value);
                var txt = $('width-text');
                if (txt) txt.textContent = wSlider.value;
            }
            plateWidth = step;
        });
    }
    if (hStep) {
        hStep.addEventListener('change', function() {
            var step = parseInt(this.value);
            if (hSlider) {
                hSlider.step = step;
                hSlider.value = Math.round(parseInt(hSlider.value) / step) * step;
                targetResolution[1] = parseInt(hSlider.value);
                var txt = $('height-text');
                if (txt) txt.textContent = hSlider.value;
            }
            plateHeight = step;
        });
    }

    // HSV / Brightness / Contrast sliders
    var debouncedStep2 = debounce(function() {
        invalidateStepsFrom(3);
    }, DEBOUNCE_DELAY);

    ['hue-slider', 'saturation-slider', 'value-slider', 'brightness-slider', 'contrast-slider'].forEach(function(sliderId) {
        var slider = $(sliderId);
        if (!slider) return;
        var textId = sliderId.replace('-slider', '-text');
        slider.addEventListener('input', function() {
            var txt = $(textId);
            if (txt) txt.textContent = this.value;
            debouncedStep2();
        });
    });

    // Reset buttons
    var resetHsv = $('reset-hsv-button');
    if (resetHsv) resetHsv.addEventListener('click', function() {
        ['hue-slider', 'saturation-slider', 'value-slider'].forEach(function(id) {
            var s = $(id); if (s) { s.value = 0; var t = $(id.replace('-slider', '-text')); if (t) t.textContent = '0'; }
        });
        invalidateStepsFrom(3);
    });

    var resetBright = $('reset-brightness-button');
    if (resetBright) resetBright.addEventListener('click', function() {
        var s = $('brightness-slider'); if (s) s.value = 0;
        var t = $('brightness-text'); if (t) t.textContent = '0';
        invalidateStepsFrom(3);
    });

    var resetContrast = $('reset-contrast-button');
    if (resetContrast) resetContrast.addEventListener('click', function() {
        var s = $('contrast-slider'); if (s) s.value = 0;
        var t = $('contrast-text'); if (t) t.textContent = '0';
        invalidateStepsFrom(3);
    });

    // Clear overrides
    var clearOverrides = $('clear-overrides-button');
    if (clearOverrides) clearOverrides.addEventListener('click', function() {
        resetOverrideArrays();
        invalidateStepsFrom(3);
    });

    // Infinite piece count
    var infiniteCheck = $('infinite-piece-count-check');
    if (infiniteCheck) infiniteCheck.addEventListener('change', function() {
        invalidateStepsFrom(4);
    });

    // Step navigation
    document.addEventListener('click', function(e) {
        var nextBtn = e.target.closest('.step-next-btn');
        if (nextBtn) {
            var step = parseInt(nextBtn.dataset.nextStep);
            goToVisualStep(step);
            return;
        }
        var prevBtn = e.target.closest('.step-prev-btn');
        if (prevBtn) {
            var step = parseInt(prevBtn.dataset.prevStep);
            goToVisualStep(step);
            return;
        }
        var stepperStep = e.target.closest('.mosaic-stepper-step');
        if (stepperStep) {
            var step = parseInt(stepperStep.dataset.step);
            goToVisualStep(step);
        }
    });

    // PDF download
    var dlBtn = $('download-instructions-button');
    if (dlBtn) dlBtn.addEventListener('click', handleDownloadInstructions);

    // BrickLink export
    var exportBtn = $('export-bricklink-button');
    if (exportBtn) exportBtn.addEventListener('click', handleBricklinkExport);

    // Interpolation algorithm dropdown
    var interpOptions = $('interpolation-algorithm-options');
    if (interpOptions) {
        var algos = [
            { key: 'avg', name: t('interpolationAverage') || 'Average Pooling' },
            { key: 'min', name: t('interpolationMin') || 'Min Pooling' },
            { key: 'max', name: t('interpolationMax') || 'Max Pooling' },
            { key: 'dualMinMax', name: t('interpolationDualMinMax') || 'Dual Min/Max' }
        ];
        algos.forEach(function(algo) {
            var option = document.createElement('a');
            option.className = 'dropdown-item';
            option.href = '#';
            option.textContent = algo.name;
            option.addEventListener('click', function(e) {
                e.preventDefault();
                selectedInterpolationAlgorithm = algo.key;
                var btn = $('interpolation-algorithm-button');
                if (btn) btn.textContent = algo.name;
                invalidateStepsFrom(3);
            });
            interpOptions.appendChild(option);
        });
    }

    // Paintbrush tools
    setupPaintbrushHandlers();

    var paintbrushToolOptions = $('paintbrush-tool-selection-dropdown-options');
    if (paintbrushToolOptions) {
        var tools = [
            { key: 'paintbrush', name: t('toolPaintbrush') || 'Paintbrush' },
            { key: 'eraser', name: t('toolEraser') || 'Eraser' }
        ];
        tools.forEach(function(tool) {
            var option = document.createElement('a');
            option.className = 'dropdown-item';
            option.href = '#';
            option.textContent = tool.name;
            option.addEventListener('click', function(e) {
                e.preventDefault();
                selectedPaintbrushTool = tool.key;
            });
            paintbrushToolOptions.appendChild(option);
        });
    }

    // Import stud map from file
    var importInput = $('import-stud-map-file-input');
    if (importInput) {
        importInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(event) {
                try {
                    var map = JSON.parse(event.target.result);
                    mixInStudMap(map);
                } catch(err) {
                    console.error('Invalid stud map file:', err);
                }
            };
            reader.readAsText(file);
        });
    }

    // Export stud map
    var exportStudBtn = $('export-stud-map-button');
    if (exportStudBtn) {
        exportStudBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var json = JSON.stringify(selectedStudMap, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'stud-map.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Add custom stud
    var addStudBtn = $('add-custom-stud-button');
    if (addStudBtn) {
        addStudBtn.addEventListener('click', function() {
            var defaultHex = ALL_VALID_BRICKLINK_COLORS[0] || '#42c0fb';
            addStudRow(defaultHex, 9999);
            readStudTableIntoState();
        });
    }

    // Clear custom studs
    var clearStudsBtn = $('clear-custom-studs-button');
    if (clearStudsBtn) {
        clearStudsBtn.addEventListener('click', function() {
            var tbody = $('custom-stud-table-body');
            if (tbody) tbody.innerHTML = '';
            readStudTableIntoState();
        });
    }
}

// ============================================
// Auto-process when expanding advanced sections
// ============================================

function setupAdvancedSectionHandlers() {
    // When "Color Adjustment" section expands, run step 2
    var adjustSection = $('step-1-adjust-advanced');
    if (adjustSection) {
        adjustSection.addEventListener('show.bs.collapse', function() {
            if (stepProcessed[1] && !stepProcessed[2]) runStep2();
        });
    }

    // When "Available Colors" section expands, run step 2 then 3
    var colorsSection = $('step-1-colors-advanced');
    if (colorsSection) {
        colorsSection.addEventListener('show.bs.collapse', function() {
            if (stepProcessed[1] && !stepProcessed[2]) {
                runStep2().then(function() {
                    if (!stepProcessed[3]) runStep3();
                });
            } else if (stepProcessed[2] && !stepProcessed[3]) {
                runStep3();
            }
        });
    }
}

// ============================================
// Start
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setTimeout(setupAdvancedSectionHandlers, 500);
});
