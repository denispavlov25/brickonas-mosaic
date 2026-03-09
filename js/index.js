const VERSION_NUMBER = "v2022.12.11";

let perfLoggingDatabase;

function incrementTransaction(count) {
    return (count || 0) + 1;
}

// Debounce utility function for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 150;

const LOW_DPI = 48;
const HIGH_DPI = 96;

const interactionSelectors = [
    "input-image-selector",
    "input-image-selector-hidden",
    "mix-in-stud-map-button",
    "width-slider",
    "height-slider",
    "hue-slider",
    "saturation-slider",
    "value-slider",
    "reset-hsv-button",
    "reset-brightness-button",
    "reset-contrast-button",
    "download-instructions-button",
    "add-custom-stud-button",
    "export-stud-map-button",
    "import-stud-map-file-input",
    "bricklink-piece-button",
    "clear-overrides-button",
    "clear-custom-studs-button",
    "infinite-piece-count-check",
    "high-quality-instructions-check",
    "input-depth-image-selector",
    "num-depth-levels-slider",
    "download-depth-instructions-button",
    "high-quality-depth-instructions-check",
    "export-depth-to-bricklink-button",
].map((id) => document.getElementById(id)).filter(Boolean);

const customStudTableBody = document.getElementById("custom-stud-table-body");

let _loadingSpinnerTimeout = null;

function disableInteraction() {
    interactionSelectors.forEach((button) => { if (button) button.disabled = true; });
    [...document.getElementsByTagName("input")].forEach((button) => (button.disabled = true));
    [...document.getElementsByClassName("btn")].forEach((button) => (button.disabled = true));
    [...document.getElementsByClassName("nav-link")].forEach((link) => (link.className = link.className + " disabled"));
    document.getElementById("universal-loading-progress").hidden = false;
    document.getElementById("universal-loading-progress-complement").hidden = true;
    // Show overlay but delay spinner visibility by 1 second
    const overlay = document.getElementById("loading-overlay");
    overlay.classList.remove("hidden");
    overlay.classList.remove("show-spinner");
    if (_loadingSpinnerTimeout) clearTimeout(_loadingSpinnerTimeout);
    _loadingSpinnerTimeout = setTimeout(function() {
        if (!overlay.classList.contains("hidden")) {
            overlay.classList.add("show-spinner");
        }
    }, 1000);
    if (inputImageCropper != null) {
        inputImageCropper.disable();
    }
}

function enableInteraction() {
    interactionSelectors.forEach((button) => { if (button) button.disabled = false; });
    [...document.getElementsByTagName("input")].forEach((button) => {
        button.disabled = button.className.includes("always-disabled");
    });
    [...document.getElementsByClassName("btn")].forEach((button) => (button.disabled = false));
    [...document.getElementsByClassName("nav-link")].forEach(
        (link) => (link.className = link.className.replace(/ disabled/g, ""))
    );
    document.getElementById("universal-loading-progress").hidden = true;
    document.getElementById("universal-loading-progress-complement").hidden = false;
    const overlay = document.getElementById("loading-overlay");
    overlay.classList.add("hidden");
    overlay.classList.remove("show-spinner");
    if (_loadingSpinnerTimeout) {
        clearTimeout(_loadingSpinnerTimeout);
        _loadingSpinnerTimeout = null;
    }
    if (inputImageCropper != null) {
        inputImageCropper.enable();
    }
}

if (window.location.href.includes("forceUnsupportedDimensions")) {
    ["height-slider", "width-slider"].forEach((id) => {
        document.getElementById(id).step = 1;
        document.getElementById(id).type = "number";
    });
}

const CNN_INPUT_IMAGE_WIDTH = 256;
const CNN_INPUT_IMAGE_HEIGHT = 256;

let inputImage = null;

const inputCanvas = document.getElementById("input-canvas");
const inputCanvasContext = inputCanvas.getContext("2d");
const inputDepthCanvas = document.getElementById("input-depth-canvas");
const inputDepthCanvasContext = inputDepthCanvas.getContext("2d");

const webWorkerInputCanvas = document.getElementById("web-worker-input-canvas");
const webWorkerInputCanvasContext = webWorkerInputCanvas.getContext("2d");
const webWorkerOutputCanvas = document.getElementById("web-worker-output-canvas");
const webWorkerOutputCanvasContext = webWorkerOutputCanvas.getContext("2d");

const step1CanvasUpscaled = document.getElementById("step-1-canvas-upscaled");
const step1CanvasUpscaledContext = step1CanvasUpscaled.getContext("2d");
const step1DepthCanvasUpscaled = document.getElementById("step-1-depth-canvas-upscaled");
const step1DepthCanvasUpscaledContext = step1DepthCanvasUpscaled.getContext("2d");

const step2Canvas = document.getElementById("step-2-canvas");
const step2CanvasContext = step2Canvas.getContext("2d");
const step2CanvasUpscaled = document.getElementById("step-2-canvas-upscaled");
const step2CanvasUpscaledContext = step2CanvasUpscaled.getContext("2d");
const step2DepthCanvas = document.getElementById("step-2-depth-canvas");
const step2DepthCanvasContext = step2DepthCanvas.getContext("2d");
const step2DepthCanvasUpscaled = document.getElementById("step-2-depth-canvas-upscaled");
const step2DepthCanvasUpscaledContext = step2DepthCanvasUpscaled.getContext("2d");

const step3Canvas = document.getElementById("step-3-canvas");
const step3CanvasContext = step3Canvas.getContext("2d");
const step3CanvasUpscaled = document.getElementById("step-3-canvas-upscaled");
const step3CanvasUpscaledContext = step3CanvasUpscaled.getContext("2d");
const step3DepthCanvas = document.getElementById("step-3-depth-canvas");
const step3DepthCanvasContext = step3DepthCanvas.getContext("2d");
const step3DepthCanvasUpscaled = document.getElementById("step-3-depth-canvas-upscaled");
const step3DepthCanvasUpscaledContext = step3DepthCanvasUpscaled.getContext("2d");

const step4Canvas = document.getElementById("step-4-canvas");
const step4CanvasContext = step4Canvas.getContext("2d");
const step4CanvasUpscaled = document.getElementById("step-4-canvas-upscaled");
const step4CanvasUpscaledContext = step4CanvasUpscaled.getContext("2d");
const step4Canvas3dUpscaled = document.getElementById("step-4-canvas-3d-upscaled");

const bricklinkCacheCanvas = document.getElementById("bricklink-cache-canvas");

let targetResolution = [
    Number(document.getElementById("width-slider").value),
    Number(document.getElementById("height-slider").value),
];
const PIXEL_WIDTH_CM = 0.8;
const INCHES_IN_CM = 0.393701;
const SCALING_FACTOR = 40;

// Plate dimensions in studs - updated dynamically based on step selectors
let PLATE_WIDTH = 16;  // width step (plate width in studs)
let PLATE_HEIGHT = 16; // height step (plate height in studs)

function updatePlateDimensions() {
    PLATE_WIDTH = parseInt(document.getElementById("width-step-select").value);
    PLATE_HEIGHT = parseInt(document.getElementById("height-step-select").value);
}

document.getElementById("width-text").title = `${(targetResolution[0] * PIXEL_WIDTH_CM).toFixed(1)} cm`;
document.getElementById("height-text").title = `${(targetResolution[1] * PIXEL_WIDTH_CM).toFixed(1)} cm`;

let inputImageCropper;

function initializeCropper() {
    if (inputImageCropper != null) {
        inputImageCropper.destroy();
    }
    inputImageCropper = new Cropper(step1CanvasUpscaled, {
        aspectRatio: targetResolution[0] / targetResolution[1],
        viewMode: 1,
        minContainerWidth: 1,
        minContainerHeight: 1,
        zoomable: false,
        cropend() {
            overridePixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
            overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
        },
    });
}

step1CanvasUpscaled.addEventListener("cropend", runStep1);

window.addEventListener("resize", () => {
    [step4Canvas].forEach((canvas) => {
        canvas.height = (window.getComputedStyle(canvas).width * targetResolution[1]) / targetResolution[0];
    });
});

let depthEnabled = false;

function enableDepth() {
    [...document.getElementsByClassName("3d-selector-tabs")].forEach((tabsList) => (tabsList.hidden = false));

    document.getElementById("download-instructions-button").innerHTML = t('generateInstructions');

    onDepthMapCountChange();

    create3dPreview();
    depthEnabled = true;

    perfLoggingDatabase && perfLoggingDatabase.ref("enable-depth-count/total").transaction(incrementTransaction);
    const loggingTimestamp = Math.floor((Date.now() - (Date.now() % 8.64e7)) / 1000); // 8.64e+7 = ms in day
    perfLoggingDatabase && perfLoggingDatabase.ref("enable-depth-count/per-day/" + loggingTimestamp).transaction(incrementTransaction);
}
if (window.location.href.includes("enable3d")) {
    enableDepth();
}

Object.keys(PLATE_DIMENSIONS_TO_PART_ID).forEach((plate) => {
    ["depth-plates-container", "pixel-dimensions-container"].forEach((container) => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = plate;
        input.checked = !DEFAULT_DISABLED_DEPTH_PLATES.includes(plate);
        input.disabled = plate === "1 X 1";
        input.className = plate === "1 X 1" ? "always-disabled" : "checkbox-clickable";
        const label = document.createElement("label");
        label.className = plate === "1 X 1" ? "" : "checkbox-clickable";
        const plateSpan = document.createElement("span");
        plateSpan.innerHTML = " " + plate;
        label.appendChild(input);
        label.appendChild(plateSpan);
        const checkbox = document.createElement("div");
        checkbox.style = "margin-top: 2px; margin-left: 4px";
        checkbox.appendChild(label);
        document.getElementById(container).appendChild(checkbox);
        if (container === "pixel-dimensions-container") {
            checkbox.addEventListener("change", () => {
                disableInteraction();
                runStep3();
            });
            const classes = [];
            if (PLATE_DIMENSIONS_TO_PART_ID[plate]) {
                // for now, this is always true
                classes.push("variable-plate-checkbox");
            }
            if (TILE_DIMENSIONS_TO_PART_ID[plate]) {
                classes.push("variable-tile-checkbox");
            }
            if (BRICK_DIMENSIONS_TO_PART_ID[plate]) {
                classes.push("variable-brick-checkbox");
            }
            checkbox.className = classes.join(" ");
            input.className = [input.className, ...classes].join(" ");
        }
    });
});

function updateStudCountText() {
    const requiredStuds = targetResolution[0] * targetResolution[1];
    document.getElementById("required-studs").innerHTML = requiredStuds;
    if (document.getElementById("infinite-piece-count-check").checked) {
        document.getElementById("available-studs").innerHTML = "∞";
        document.getElementById("missing-studs").innerHTML = "0";
        document.getElementById("nonzero-missing-pieces-warning").hidden = true;
    } else {
        let availableStuds = 0;
        Array.from(customStudTableBody.children).forEach((stud) => {
            availableStuds += parseInt(stud.children[1].children[0].children[0].value);
        });
        const missingStuds = Math.max(requiredStuds - availableStuds, 0);
        document.getElementById("available-studs").innerHTML = availableStuds;
        document.getElementById("missing-studs").innerHTML = missingStuds;
        document.getElementById("nonzero-missing-pieces-warning").hidden = missingStuds === 0;
    }
}

const quantizationAlgorithmsInfo = {
    twoPhase: {
        name: "2 Phase",
    },
    floydSteinberg: {
        name: "Floyd-Steinberg Dithering",
    },
    jarvisJudiceNinkeDithering: {
        name: "Jarvis-Judice-Ninke Dithering",
    },
    atkinsonDithering: {
        name: "Atkinson Dithering",
    },
    sierraDithering: {
        name: "Sierra Dithering",
    },
    greedy: {
        name: "Greedy",
    },
    greedyWithDithering: {
        name: "Greedy Gaussian Dithering",
    },
};

const quantizationAlgorithmToTraditionalDitheringKernel = {
    floydSteinberg: FLOYD_STEINBERG_DITHERING_KERNEL,
    jarvisJudiceNinkeDithering: JARVIS_JUDICE_NINKE_DITHERING_KERNEL,
    atkinsonDithering: ATKINSON_DITHERING_KERNEL,
    sierraDithering: SIERRA_DITHERING_KERNEL,
};

const defaultQuantizationAlgorithmKey = "twoPhase";
let quantizationAlgorithm = defaultQuantizationAlgorithmKey;

let selectedPixelPartNumber = PIXEL_TYPE_OPTIONS[0].number;
document.getElementById("bricklink-piece-button").innerHTML = PIXEL_TYPE_OPTIONS[0].name;

// TODO: Make this a function
let overridePixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
let overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);

function handleResolutionChange() {
    overridePixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
    overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
    document.getElementById("width-text").title = `${(targetResolution[0] * PIXEL_WIDTH_CM).toFixed(1)} cm`;
    document.getElementById("height-text").title = `${(targetResolution[1] * PIXEL_WIDTH_CM).toFixed(1)} cm`;
    $('[data-toggle="tooltip"]').tooltip("dispose");
    $('[data-toggle="tooltip"]').tooltip();
    initializeCropper();
    if (typeof updateMosaicProductMeta === 'function') updateMosaicProductMeta();
    runStep1();
}

// Debounced version for slider dragging
const debouncedHandleResolutionChange = debounce(() => {
    handleResolutionChange();
}, DEBOUNCE_DELAY);

// Update text display without processing (for real-time feedback)
function updateResolutionTextOnly() {
    document.getElementById("width-text").innerHTML = document.getElementById("width-slider").value;
    document.getElementById("height-text").innerHTML = document.getElementById("height-slider").value;
    document.getElementById("width-text").title = `${(document.getElementById("width-slider").value * PIXEL_WIDTH_CM).toFixed(1)} cm`;
    document.getElementById("height-text").title = `${(document.getElementById("height-slider").value * PIXEL_WIDTH_CM).toFixed(1)} cm`;
}

document.getElementById("width-slider").addEventListener(
    "change",
    () => {
        document.getElementById("width-text").innerHTML = document.getElementById("width-slider").value;
        targetResolution[0] = document.getElementById("width-slider").value;
        handleResolutionChange();
    },
    false
);

document.getElementById("width-slider").addEventListener(
    "input",
    () => {
        updateResolutionTextOnly();
        targetResolution[0] = document.getElementById("width-slider").value;
        targetResolution[1] = document.getElementById("height-slider").value;
        debouncedHandleResolutionChange();
    },
    false
);

document.getElementById("height-slider").addEventListener(
    "change",
    () => {
        document.getElementById("height-text").innerHTML = document.getElementById("height-slider").value;
        targetResolution[1] = document.getElementById("height-slider").value;
        handleResolutionChange();
    },
    false
);

document.getElementById("height-slider").addEventListener(
    "input",
    () => {
        updateResolutionTextOnly();
        targetResolution[0] = document.getElementById("width-slider").value;
        targetResolution[1] = document.getElementById("height-slider").value;
        debouncedHandleResolutionChange();
    },
    false
);

// Resolution step selectors
document.getElementById("width-step-select").addEventListener("change", () => {
    const newStep = parseInt(document.getElementById("width-step-select").value);
    const widthSlider = document.getElementById("width-slider");
    widthSlider.step = newStep;
    widthSlider.min = newStep;
    // Snap current value to nearest valid step
    const currentValue = parseInt(widthSlider.value);
    const snappedValue = Math.round(currentValue / newStep) * newStep;
    const clampedValue = Math.max(newStep, Math.min(288, snappedValue));
    widthSlider.value = clampedValue;
    document.getElementById("width-text").innerHTML = clampedValue;
    targetResolution[0] = clampedValue;
    handleResolutionChange();
});

document.getElementById("height-step-select").addEventListener("change", () => {
    const newStep = parseInt(document.getElementById("height-step-select").value);
    const heightSlider = document.getElementById("height-slider");
    heightSlider.step = newStep;
    heightSlider.min = newStep;
    // Snap current value to nearest valid step
    const currentValue = parseInt(heightSlider.value);
    const snappedValue = Math.round(currentValue / newStep) * newStep;
    const clampedValue = Math.max(newStep, Math.min(288, snappedValue));
    heightSlider.value = clampedValue;
    document.getElementById("height-text").innerHTML = clampedValue;
    targetResolution[1] = clampedValue;
    handleResolutionChange();
});

document.getElementById("clear-overrides-button").addEventListener("click", () => {
    overridePixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
    // Overrides only affect step 3, so run step 3 directly (step 2 canvas is still valid)
    if (stepProcessed[2]) {
        runStep3();
    } else {
        runStep2();
    }
});
document.getElementById("clear-depth-overrides-button").addEventListener("click", () => {
    overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
    if (stepProcessed[2]) {
        runStep3();
    } else {
        runStep2();
    }
});

let DEFAULT_STUD_MAP = "all_tile_colors";
let DEFAULT_COLOR = "#42c0fb";
let DEFAULT_COLOR_NAME = "Medium Azure";

try {
    const match = window.location.href.match("[?&]" + "availableColors" + "=([^&]+)");
    const availableColorsString = match ? match[1] : null;
    let availableColors;
    if (match == null) {
        availableColors = [];
    } else {
        availableColors = availableColorsString
            .split(",")
            .map((color) => color.toLowerCase())
            .filter((color) => color.match("^#(?:[0-9a-fA-F]{3}){1,2}$"));
    }

    if (availableColors.length > 0) {
        DEFAULT_COLOR = availableColors[0];
        DEFAULT_COLOR_NAME = availableColors[0];
        ALL_VALID_BRICKLINK_COLORS = availableColors
            .map((color) => {
                return {
                    name: color,
                    hex: color,
                };
            })
            .concat(ALL_VALID_BRICKLINK_COLORS);
        ALL_BRICKLINK_SOLID_COLORS = ALL_VALID_BRICKLINK_COLORS;
        const studMap = {};
        availableColors.forEach((color) => {
            studMap[color] = 99999;
        });
        STUD_MAPS = {
            url_colors: {
                name: "Colors from URL",
                officialName: "Colors from URL",
                sortedStuds: availableColors,
                studMap: studMap,
            },
            all_solid_colors: STUD_MAPS["all_solid_colors"],
        };
        DEFAULT_STUD_MAP = "url_colors";
    }
} catch (_e) {
    enableInteraction();
}

let selectedStudMap = STUD_MAPS[DEFAULT_STUD_MAP].studMap;
let selectedFullSetName = STUD_MAPS[DEFAULT_STUD_MAP].officialName;
let selectedSortedStuds = STUD_MAPS[DEFAULT_STUD_MAP].sortedStuds;

function populateCustomStudSelectors(studMap, shouldRunAfterPopulation) {
    customStudTableBody.innerHTML = "";
    studMap.sortedStuds.forEach((stud) => {
        const studRow = getNewCustomStudRow();
        studRow.children[0].children[0].children[0].children[0].style.backgroundColor = stud;
        studRow.children[0].children[0].setAttribute("title", translateColor(HEX_TO_COLOR_NAME[stud]) || stud);
        studRow.children[1].children[0].children[0].value = studMap.studMap[stud];
        customStudTableBody.appendChild(studRow);
    });
    if (shouldRunAfterPopulation) {
        runCustomStudMap();
    }
}

function mixInStudMap(studMap, runAfterMixIn) {
    studMap.sortedStuds.forEach((stud) => {
        let existingRow = null;
        Array.from(customStudTableBody.children).forEach((row) => {
            const rgb = row.children[0].children[0].children[0].children[0].style.backgroundColor
                .replace("rgb(", "")
                .replace(")", "")
                .split(/,\s*/)
                .map((shade) => parseInt(shade));
            const rowHex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            if (rowHex == stud && existingRow == null) {
                existingRow = row;
            }
        });

        if (existingRow == null) {
            const newStudRow = getNewCustomStudRow();
            newStudRow.children[0].children[0].children[0].innerHTML = "";
            newStudRow.children[0].children[0].children[0].appendChild(getColorSquare(stud));
            newStudRow.children[0].children[0].setAttribute("title", translateColor(HEX_TO_COLOR_NAME[stud]) || stud);
            newStudRow.children[1].children[0].children[0].value = studMap.studMap[stud];
            customStudTableBody.appendChild(newStudRow);
        } else {
            existingRow.children[1].children[0].children[0].value = Math.min(
                parseInt(existingRow.children[1].children[0].children[0].value) + studMap.studMap[stud],
                99999
            );
        }
    });
    // TODO: Clean up boolean logic here
    runCustomStudMap(!runAfterMixIn);
}

populateCustomStudSelectors(STUD_MAPS[DEFAULT_STUD_MAP], false);

const mixInStudMapOptions = document.getElementById("mix-in-stud-map-options");

const bricklinkPieceOptions = document.getElementById("bricklink-piece-options");
bricklinkPieceOptions.innerHTML = "";
PIXEL_TYPE_OPTIONS.forEach((part) => {
    const option = document.createElement("a");
    option.className = "dropdown-item btn";
    option.textContent = part.name;
    option.value = part.number;
    option.addEventListener("click", () => {
        document.getElementById("bricklink-piece-button").innerHTML = part.name;
        selectedPixelPartNumber = part.number;
        const isVariable = ("" + selectedPixelPartNumber).match("^variable.*$");
        document.getElementById("pixel-dimensions-container-wrapper").hidden = !isVariable;

        if (isVariable) {
            const availableParts = [...document.getElementById("pixel-dimensions-container").children].forEach(
                (input) => {
                    const className = input.className;
                    const uniqueVariablePixelName = selectedPixelPartNumber.replace("variable_", "");
                    return (input.hidden = !className.includes(uniqueVariablePixelName));
                }
            );
        }

        onInfinitePieceCountChange();
        updateForceInfinitePieceCountText();
        runStep3();
    });
    bricklinkPieceOptions.appendChild(option);
});

function isBleedthroughEnabled() {
    return [PIXEL_TYPE_OPTIONS[0].number, PIXEL_TYPE_OPTIONS[1].number].includes(selectedPixelPartNumber);
}

let selectedTiebreakTechnique = "alternatingmod";
const TIEBREAK_TECHNIQUES = [
    {
        name: "None",
        value: "none",
    },
    {
        name: "Random",
        value: "random",
    },
    {
        name: "Mod 2",
        value: "mod2",
    },
    {
        name: "Mod 3",
        value: "mod3",
    },
    {
        name: "Mod 4",
        value: "mod4",
    },
    {
        name: "Mod 5",
        value: "mod5",
    },
    {
        name: "Noisy Mod 2",
        value: "noisymod2",
    },
    {
        name: "Noisy Mod 3",
        value: "noisymod3",
    },
    {
        name: "Noisy Mod 4",
        value: "noisymod4",
    },
    {
        name: "Noisy Mod 5",
        value: "noisymod5",
    },
    {
        name: "Cascading Mod",
        value: "cascadingmod",
    },
    {
        name: "Cascading Noisy Mod",
        value: "cascadingnoisymod",
    },
    {
        name: "Alternating Mod",
        value: "alternatingmod",
    },
    {
        name: "Alternating Noisy Mod",
        value: "alternatingnoisymod",
    },
];

let selectedInterpolationAlgorithm = "default";
const INTERPOLATION_ALGORITHMS = [
    {
        name: "Browser Default",
        value: "default",
    },
    {
        name: "Average Pooling",
        value: "avgPooling",
    },
    {
        name: "Dual Min Max Pooling",
        value: "dualMinMaxPooling",
    },
    {
        name: "Min Pooling",
        value: "minPooling",
    },
    {
        name: "Max Pooling",
        value: "maxPooling",
    },
];
INTERPOLATION_ALGORITHMS.forEach((algorithm) => {
    const option = document.createElement("a");
    option.className = "dropdown-item btn";
    option.textContent = algorithm.name;
    option.value = algorithm.value;
    option.addEventListener("click", () => {
        document.getElementById("interpolation-algorithm-button").innerHTML = algorithm.name;
        selectedInterpolationAlgorithm = algorithm.value;
        runStep2();
    });
    document.getElementById("interpolation-algorithm-options").appendChild(option);
});

// Color distance stuff
function d3ColorDistanceWrapper(d3DistanceFunction) {
    return (c1, c2) =>
        d3DistanceFunction(d3.color(rgbToHex(c1[0], c1[1], c1[2])), d3.color(rgbToHex(c2[0], c2[1], c2[2])));
}

function RGBPixelDistanceSquared(pixel1, pixel2) {
    let sum = 0;
    for (let i = 0; i < 3; i++) {
        sum += Math.abs(pixel1[i] - pixel2[i]);
    }
    return sum;
}

const colorDistanceFunctionsInfo = {
    euclideanRGB: {
        name: "Euclidean RGB",
        func: RGBPixelDistanceSquared,
    },
    euclideanLAB: {
        name: "Euclidean LAB",
        func: d3ColorDistanceWrapper(d3.differenceEuclideanLab),
    },
    // HCL and HSL don't always work
    // euclideanHCL: {
    //     name: "Euclidean HCL",
    //     func: d3ColorDistanceWrapper(d3.differenceEuclideanHCL)
    // },
    // euclideanHSL: {
    //     name: "Euclidean HSL",
    //     func: d3ColorDistanceWrapper(d3.differenceEuclideanHSL)
    // },
    // CMC sometimes looks odd (symmetry issues?)
    // cmc: {
    //     name: "CMC",
    //     func: d3ColorDistanceWrapper(d3.differenceCmc)
    // },
    cie94: {
        name: "CIE94",
        func: d3ColorDistanceWrapper(d3.differenceCie94),
    },
    ciede2000: {
        name: "CIEDE2000",
        func: d3ColorDistanceWrapper(d3.differenceCiede2000),
    },
    din99o: {
        name: "DIN99o",
        func: d3ColorDistanceWrapper(d3.differenceDin99o),
    },
};

const defaultDistanceFunctionKey = "ciede2000";
let colorDistanceFunction = colorDistanceFunctionsInfo[defaultDistanceFunctionKey].func;

function onInfinitePieceCountChange() {
    const isUsingInfinite =
        document.getElementById("infinite-piece-count-check").checked ||
        Object.keys(quantizationAlgorithmToTraditionalDitheringKernel).includes(quantizationAlgorithm) ||
        ("" + selectedPixelPartNumber).match("^variable.*$");
    [...document.getElementsByClassName("piece-count-input")].forEach(
        (numberInput) => (numberInput.hidden = isUsingInfinite)
    );
    [...document.getElementsByClassName("piece-count-infinity-placeholder")].forEach(
        (placeholder) => (placeholder.hidden = !isUsingInfinite)
    );
    updateStudCountText();
}
document.getElementById("infinite-piece-count-check").addEventListener("change", () => {
    onInfinitePieceCountChange();
    runStep4();
});

function updateForceInfinitePieceCountText() {
    const isInfinitePieceCountForced =
        Object.keys(quantizationAlgorithmToTraditionalDitheringKernel).includes(quantizationAlgorithm) ||
        ("" + selectedPixelPartNumber).match("^variable.*$");
    document.getElementById("infinite-piece-count-check-container").hidden = isInfinitePieceCountForced;
    document.getElementById("forced-infinite-piece-count-warning").hidden = !isInfinitePieceCountForced;
}

const DIVIDER = "DIVIDER";
const STUD_MAP_KEYS = Object.keys(STUD_MAPS);
const NUM_SET_STUD_MAPS = 12;
const NUM_PARTIAL_SET_STUD_MAPS = 7;
STUD_MAP_KEYS.splice(NUM_SET_STUD_MAPS, 0, DIVIDER);
STUD_MAP_KEYS.splice(NUM_SET_STUD_MAPS + NUM_PARTIAL_SET_STUD_MAPS + 1, 0, DIVIDER);

STUD_MAP_KEYS.filter((key) => key !== "rgb").forEach((studMap) => {
    if (studMap === DIVIDER) {
        const divider = document.createElement("div");
        divider.className = "dropdown-divider";
        mixInStudMapOptions.appendChild(divider);
    } else {
        const option = document.createElement("a");
        option.className = "dropdown-item btn";
        option.textContent = STUD_MAPS[studMap].name;
        option.value = studMap;
        option.addEventListener("click", () => {
            mixInStudMap(STUD_MAPS[studMap], true);
        });
        mixInStudMapOptions.appendChild(option);
    }
});

STUD_MAP_KEYS.filter((key) => key !== "rgb").forEach((studMap) => {
    if (studMap === DIVIDER) {
        const divider = document.createElement("div");
        divider.className = "dropdown-divider";
        document.getElementById("select-starting-custom-stud-map-options").appendChild(divider);
    } else {
        const option = document.createElement("a");
        option.className = "dropdown-item btn";
        option.textContent = STUD_MAPS[studMap].name;
        option.value = studMap;
        option.addEventListener("click", () => {
            customStudTableBody.innerHTML = "";
            mixInStudMap(STUD_MAPS[studMap], false);
            document.getElementById("select-starting-custom-stud-map-button").innerHTML = STUD_MAPS[studMap].name;
            const desc = STUD_MAPS[studMap].descriptionKey ? t(STUD_MAPS[studMap].descriptionKey) : (STUD_MAPS[studMap].descriptionHTML ?? "");
            document.getElementById("input-stud-map-description").innerHTML = desc;
        });
        document.getElementById("select-starting-custom-stud-map-options").appendChild(option);
    }
});

document.getElementById("select-starting-custom-stud-map-button").innerHTML = STUD_MAPS[DEFAULT_STUD_MAP].name;
const defaultDesc = STUD_MAPS[DEFAULT_STUD_MAP].descriptionKey ? t(STUD_MAPS[DEFAULT_STUD_MAP].descriptionKey) : (STUD_MAPS[DEFAULT_STUD_MAP].descriptionHTML ?? "");
document.getElementById("input-stud-map-description").innerHTML = defaultDesc;

constMixInDivider = document.createElement("div");
constMixInDivider.className = "dropdown-divider";
mixInStudMapOptions.appendChild(constMixInDivider);

const importOption = document.createElement("a");
importOption.className = "dropdown-item btn";
importOption.textContent = t('importFromFile');
importOption.value = null;
importOption.addEventListener("click", () => {
    document.getElementById("import-stud-map-file-input").click();
});
mixInStudMapOptions.appendChild(importOption);

document.getElementById("import-stud-map-file-input").addEventListener(
    "change",
    (e) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            mixInStudMap(JSON.parse(reader.result, true));
            document.getElementById("import-stud-map-file-input").value = null;
        };
        reader.readAsText(e.target.files[0]);
    },
    false
);

document.getElementById("clear-custom-studs-button").addEventListener("click", () => {
    customStudTableBody.innerHTML = "";
    runCustomStudMap();
});

function runCustomStudMap(skipStep1) {
    const customStudMap = {};
    const customSortedStuds = [];
    Array.from(customStudTableBody.children).forEach((stud) => {
        const rgb = stud.children[0].children[0].children[0].children[0].style.backgroundColor
            .replace("rgb(", "")
            .replace(")", "")
            .split(/,\s*/)
            .map((shade) => parseInt(shade));
        const studHex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        customSortedStuds.push(studHex);
        const numStuds = parseInt(stud.children[1].children[0].children[0].value);
        customStudMap[studHex] = (customStudMap[studHex] || 0) + numStuds;
    });
    if (customSortedStuds.length > 0) {
        selectedStudMap = customStudMap;
        selectedFullSetName = "Custom";
        selectedSortedStuds = customSortedStuds;
    }
    if (!skipStep1) {
        runStep1();
    }
    // If on visual step 2 (painting canvas visible), re-run step 3 with new stud map
    if (typeof currentVisualStep !== 'undefined' && currentVisualStep === 2 && stepProcessed[2]) {
        runStep3();
    }
}

function getColorSquare(hex) {
    const result = document.createElement("div");
    result.style.backgroundColor = hex;
    result.style.width = "1em";
    result.style.height = "1em";
    return result;
}

function getColorSelectorDropdown(tooltipPosition) {
    if (!tooltipPosition) {
        tooltipPosition = "left";
    }
    const container = document.createElement("div");
    const id = "color-selector" + uuidv4();

    const button = document.createElement("button");
    button.className = "btn btn-outline-secondary";
    button.type = "button";
    button.setAttribute("data-toggle", "dropdown");
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.id = id;
    button.appendChild(getColorSquare(DEFAULT_COLOR));
    button.value = DEFAULT_COLOR;

    const dropdown = document.createElement("div");
    dropdown.setAttribute("aria-labelledby", id);
    dropdown.className = "dropdown-menu pre-scrollable";

    ALL_VALID_BRICKLINK_COLORS.forEach((color) => {
        const option = document.createElement("a");
        option.style.display = "flex";
        option.className = "dropdown-item btn";
        const text = document.createElement("span");
        text.innerHTML = "&nbsp;" + translateColor(color.name);
        const colorSquare = getColorSquare(color.hex);
        colorSquare.style.marginTop = "3px";
        option.appendChild(colorSquare);
        option.appendChild(text);
        option.addEventListener("click", () => {
            button.innerHTML = "";
            button.appendChild(getColorSquare(color.hex));
            container.setAttribute("title", translateColor(color.name));
            $('[data-toggle="tooltip"]').tooltip("dispose");
            $('[data-toggle="tooltip"]').tooltip();
            runCustomStudMap();
        });
        dropdown.appendChild(option);
    });

    container.setAttribute("data-toggle", "tooltip");
    container.setAttribute("data-placement", tooltipPosition);
    container.setAttribute("title", translateColor(DEFAULT_COLOR_NAME));
    setTimeout(() => $('[data-toggle="tooltip"]').tooltip(), 10);
    container.appendChild(button);
    container.appendChild(dropdown);
    return container;
}

const paintbrushDropdown = getColorSelectorDropdown("top");
paintbrushDropdown.children[0].id = "paintbrush-color-dropdown";
paintbrushDropdown.children[0].className = "btn paintbrush-controls-button";
paintbrushDropdown.style = "height: 100%;";
document.getElementById("paintbrush-controls").appendChild(paintbrushDropdown);

function getNewCustomStudRow() {
    const studRow = document.createElement("tr");

    const removeButton = document.createElement("button");
    removeButton.className = "btn btn-danger";
    removeButton.style = "padding: 2px; margin-left: 4px;";
    removeButton.innerHTML = "X";
    removeButton.addEventListener("click", () => {
        customStudTableBody.removeChild(studRow);
        runCustomStudMap();
    });

    const colorCell = document.createElement("td");
    const colorInput = getColorSelectorDropdown();
    colorCell.appendChild(colorInput);
    studRow.appendChild(colorCell);

    const numberCell = document.createElement("td");
    const numberCellChild = document.createElement("div");
    const numberInput = document.createElement("input");
    numberInput.style = "max-width: 80px";
    numberInput.type = "number";
    numberInput.value = 10;
    numberInput.className = "form-control form-control-sm piece-count-input";
    numberInput.addEventListener("change", (v) => {
        numberInput.value = Math.round(Math.min(Math.max(parseFloat(numberInput.value) || 0, 0), 99999));
        runCustomStudMap();
    });
    numberInput.hidden =
        document.getElementById("infinite-piece-count-check").checked ||
        Object.keys(quantizationAlgorithmToTraditionalDitheringKernel).includes(quantizationAlgorithm) ||
        ("" + selectedPixelPartNumber).match("^variable.*$");
    infinityPlaceholder = document.createElement("div");
    infinityPlaceholder.hidden = !numberInput.hidden;
    infinityPlaceholder.className = "piece-count-infinity-placeholder";
    infinityPlaceholder.innerHTML = "∞";
    numberCellChild.style = "display: flex; flex-direction: horizontal;";
    numberCellChild.appendChild(numberInput);
    numberCellChild.appendChild(infinityPlaceholder);

    numberCellChild.appendChild(removeButton);
    numberCell.appendChild(numberCellChild);
    studRow.appendChild(numberCell);
    return studRow;
}

document.getElementById("add-custom-stud-button").addEventListener("click", () => {
    const studRow = getNewCustomStudRow();

    customStudTableBody.appendChild(studRow);
    runCustomStudMap();
});

const onHueChange = (useDebounce = true) => {
    document.getElementById("hue-text").innerHTML = document.getElementById("hue-slider").value + "<span>&#176;</span>";
    if (useDebounce) {
        debouncedRunStep2();
    } else {
        runStep2();
    }
};
document.getElementById("hue-slider").addEventListener("change", () => onHueChange(false), false);
document.getElementById("hue-slider").addEventListener("input", () => onHueChange(true), false);
document.getElementById("hue-increment").addEventListener(
    "click",
    () => {
        if (Number(document.getElementById("hue-slider").value) < Number(document.getElementById("hue-slider").max)) {
            document.getElementById("hue-slider").value = Number(document.getElementById("hue-slider").value) + 1;
            onHueChange();
        }
    },
    false
);
document.getElementById("hue-decrement").addEventListener(
    "click",
    () => {
        if (Number(document.getElementById("hue-slider").value) > Number(document.getElementById("hue-slider").min)) {
            document.getElementById("hue-slider").value = Number(document.getElementById("hue-slider").value) - 1;
            onHueChange();
        }
    },
    false
);

const onSaturationChange = (useDebounce = true) => {
    document.getElementById("saturation-text").innerHTML = document.getElementById("saturation-slider").value + "%";
    if (useDebounce) {
        debouncedRunStep2();
    } else {
        runStep2();
    }
};
document.getElementById("saturation-slider").addEventListener("change", () => onSaturationChange(false), false);
document.getElementById("saturation-slider").addEventListener("input", () => onSaturationChange(true), false);
document.getElementById("saturation-increment").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("saturation-slider").value) <
            Number(document.getElementById("saturation-slider").max)
        ) {
            document.getElementById("saturation-slider").value =
                Number(document.getElementById("saturation-slider").value) + 1;
            onSaturationChange();
        }
    },
    false
);
document.getElementById("saturation-decrement").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("saturation-slider").value) >
            Number(document.getElementById("saturation-slider").min)
        ) {
            document.getElementById("saturation-slider").value =
                Number(document.getElementById("saturation-slider").value) - 1;
            onSaturationChange();
        }
    },
    false
);

const onValueChange = (useDebounce = true) => {
    document.getElementById("value-text").innerHTML = document.getElementById("value-slider").value + "%";
    if (useDebounce) {
        debouncedRunStep2();
    } else {
        runStep2();
    }
};
document.getElementById("value-slider").addEventListener("change", () => onValueChange(false), false);
document.getElementById("value-slider").addEventListener("input", () => onValueChange(true), false);
document.getElementById("value-increment").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("value-slider").value) < Number(document.getElementById("value-slider").max)
        ) {
            document.getElementById("value-slider").value = Number(document.getElementById("value-slider").value) + 1;
            onValueChange();
        }
    },
    false
);
document.getElementById("value-decrement").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("value-slider").value) > Number(document.getElementById("value-slider").min)
        ) {
            document.getElementById("value-slider").value = Number(document.getElementById("value-slider").value) - 1;
            onValueChange();
        }
    },
    false
);

const onBrightnessChange = (useDebounce = true) => {
    document.getElementById("brightness-text").innerHTML =
        (document.getElementById("brightness-slider").value > 0 ? "+" : "") +
        document.getElementById("brightness-slider").value;
    if (useDebounce) {
        debouncedRunStep2();
    } else {
        runStep2();
    }
};
document.getElementById("brightness-slider").addEventListener("change", () => onBrightnessChange(false), false);
document.getElementById("brightness-slider").addEventListener("input", () => onBrightnessChange(true), false);
document.getElementById("brightness-increment").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("brightness-slider").value) <
            Number(document.getElementById("brightness-slider").max)
        ) {
            document.getElementById("brightness-slider").value =
                Number(document.getElementById("brightness-slider").value) + 1;
            onBrightnessChange();
        }
    },
    false
);
document.getElementById("brightness-decrement").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("brightness-slider").value) >
            Number(document.getElementById("brightness-slider").min)
        ) {
            document.getElementById("brightness-slider").value =
                Number(document.getElementById("brightness-slider").value) - 1;
            onBrightnessChange();
        }
    },
    false
);

const onContrastChange = (useDebounce = true) => {
    document.getElementById("contrast-text").innerHTML =
        (document.getElementById("contrast-slider").value > 0 ? "+" : "") +
        document.getElementById("contrast-slider").value;
    if (useDebounce) {
        debouncedRunStep2();
    } else {
        runStep2();
    }
};
document.getElementById("contrast-slider").addEventListener("change", () => onContrastChange(false), false);
document.getElementById("contrast-slider").addEventListener("input", () => onContrastChange(true), false);
document.getElementById("contrast-increment").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("contrast-slider").value) <
            Number(document.getElementById("contrast-slider").max)
        ) {
            document.getElementById("contrast-slider").value =
                Number(document.getElementById("contrast-slider").value) + 1;
            onContrastChange();
        }
    },
    false
);
document.getElementById("contrast-decrement").addEventListener(
    "click",
    () => {
        if (
            Number(document.getElementById("contrast-slider").value) >
            Number(document.getElementById("contrast-slider").min)
        ) {
            document.getElementById("contrast-slider").value =
                Number(document.getElementById("contrast-slider").value) - 1;
            onContrastChange();
        }
    },
    false
);

function onDepthMapCountChange() {
    const numLevels = Number(document.getElementById("num-depth-levels-slider").value);
    overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
    document.getElementById("num-depth-levels-text").innerHTML = numLevels;
    const inputs = [];
    const inputsContainer = document.getElementById("depth-threshold-sliders-containers");
    inputsContainer.innerHTML = "";
    for (let i = 0; i < numLevels - 1; i++) {
        const input = document.createElement("input");
        input.type = "range";
        input.min = 0;
        input.max = 255;
        input.value = Math.floor(255 * ((i + 1) / numLevels));
        input.style = "width: 100%";
        input.addEventListener("change", () => {
            for (let j = 0; j < i; j++) {
                inputs[j].value = Math.min(inputs[j].value, input.value);
            }
            for (let j = i + 1; j < numLevels - 1; j++) {
                inputs[j].value = Math.max(inputs[j].value, input.value);
            }
            runStep1();
        });
        inputs.push(input);
        inputsContainer.appendChild(input);
    }

    [...document.getElementsByClassName("threshold-plural-s")].forEach((s) => (s.hidden = numLevels < 3));

    runStep1();
}

document.getElementById("num-depth-levels-slider").addEventListener("change", onDepthMapCountChange, false);

document.getElementById("reset-hsv-button").addEventListener(
    "click",
    () => {
        document.getElementById("hue-slider").value = 0;
        document.getElementById("saturation-slider").value = 0;
        document.getElementById("value-slider").value = 0;
        document.getElementById("hue-text").innerHTML =
            document.getElementById("hue-slider").value + "<span>&#176;</span>";
        document.getElementById("saturation-text").innerHTML = document.getElementById("saturation-slider").value + "%";
        document.getElementById("value-text").innerHTML = document.getElementById("value-slider").value + "%";
        runStep2();
    },
    false
);

document.getElementById("reset-brightness-button").addEventListener(
    "click",
    () => {
        document.getElementById("brightness-slider").value = 0;
        document.getElementById("brightness-text").innerHTML = document.getElementById("brightness-slider").value;
        runStep2();
    },
    false
);

document.getElementById("reset-contrast-button").addEventListener(
    "click",
    () => {
        document.getElementById("contrast-slider").value = 0;
        document.getElementById("contrast-text").innerHTML = document.getElementById("contrast-slider").value;
        runStep2();
    },
    false
);

function runStep1() {
    disableInteraction();
    updateStudCountText();
    invalidateStepsFrom(2);

    window.URL.revokeObjectURL(document.getElementById("export-stud-map-button").href);
    document.getElementById("export-stud-map-button").setAttribute(
        "href",
        window.URL.createObjectURL(
            new Blob(
                [
                    JSON.stringify({
                        studMap: selectedStudMap,
                        sortedStuds: Object.keys(selectedStudMap),
                    }),
                ],
                {
                    type: "text/plain",
                }
            )
        )
    );

    step1DepthCanvasUpscaled.width = step1CanvasUpscaled.width;
    step1DepthCanvasUpscaled.height = step1CanvasUpscaled.height;
    step1DepthCanvasUpscaledContext.drawImage(
        inputDepthCanvas,
        0,
        0,
        step1CanvasUpscaled.width,
        step1CanvasUpscaled.height
    );
    setTimeout(() => {
        stepProcessed[1] = true;
        enableInteraction();
    }, 1);
}

function runStep1Only() {
    runStep1();
}

// Debounced version of runStep2 for slider interactions
const debouncedRunStep2 = debounce(() => {
    runStep2();
}, DEBOUNCE_DELAY);

function runStep2() {
    disableInteraction();
    invalidateStepsFrom(3);
    let inputPixelArray;
    if (selectedInterpolationAlgorithm === "default") {
        const croppedCanvas = inputImageCropper.getCroppedCanvas({
            width: targetResolution[0],
            height: targetResolution[1],
            maxWidth: 4096,
            maxHeight: 4096,
            imageSmoothingEnabled: false,
        });
        inputPixelArray = getPixelArrayFromCanvas(croppedCanvas);
    } else {
        // We're using adaptive pooling
        const croppedCanvas = inputImageCropper.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            imageSmoothingEnabled: false,
        });
        rawCroppedData = getPixelArrayFromCanvas(croppedCanvas);
        let subArrayPoolingFunction;
        if (selectedInterpolationAlgorithm === "maxPooling") {
            subArrayPoolingFunction = maxPoolingKernel;
        } else if (selectedInterpolationAlgorithm === "minPooling") {
            subArrayPoolingFunction = minPoolingKernel;
        } else if (selectedInterpolationAlgorithm === "avgPooling") {
            subArrayPoolingFunction = avgPoolingKernel;
        } else {
            //  selectedInterpolationAlgorithm === "dualMinMaxPooling"
            subArrayPoolingFunction = dualMinMaxPoolingKernel;
        }
        inputPixelArray = resizeImagePixelsWithAdaptivePooling(
            rawCroppedData,
            croppedCanvas.width,
            targetResolution[0],
            targetResolution[1],
            subArrayPoolingFunction
        );
    }
    let filteredPixelArray = applyHSVAdjustment(
        inputPixelArray,
        document.getElementById("hue-slider").value,
        document.getElementById("saturation-slider").value / 100,
        document.getElementById("value-slider").value / 100
    );
    filteredPixelArray = applyBrightnessAdjustment(
        filteredPixelArray,
        Number(document.getElementById("brightness-slider").value)
    );
    filteredPixelArray = applyContrastAdjustment(
        filteredPixelArray,
        Number(document.getElementById("contrast-slider").value)
    );
    step2Canvas.width = targetResolution[0];
    step2Canvas.height = targetResolution[1];
    drawPixelsOnCanvas(filteredPixelArray, step2Canvas);

    step2DepthCanvas.width = targetResolution[0];
    step2DepthCanvas.height = targetResolution[1];

    // Map the crop to the depth image
    const cropperData = inputImageCropper.getData();
    const rawCroppedDepthImage = step1DepthCanvasUpscaledContext.getImageData(
        cropperData.x,
        cropperData.y,
        cropperData.width,
        cropperData.height
    );
    const cropperBufferCanvas = document.getElementById("step-2-depth-canvas-cropper-buffer");
    const cropperBufferCanvasContext = cropperBufferCanvas.getContext("2d");
    cropperBufferCanvas.width = targetResolution[0];
    cropperBufferCanvas.height = targetResolution[1];
    cropperBufferCanvasContext.drawImage(
        step1DepthCanvasUpscaled,
        cropperData.x,
        cropperData.y,
        cropperData.width,
        cropperData.height,
        0,
        0,
        targetResolution[0],
        targetResolution[1]
    );
    const inputDepthPixelArray = getPixelArrayFromCanvas(cropperBufferCanvas);

    const discreteDepthPixels = getDiscreteDepthPixels(
        inputDepthPixelArray,
        [...document.getElementById("depth-threshold-sliders-containers").children].map((slider) =>
            Number(slider.value)
        )
    );
    drawPixelsOnCanvas(discreteDepthPixels, step2DepthCanvas);

    setTimeout(() => {
        stepProcessed[2] = true;
        step2CanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step2CanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        step2CanvasUpscaledContext.imageSmoothingEnabled = false;
        step2CanvasUpscaledContext.drawImage(
            step2Canvas,
            0,
            0,
            targetResolution[0] * SCALING_FACTOR,
            targetResolution[1] * SCALING_FACTOR
        );
        step2DepthCanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step2DepthCanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        drawStudImageOnCanvas(
            scaleUpDiscreteDepthPixelsForDisplay(
                discreteDepthPixels,
                document.getElementById("num-depth-levels-slider").value
            ),
            targetResolution[0],
            SCALING_FACTOR,
            step2DepthCanvasUpscaled,
            selectedPixelPartNumber
        );
        // Auto-chain: if on visual step 2 (painting canvas visible), also run step 3
        if (typeof currentVisualStep !== 'undefined' && currentVisualStep === 2) {
            runStep3();
        } else {
            enableInteraction();
        }
    }, 1);
}

function runStep2Only() {
    runStep2();
}

function getVariablePixelAvailablePartDimensions() {
    const availableParts = [...document.getElementById("pixel-dimensions-container").children]
        .map((div) => div.children[0])
        .map((label) => label.children[0])
        .filter((input) => input.checked)
        .filter((input) => {
            const className = input.className;
            const uniqueVariablePixelName = selectedPixelPartNumber.replace("variable_", "");
            return className.includes(uniqueVariablePixelName);
        })
        .map((input) => input.name)
        .map((part) => part.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR).map((dimension) => Number(dimension)));
    const flippedParts = [];
    availableParts.forEach((part) => {
        if (part[0] !== part[1]) {
            flippedParts.push([part[1], part[0]]);
        }
    });
    flippedParts.forEach((part) => availableParts.push(part));
    return availableParts;
}

// only non null if pixel piece is variable
let step3VariablePixelPieceDimensions = null;

function runStep3() {
    disableInteraction();
    invalidateStepsFrom(4);
    const fiteredPixelArray = getPixelArrayFromCanvas(step2Canvas);

    let alignedPixelArray;

    // TODO: Apply overrides separately
    if (quantizationAlgorithm === "twoPhase") {
        alignedPixelArray = alignPixelsToStudMap(
            fiteredPixelArray,
            isBleedthroughEnabled() ? getDarkenedStudMap(selectedStudMap) : selectedStudMap,
            colorDistanceFunction
        );
    } else if (quantizationAlgorithm === "greedy" || quantizationAlgorithm === "greedyWithDithering") {
        alignedPixelArray = correctPixelsForAvailableStudsWithGreedyDynamicDithering(
            isBleedthroughEnabled() ? getDarkenedStudMap(selectedStudMap) : selectedStudMap,
            fiteredPixelArray,
            targetResolution[0],
            colorDistanceFunction,
            quantizationAlgorithm !== "greedyWithDithering", // skipDithering
            true // assumeInfinitePixelCounts
        );
    } else {
        // assume we're dealing with a traditional error dithering algorithm
        const ditheringKernel = quantizationAlgorithmToTraditionalDitheringKernel[quantizationAlgorithm];
        alignedPixelArray = alignPixelsWithTraditionalDithering(
            isBleedthroughEnabled() ? getDarkenedStudMap(selectedStudMap) : selectedStudMap,
            fiteredPixelArray,
            targetResolution[0],
            colorDistanceFunction,
            ditheringKernel
        );
    }

    step3PixelArrayForEraser = alignedPixelArray;
    alignedPixelArray = getArrayWithOverridesApplied(
        alignedPixelArray,
        isBleedthroughEnabled() ? getDarkenedImage(overridePixelArray) : overridePixelArray
    );

    step3DepthCanvas.width = targetResolution[0];
    step3DepthCanvas.height = targetResolution[1];
    const inputDepthPixelArray = getPixelArrayFromCanvas(step2DepthCanvas);

    const adjustedDepthPixelArray = getArrayWithOverridesApplied(inputDepthPixelArray, overrideDepthPixelArray);

    drawPixelsOnCanvas(adjustedDepthPixelArray, step3DepthCanvas);

    if (("" + selectedPixelPartNumber).match("^variable.*$")) {
        const alignedPixelMatrix = convertPixelArrayToMatrix(alignedPixelArray, targetResolution[0]);
        step3VariablePixelPieceDimensions = new Array();
        for (let i = 0; i < targetResolution[1]; i++) {
            step3VariablePixelPieceDimensions.push([]);
            step3VariablePixelPieceDimensions[i] = [];
            for (let j = 0; j < targetResolution[0]; j++) {
                step3VariablePixelPieceDimensions[i].push(null);
            }
        }
        const uniqueColors = Object.keys(getUsedPixelsStudMap(alignedPixelArray));
        const availableParts = getVariablePixelAvailablePartDimensions();
        for (
            let depthLevel = 0;
            depthLevel < Number(document.getElementById("num-depth-levels-slider").value);
            depthLevel++
        ) {
            uniqueColors.forEach((colorHex) => {
                const colorRGB = hexToRgb(colorHex);
                const setPixelMatrix = getSetPixelMatrixFromInputMatrix(alignedPixelMatrix, (p, i, j) => {
                    return !(
                        (!depthEnabled || depthLevel === adjustedDepthPixelArray[4 * (i * targetResolution[0] + j)]) &&
                        p[0] === colorRGB[0] &&
                        p[1] === colorRGB[1] &&
                        p[2] === colorRGB[2]
                    );
                });
                const requiredPartMatrix = getRequiredPartMatrixFromSetPixelMatrix(
                    setPixelMatrix,
                    availableParts,
                    PLATE_WIDTH
                );
                requiredPartMatrix.forEach((row, i) => {
                    row.forEach((entry, j) => {
                        step3VariablePixelPieceDimensions[i][j] = step3VariablePixelPieceDimensions[i][j] || entry;
                    });
                });
            });
        }
    } else {
        step3VariablePixelPieceDimensions = null;
    }

    step3Canvas.width = targetResolution[0];
    step3Canvas.height = targetResolution[1];
    drawPixelsOnCanvas(alignedPixelArray, step3Canvas);

    step3CanvasPixelsForHover = isBleedthroughEnabled()
        ? revertDarkenedImage(
              alignedPixelArray,
              getDarkenedStudsToStuds(ALL_BRICKLINK_SOLID_COLORS.map((color) => color.hex))
          )
        : alignedPixelArray;
    step3DepthCanvasPixelsForHover = adjustedDepthPixelArray;

    setTimeout(() => {
        stepProcessed[3] = true;
        enableInteraction();
        step3CanvasUpscaledContext.imageSmoothingEnabled = false;
        drawStudImageOnCanvas(
            isBleedthroughEnabled()
                ? revertDarkenedImage(
                      alignedPixelArray,
                      getDarkenedStudsToStuds(ALL_BRICKLINK_SOLID_COLORS.map((color) => color.hex))
                  )
                : alignedPixelArray,
            targetResolution[0],
            SCALING_FACTOR,
            step3CanvasUpscaled,
            selectedPixelPartNumber,
            step3VariablePixelPieceDimensions
        );
        step3DepthCanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step3DepthCanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        drawStudImageOnCanvas(
            scaleUpDiscreteDepthPixelsForDisplay(
                adjustedDepthPixelArray,
                document.getElementById("num-depth-levels-slider").value
            ),
            targetResolution[0],
            SCALING_FACTOR,
            step3DepthCanvasUpscaled,
            selectedPixelPartNumber
        );
    }, 1);
}

function runStep3Only() {
    runStep3();
}

let isStep3ViewExpanded = false;

function onDepthOverrideDecrease(row, col) {
    onDepthOverrideChange(row, col, false);
}

function onDepthOverrideIncrease(row, col) {
    onDepthOverrideChange(row, col, true);
}

function onDepthOverrideChange(row, col, isIncrease) {
    if (!document.getElementById("step-3-depth-1-collapse").className.includes("show")) {
        return; // only override if the refine depth section is expanded
    }
    const pixelIndex = 4 * (row * targetResolution[0] + col);
    const step2DepthImagePixels = getPixelArrayFromCanvas(step2DepthCanvas);
    const currentVal =
        overrideDepthPixelArray[pixelIndex] != null
            ? overrideDepthPixelArray[pixelIndex]
            : step2DepthImagePixels[pixelIndex];

    let newVal = currentVal;
    if (isIncrease) {
        newVal = Math.min(newVal + 1, Number(document.getElementById("num-depth-levels-slider").value - 1));
    } else {
        newVal = Math.max(newVal - 1, 0);
    }

    const pixelDisplayVal = newVal;
    if (newVal === step2DepthImagePixels[pixelIndex]) {
        newVal = null;
    }
    for (var i = 0; i < 3; i++) {
        overrideDepthPixelArray[pixelIndex + i] = newVal;
    }

    if (isStep3ViewExpanded) {
        // do stuff directly on the canvas for perf
        const upscaledPixelDisplayVal = Math.round(
            Math.min(
                (255 * (pixelDisplayVal + 1)) / Number(document.getElementById("num-depth-levels-slider").value),
                255
            )
        );
        const radius = SCALING_FACTOR / 2;
        const i = pixelIndex / 4;
        const ctx = step3DepthCanvasUpscaledContext;
        const width = targetResolution[0];
        ctx.beginPath();
        ctx.arc(((i % width) * 2 + 1) * radius, (Math.floor(i / width) * 2 + 1) * radius, radius, 0, 2 * Math.PI);
        ctx.fillStyle = rgbToHex(upscaledPixelDisplayVal, upscaledPixelDisplayVal, upscaledPixelDisplayVal);
        ctx.fill();
    } else {
        runStep3();
    }
}

function onCherryPickColor(row, col) {
    const pixelIndex = 4 * (row * targetResolution[0] + col);
    const isOverridden =
        overridePixelArray[pixelIndex] !== null &&
        overridePixelArray[pixelIndex + 1] !== null &&
        overridePixelArray[pixelIndex + 2] !== null;

    const step3PixelArray = isBleedthroughEnabled()
        ? revertDarkenedImage(
              getPixelArrayFromCanvas(step3Canvas),
              getDarkenedStudsToStuds(ALL_BRICKLINK_SOLID_COLORS.map((color) => color.hex))
          )
        : getPixelArrayFromCanvas(step3Canvas);

    const colorHex = isOverridden
        ? rgbToHex(
              overridePixelArray[pixelIndex],
              overridePixelArray[pixelIndex + 1],
              overridePixelArray[pixelIndex + 2]
          )
        : rgbToHex(step3PixelArray[pixelIndex], step3PixelArray[pixelIndex + 1], step3PixelArray[pixelIndex + 2]);
    document.getElementById("paintbrush-controls").children[0].children[0].children[0].style.backgroundColor = colorHex;
    const hexName = ALL_BRICKLINK_SOLID_COLORS.find((color) => color.hex === colorHex).name;
    document.getElementById("paintbrush-controls").children[0].setAttribute("title", hexName);
    $('[data-toggle="tooltip"]').tooltip("dispose");
    $('[data-toggle="tooltip"]').tooltip();
}

let activePaintbrushHex = null; // null iff we don't want to paint
let wasPaintbrushUsed = false; // only propogate changes on mouse leave if this is true
let step3CanvasHoveredPixel = null;
let step3CanvasPixelsForHover = null; // only used for perf

function onStep3PaintingMouseLift() {
    activePaintbrushHex = null;
    // propogate changes
    if (!isStep3ViewExpanded && wasPaintbrushUsed) {
        disableInteraction();
        runStep3();
        wasPaintbrushUsed = false;
    }
}

step3CanvasUpscaled.addEventListener(
    "mousedown",
    function (event) {
        wasPaintbrushUsed = true;
        const rawRow =
            event.clientY -
            step3CanvasUpscaled.getBoundingClientRect().y -
            step3CanvasUpscaled.offsetHeight / targetResolution[1] / 2;
        const rawCol =
            event.clientX -
            step3CanvasUpscaled.getBoundingClientRect().x -
            step3CanvasUpscaled.offsetWidth / targetResolution[0] / 2;
        const row = Math.round((rawRow * targetResolution[1]) / step3CanvasUpscaled.offsetHeight);
        const col = Math.round((rawCol * targetResolution[0]) / step3CanvasUpscaled.offsetWidth);
        const rgb = document
            .getElementById("paintbrush-controls")
            .children[0].children[0].children[0].style.backgroundColor.replace("rgb(", "")
            .replace(")", "")
            .split(/,\s*/)
            .map((shade) => parseInt(shade));
        activePaintbrushHex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        onMouseMoveOverStep3Canvas(event); // so we paint on a single click
    },
    false
);

let selectedPaintbrushTool = "paintbrush-tool-dropdown-option";
Array.from(document.getElementById("paintbrush-tool-selection-dropdown-options").children).forEach((item) => {
    const value = item.id;
    item.addEventListener("click", () => {
        selectedPaintbrushTool = value;
        document.getElementById("paintbrush-color-dropdown").disabled = value !== "paintbrush-tool-dropdown-option";
        document.getElementById("paintbrush-tool-selection-dropdown").innerHTML = item.children[0].innerHTML;
    });
});

let step3PixelArrayForEraser = null;

function onMouseMoveOverStep3Canvas(event) {
    if (!document.getElementById("universal-loading-progress").hidden) {
        return; // ignore this - interaction is disabled because we're loading/working
    }
    const rawRow =
        event.clientY -
        step3CanvasUpscaled.getBoundingClientRect().y -
        step3CanvasUpscaled.offsetHeight / targetResolution[1] / 2;
    const rawCol =
        event.clientX -
        step3CanvasUpscaled.getBoundingClientRect().x -
        step3CanvasUpscaled.offsetWidth / targetResolution[0] / 2;
    const row = Math.round((rawRow * targetResolution[1]) / step3CanvasUpscaled.offsetHeight);
    const col = Math.round((rawCol * targetResolution[0]) / step3CanvasUpscaled.offsetWidth);

    const pixelIndex = 4 * (row * targetResolution[0] + col);
    const i = pixelIndex / 4;
    const ctx = step3CanvasUpscaledContext;
    const width = targetResolution[0];
    const radius = SCALING_FACTOR / 2;

    if (activePaintbrushHex != null) {
        // mouse is clicked down, so we're handling the click

        if (selectedPaintbrushTool === "paintbrush-tool-dropdown-option") {
            const colorRGB = hexToRgb(activePaintbrushHex);
            // we want to paint - update the override pixel array
            // do stuff directly on the canvas for perf
            ctx.beginPath();
            ctx.arc(((i % width) * 2 + 1) * radius, (Math.floor(i / width) * 2 + 1) * radius, radius, 0, 2 * Math.PI);
            ctx.fillStyle = activePaintbrushHex;
            ctx.fill();

            // update the override pixel array in place
            overridePixelArray[pixelIndex] = colorRGB[0];
            overridePixelArray[pixelIndex + 1] = colorRGB[1];
            overridePixelArray[pixelIndex + 2] = colorRGB[2];
        } else if (selectedPaintbrushTool === "eraser-tool-dropdown-option") {
            // null out the override
            if (
                overridePixelArray[pixelIndex] != null &&
                overridePixelArray[pixelIndex + 1] != null &&
                overridePixelArray[pixelIndex + 2] != null
            ) {
                // do stuff directly on the canvas for perf
                ctx.beginPath();
                ctx.arc(
                    ((i % width) * 2 + 1) * radius,
                    (Math.floor(i / width) * 2 + 1) * radius,
                    radius,
                    0,
                    2 * Math.PI
                );
                ctx.fillStyle = rgbToHex(
                    step3PixelArrayForEraser[pixelIndex],
                    step3PixelArrayForEraser[pixelIndex + 1],
                    step3PixelArrayForEraser[pixelIndex + 2]
                );
                ctx.fill();

                // update the override pixel array in place
                overridePixelArray[pixelIndex] = null;
                overridePixelArray[pixelIndex + 1] = null;
                overridePixelArray[pixelIndex + 2] = null;
            }
        } else {
            // dropper tool
            onCherryPickColor(row, col);
        }
    } else if (pixelIndex + 2 < step3CanvasPixelsForHover.length) {
        // we're not painting - highlight the pixel instead
        const hoveredPixelRGB = [
            step3CanvasPixelsForHover[pixelIndex],
            step3CanvasPixelsForHover[pixelIndex + 1],
            step3CanvasPixelsForHover[pixelIndex + 2],
        ];
        const hoveredPixelHex = rgbToHex(hoveredPixelRGB[0], hoveredPixelRGB[1], hoveredPixelRGB[2]);
        ctx.beginPath();
        ctx.arc(((i % width) * 2 + 1) * radius, (Math.floor(i / width) * 2 + 1) * radius, radius / 2, 0, 2 * Math.PI);
        ctx.fillStyle = inverseHex(hoveredPixelHex);
        ctx.fill();
    }

    if (step3CanvasHoveredPixel != null && (step3CanvasHoveredPixel[0] !== row || step3CanvasHoveredPixel[1] !== col)) {
        // Clear out old highlight
        const i = step3CanvasHoveredPixel[0] * width + step3CanvasHoveredPixel[1];
        const pixelIndex = i * 4;

        ctx.beginPath();
        ctx.arc(((i % width) * 2 + 1) * radius, (Math.floor(i / width) * 2 + 1) * radius, radius / 2, 0, 2 * Math.PI);

        let originalPixelRGB = [
            overridePixelArray[pixelIndex] || step3CanvasPixelsForHover[pixelIndex],
            overridePixelArray[pixelIndex + 1] || step3CanvasPixelsForHover[pixelIndex + 1],
            overridePixelArray[pixelIndex + 2] || step3CanvasPixelsForHover[pixelIndex + 2],
        ];
        const originalPixelHex = rgbToHex(originalPixelRGB[0], originalPixelRGB[1], originalPixelRGB[2]);

        ctx.fillStyle = originalPixelHex;
        ctx.fill();
    }
    step3CanvasHoveredPixel = [row, col];
}

step3CanvasUpscaled.addEventListener("mouseup", onStep3PaintingMouseLift, false);

step3CanvasUpscaled.addEventListener(
    "mouseleave",
    () => {
        if (step3CanvasHoveredPixel != null) {
            // Clear out old highlight
            const i = step3CanvasHoveredPixel[0] * targetResolution[0] + step3CanvasHoveredPixel[1];
            const pixelIndex = i * 4;

            const radius = SCALING_FACTOR / 2;
            step3CanvasUpscaledContext.beginPath();
            step3CanvasUpscaledContext.arc(
                ((i % targetResolution[0]) * 2 + 1) * radius,
                (Math.floor(i / targetResolution[0]) * 2 + 1) * radius,
                radius / 2,
                0,
                2 * Math.PI
            );

            let originalPixelRGB = [
                overridePixelArray[pixelIndex] || step3CanvasPixelsForHover[pixelIndex],
                overridePixelArray[pixelIndex + 1] || step3CanvasPixelsForHover[pixelIndex + 1],
                overridePixelArray[pixelIndex + 2] || step3CanvasPixelsForHover[pixelIndex + 2],
            ];
            const originalPixelHex = rgbToHex(originalPixelRGB[0], originalPixelRGB[1], originalPixelRGB[2]);

            step3CanvasUpscaledContext.fillStyle = originalPixelHex;
            step3CanvasUpscaledContext.fill();
        }

        step3CanvasHoveredPixel = null;
        onStep3PaintingMouseLift();
    },
    false
);

step3CanvasUpscaled.addEventListener("mousemove", onMouseMoveOverStep3Canvas, false);

let isTouchInBounds = false;
step3CanvasUpscaled.addEventListener(
    "touchstart",
    function (e) {
        isTouchInBounds = true;
        const { clientX, clientY } = e.touches[0];
        const mouseEvent = new MouseEvent("mousedown", {
            clientX,
            clientY,
        });
        step3CanvasUpscaled.dispatchEvent(mouseEvent);
    },
    false
);
step3CanvasUpscaled.addEventListener(
    "touchend",
    function (e) {
        const mouseEvent = new MouseEvent("mouseup", {});
        step3CanvasUpscaled.dispatchEvent(mouseEvent);
    },
    false
);
step3CanvasUpscaled.addEventListener(
    "touchmove",
    function (e) {
        e.preventDefault(); // prevent scrolling
        if (!isTouchInBounds) {
            return;
        }
        const { clientX, clientY } = e.touches[0];

        let mouseEventType = "mousemove";
        if (step3CanvasUpscaled !== document.elementFromPoint(clientX, clientY)) {
            isTouchInBounds = false;
            mouseEventType = "mouseleave";
        }
        const mouseEvent = new MouseEvent(mouseEventType, {
            clientX,
            clientY,
        });
        step3CanvasUpscaled.dispatchEvent(mouseEvent);
    },
    false
);

step3DepthCanvasUpscaled.addEventListener(
    "contextmenu",
    function (event) {
        event.preventDefault();
        const rawRow =
            event.clientY -
            step3DepthCanvasUpscaled.getBoundingClientRect().y -
            step3DepthCanvasUpscaled.offsetHeight / targetResolution[1] / 2;
        const rawCol =
            event.clientX -
            step3DepthCanvasUpscaled.getBoundingClientRect().x -
            step3DepthCanvasUpscaled.offsetWidth / targetResolution[0] / 2;
        const row = Math.round((rawRow * targetResolution[1]) / step3DepthCanvasUpscaled.offsetHeight);
        const col = Math.round((rawCol * targetResolution[0]) / step3DepthCanvasUpscaled.offsetWidth);
        onDepthOverrideDecrease(row, col);
    },
    false
);

step3DepthCanvasUpscaled.addEventListener(
    "click",
    function (event) {
        const rawRow =
            event.clientY -
            step3DepthCanvasUpscaled.getBoundingClientRect().y -
            step3DepthCanvasUpscaled.offsetHeight / targetResolution[1] / 2;
        const rawCol =
            event.clientX -
            step3DepthCanvasUpscaled.getBoundingClientRect().x -
            step3DepthCanvasUpscaled.offsetWidth / targetResolution[0] / 2;
        const row = Math.round((rawRow * targetResolution[1]) / step3DepthCanvasUpscaled.offsetHeight);
        const col = Math.round((rawCol * targetResolution[0]) / step3DepthCanvasUpscaled.offsetWidth);
        onDepthOverrideIncrease(row, col);
    },
    false
);

let step3DepthCanvasPixelsForHover = null; // only used for perf
step3DepthCanvasUpscaled.addEventListener("mousemove", function (event) {
    if (!document.getElementById("step-3-depth-1-collapse").className.includes("show")) {
        return; // only highlight if the refine section is expanded
    }

    const rawRow =
        event.clientY -
        step3DepthCanvasUpscaled.getBoundingClientRect().y -
        step3DepthCanvasUpscaled.offsetHeight / targetResolution[1] / 2;
    const rawCol =
        event.clientX -
        step3DepthCanvasUpscaled.getBoundingClientRect().x -
        step3DepthCanvasUpscaled.offsetWidth / targetResolution[0] / 2;
    const pixelRow = Math.round((rawRow * targetResolution[1]) / step3DepthCanvasUpscaled.offsetHeight);
    const pixelCol = Math.round((rawCol * targetResolution[0]) / step3DepthCanvasUpscaled.offsetWidth);

    if (
        step3CanvasHoveredPixel == null ||
        step3CanvasHoveredPixel[0] != pixelRow ||
        step3CanvasHoveredPixel[1] != pixelCol
    ) {
        const ctx = step3DepthCanvasUpscaled.getContext("2d");

        ctx.lineWidth = 3;
        step4CanvasUpscaledContext.lineWidth = 3;

        const radius = SCALING_FACTOR / 2;
        const width = targetResolution[0];

        const i = pixelRow * width + pixelCol;

        ctx.beginPath();
        ctx.arc(((i % width) * 2 + 1) * radius, (Math.floor(i / width) * 2 + 1) * radius, radius / 2, 0, 2 * Math.PI);
        let hoveredPixelRGB = [
            step3CanvasPixelsForHover[i * 4],
            step3CanvasPixelsForHover[i * 4 + 1],
            step3CanvasPixelsForHover[i * 4 + 2],
        ];
        const hoveredPixelHex = rgbToHex(hoveredPixelRGB[0], hoveredPixelRGB[1], hoveredPixelRGB[2]);
        ctx.fillStyle = DEFAULT_COLOR;
        ctx.fill();

        if (step3CanvasHoveredPixel != null) {
            const i = step3CanvasHoveredPixel[0] * width + step3CanvasHoveredPixel[1];

            ctx.beginPath();
            ctx.arc(
                ((i % width) * 2 + 1) * radius,
                (Math.floor(i / width) * 2 + 1) * radius,
                radius / 2,
                0,
                2 * Math.PI
            );

            let originalPixelRGB = [
                step3CanvasPixelsForHover[i * 4],
                step3CanvasPixelsForHover[i * 4 + 1],
                step3CanvasPixelsForHover[i * 4 + 2],
            ];
            const depthValue = step3DepthCanvasPixelsForHover[i * 4];
            const scaledDepthValue = Math.round(
                Math.min((255 * (depthValue + 1)) / document.getElementById("num-depth-levels-slider").value, 255)
            );
            const originalPixelHex = rgbToHex(originalPixelRGB[0], originalPixelRGB[1], originalPixelRGB[2]);
            const originalDepthPixelHex = rgbToHex(scaledDepthValue, scaledDepthValue, scaledDepthValue);

            ctx.fillStyle = originalDepthPixelHex;
            ctx.fill();
        }
        step3CanvasHoveredPixel = [pixelRow, pixelCol];
    }
});

step3DepthCanvasUpscaled.addEventListener("mouseleave", function (event) {
    const ctx = step3DepthCanvasUpscaled.getContext("2d");

    if (step3CanvasHoveredPixel != null) {
        ctx.beginPath();
        ctx.rect(
            step3CanvasHoveredPixel[1] * SCALING_FACTOR,
            step3CanvasHoveredPixel[0] * SCALING_FACTOR,
            SCALING_FACTOR,
            SCALING_FACTOR
        );
        ctx.strokeStyle = "#000000";
        ctx.stroke();
        step4CanvasUpscaledContext.beginPath();
        step4CanvasUpscaledContext.rect(
            step3CanvasHoveredPixel[1] * SCALING_FACTOR,
            step3CanvasHoveredPixel[0] * SCALING_FACTOR,
            SCALING_FACTOR,
            SCALING_FACTOR
        );
        step4CanvasUpscaledContext.strokeStyle = "#000000";
        step4CanvasUpscaledContext.stroke();
    }
    step3CanvasHoveredPixel = null;
});

window.depthPreviewOptions = {};

function create3dPreview() {
    const app = new PIXI.Application({
        resizeTo: step4Canvas3dUpscaled,
        autoResize: true,
        resizeThrottle: 100,
    });

    step4Canvas3dUpscaled.innerHTML = "";
    step4Canvas3dUpscaled.appendChild(app.view);

    const img = new PIXI.Sprite.from(step4CanvasUpscaled.toDataURL("image/png", 1.0));

    img.width = Number(window.getComputedStyle(step4Canvas3dUpscaled).width.replace("px", ""));
    img.height = (img.width * targetResolution[1]) / targetResolution[0];
    app.stage.addChild(img);

    const depthMap = new PIXI.Sprite.from(step3DepthCanvasUpscaled.toDataURL("image/png", 1.0));
    app.stage.addChild(depthMap);

    const displacementFilter = new PIXI.filters.DisplacementFilter(depthMap);
    app.stage.filters = [displacementFilter];
    displacementFilter.scale.x = 0;
    displacementFilter.scale.y = 0;

    window.depthPreviewOptions = {
        app,
        img,
        depthMap,
        displacementFilter,
    };
    setTimeout(depthPreviewResize, 5);
}

document.getElementById("step-4-depth-tab").addEventListener("click", () => {
    const targetWidth = step4CanvasUpscaled.clientWidth;
    step4Canvas3dUpscaled.clientWidth = targetWidth;
    setTimeout(create3dPreview, 20);
});

function depthPreviewResize() {
    if (
        // for perf
        document.getElementById("step-4-depth-tab").className.includes("active")
    ) {
        const { app, img, depthMap } = window.depthPreviewOptions;
        const targetWidth = step4Canvas3dUpscaled.clientWidth;
        const targetHeight = (targetWidth * targetResolution[1]) / targetResolution[0];
        step4Canvas3dUpscaled.style.height = targetHeight + "px";
        app.renderer.resize(targetWidth, targetHeight);
        img.width = targetWidth;
        img.height = targetHeight;
        depthMap.width = targetWidth;
        depthMap.height = targetHeight;
    }
}

window.addEventListener("resize", depthPreviewResize);

step4Canvas3dUpscaled.addEventListener("mousemove", function (e) {
    if (
        // for perf
        document.getElementById("step-4-depth-tab").className.includes("active")
    ) {
        const { img, displacementFilter } = window.depthPreviewOptions;
        const displacementScale = Number(document.getElementById("3d-effect-intensity").value);
        const rawX = event.clientX - step4Canvas3dUpscaled.getBoundingClientRect().x;
        const rawY = event.clientY - step4Canvas3dUpscaled.getBoundingClientRect().y;
        displacementFilter.scale.x = (img.width / 2 - rawX) * displacementScale;
        displacementFilter.scale.y = (img.height / 2 - rawY) * displacementScale;
    }
});
step4Canvas3dUpscaled.addEventListener("mouseleave", function (e) {
    if (
        // for perf
        document.getElementById("step-4-depth-tab").className.includes("active")
    ) {
        const { displacementFilter } = window.depthPreviewOptions;
        displacementFilter.scale.x = 0;
        displacementFilter.scale.y = 0;
    }
});

document.getElementById("3d-effect-intensity").addEventListener("change", create3dPreview, false);

function runStep4(asyncCallback) {
    if (typeof updateMosaicProductMeta === 'function') updateMosaicProductMeta();
    disableInteraction();
    const step2PixelArray = getPixelArrayFromCanvas(step2Canvas);
    const step3PixelArray = getPixelArrayFromCanvas(step3Canvas);
    step4Canvas.width = 0;
    try {
        bricklinkCacheCanvas.width = targetResolution[0];
        bricklinkCacheCanvas.height = targetResolution[1];
        step4Canvas.width = targetResolution[0];
        step4Canvas.height = targetResolution[1];
        step4CanvasContext.clearRect(0, 0, targetResolution[0], targetResolution[1]);
        step4CanvasUpscaledContext.clearRect(
            0,
            0,
            targetResolution[0] * SCALING_FACTOR,
            targetResolution[1] * SCALING_FACTOR
        );

        // save perf by sidestepping step 4 if every available color could
        // theoretically fill the entire image on its owwn
        let shouldSideStepStep4 = true;
        Object.values(selectedStudMap).forEach((count) => {
            if (count < targetResolution[0] * targetResolution[1]) {
                shouldSideStepStep4 = false;
            }
        });

        // There are three reasons step 4 should be identical to step 3
        shouldSideStepStep4 =
            shouldSideStepStep4 ||
            document.getElementById("infinite-piece-count-check").checked ||
            Object.keys(quantizationAlgorithmToTraditionalDitheringKernel).includes(quantizationAlgorithm) ||
            ("" + selectedPixelPartNumber).match("^variable.*$");

        if (!shouldSideStepStep4) {
            const requiredStuds = targetResolution[0] * targetResolution[1];
            let availableStuds = 0;
            Array.from(customStudTableBody.children).forEach((stud) => {
                availableStuds += parseInt(stud.children[1].children[0].children[0].value);
            });
            const missingStuds = Math.max(requiredStuds - availableStuds, 0);
            if (missingStuds > 0) {
                throw "Step 4 failed"; // error will be caught and interaction will be enabled
            }
        }

        let availabilityCorrectedPixelArray;

        // if we're using a traditional error dithering algorithm, this has to be true
        if (shouldSideStepStep4) {
            availabilityCorrectedPixelArray = step3PixelArray;
        } else if (quantizationAlgorithm === "twoPhase") {
            availabilityCorrectedPixelArray = correctPixelsForAvailableStuds(
                step3PixelArray,
                isBleedthroughEnabled() ? getDarkenedStudMap(selectedStudMap) : selectedStudMap,
                step2PixelArray,
                isBleedthroughEnabled() ? getDarkenedImage(overridePixelArray) : overridePixelArray,
                selectedTiebreakTechnique,
                (document.getElementById("color-tie-grouping-factor-slider") || {value: 0.001}).value,
                targetResolution[0],
                colorDistanceFunction
            );
        } else {
            // quantizationAlgorithm === 'greedy' || quantizationAlgorithm === 'greedyWithDithering'
            availabilityCorrectedPixelArray = correctPixelsForAvailableStudsWithGreedyDynamicDithering(
                isBleedthroughEnabled() ? getDarkenedStudMap(selectedStudMap) : selectedStudMap,
                getArrayWithOverridesApplied(
                    step2PixelArray,
                    isBleedthroughEnabled() ? getDarkenedImage(overridePixelArray) : overridePixelArray
                ), // apply overrides before running GGD
                targetResolution[0],
                colorDistanceFunction,
                quantizationAlgorithm !== "greedyWithDithering", // skipDithering
                shouldSideStepStep4 // assumeInfinitePixelCounts
            );
        }

        drawPixelsOnCanvas(availabilityCorrectedPixelArray, step4Canvas);

        setTimeout(async () => {
            step4CanvasUpscaledContext.imageSmoothingEnabled = false;
            const pixelsToDraw = isBleedthroughEnabled()
                ? revertDarkenedImage(
                      availabilityCorrectedPixelArray,
                      getDarkenedStudsToStuds(ALL_BRICKLINK_SOLID_COLORS.map((color) => color.hex))
                  )
                : availabilityCorrectedPixelArray;
            drawPixelsOnCanvas(pixelsToDraw, bricklinkCacheCanvas);

            drawStudImageOnCanvas(
                pixelsToDraw,
                targetResolution[0],
                SCALING_FACTOR,
                step4CanvasUpscaled,
                selectedPixelPartNumber,
                step3VariablePixelPieceDimensions
            );

            // create stud map result table
            const usedPixelsStudMap = getUsedPixelsStudMap(pixelsToDraw);
            const usedPixelsTableBody = document.getElementById("studs-used-table-body");
            usedPixelsTableBody.innerHTML = "";
            const variablePixelsUsed = ("" + selectedPixelPartNumber).match("^variable.*$");
            document.getElementById("pieces-used-dimensions-header").hidden = !variablePixelsUsed;
            let pieceCountsForTable = {}; // map piece identifier strings to counts
            if (variablePixelsUsed) {
                const pixelMatrix = convertPixelArrayToMatrix(pixelsToDraw, targetResolution[0]);
                step3VariablePixelPieceDimensions.forEach((row, i) => {
                    row.forEach((pixelDimensions, j) => {
                        if (pixelDimensions != null) {
                            const pixelRGB = pixelMatrix[i][j];
                            const pixelHex = rgbToHex(pixelRGB[0], pixelRGB[1], pixelRGB[2]);
                            const sortedPixelDimensions =
                                pixelDimensions[0] < pixelDimensions[1]
                                    ? pixelDimensions
                                    : [pixelDimensions[1], pixelDimensions[0]];
                            studRowKey =
                                pixelHex +
                                "_" +
                                sortedPixelDimensions[0] +
                                PLATE_DIMENSIONS_DEPTH_SEPERATOR +
                                sortedPixelDimensions[1];
                            pieceCountsForTable[studRowKey] = (pieceCountsForTable[studRowKey] || 0) + 1;
                        }
                    });
                });
            } else {
                pieceCountsForTable = usedPixelsStudMap;
            }

            const usedColors = Object.keys(pieceCountsForTable);
            usedColors.sort();
            usedColors.forEach((keyString) => {
                const pieceKey = keyString.split("_");
                const color = pieceKey[0];
                const studRow = document.createElement("tr");
                studRow.style = "height: 1px;";

                const colorCell = document.createElement("td");
                const colorSquare = getColorSquare(color);
                colorCell.appendChild(colorSquare);
                const colorLabel = document.createElement("small");
                colorLabel.innerHTML = translateColor(HEX_TO_COLOR_NAME[color]) || color;
                colorCell.appendChild(colorLabel);
                studRow.appendChild(colorCell);

                if (pieceKey.length > 1) {
                    const dimensionsCell = document.createElement("td");
                    dimensionsCell.style = "height: inherit;";
                    const dimensionsCellChild = document.createElement("div");
                    dimensionsCellChild.style =
                        "height: 100%; display: flex; flex-direction:column; justify-content: center";
                    const dimensionsCellChild2 = document.createElement("div");
                    dimensionsCellChild2.style = "";
                    dimensionsCellChild2.innerHTML = pieceKey[1];

                    dimensionsCellChild.appendChild(dimensionsCellChild2);
                    dimensionsCell.appendChild(dimensionsCellChild);
                    studRow.appendChild(dimensionsCell);
                }

                const numberCell = document.createElement("td");
                numberCell.style = "height: inherit;";
                const numberCellChild = document.createElement("div");
                numberCellChild.style = "height: 100%; display: flex; flex-direction:column; justify-content: center";
                const numberCellChild2 = document.createElement("div");
                numberCellChild2.style = "";
                numberCellChild2.innerHTML = pieceCountsForTable[keyString];

                numberCellChild.appendChild(numberCellChild2);
                numberCell.appendChild(numberCellChild);
                studRow.appendChild(numberCell);

                usedPixelsTableBody.appendChild(studRow);
            });

            const missingPixelsTableBody = document.getElementById("studs-missing-table-body");
            missingPixelsTableBody.innerHTML = "";

            let missingPixelsExist = false;
            if (!shouldSideStepStep4) {
                // create stud map missing pieces table
                const missingPixelsStudMap = studMapDifference(
                    getUsedPixelsStudMap(
                        isBleedthroughEnabled()
                            ? revertDarkenedImage(
                                  step3PixelArray,
                                  getDarkenedStudsToStuds(ALL_BRICKLINK_SOLID_COLORS.map((color) => color.hex))
                              )
                            : step3PixelArray
                    ),
                    selectedStudMap
                );
                const usedColors = Object.keys(missingPixelsStudMap);
                usedColors.sort();
                usedColors.forEach((color) => {
                    if (missingPixelsStudMap[color] > 0) {
                        missingPixelsExist = true;
                        const studRow = document.createElement("tr");
                        studRow.style = "height: 1px;";

                        const colorCell = document.createElement("td");
                        const colorSquare = getColorSquare(color);
                        colorCell.appendChild(colorSquare);
                        const colorLabel = document.createElement("small");
                        colorLabel.innerHTML = translateColor(HEX_TO_COLOR_NAME[color]) || color;
                        colorCell.appendChild(colorLabel);
                        studRow.appendChild(colorCell);

                        const numberCell = document.createElement("td");
                        numberCell.style = "height: inherit;";
                        const numberCellChild = document.createElement("div");
                        numberCellChild.style =
                            "height: 100%; display: flex; flex-direction:column; justify-content: center";
                        const numberCellChild2 = document.createElement("div");
                        numberCellChild2.style = "";
                        numberCellChild2.innerHTML = missingPixelsStudMap[color];

                        numberCellChild.appendChild(numberCellChild2);
                        numberCell.appendChild(numberCellChild);
                        studRow.appendChild(numberCell);

                        missingPixelsTableBody.appendChild(studRow);
                    }
                });
            }
            document.getElementById("studs-missing-container").hidden = !missingPixelsExist;

            if (document.getElementById("step-4-depth-tab").className.includes("active")) {
                setTimeout(create3dPreview, 50); // TODO: find better way to check that input is finished
            }
            if (asyncCallback) {
                await asyncCallback();
            }
            stepProcessed[4] = true;
            enableInteraction();
        }, 1);
    } catch (_e) {
        enableInteraction();
    }
}

function runStep4Only() {
    runStep4();
}

function addWaterMark(pdf, isHighQuality) {
    // Watermark removed
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function setDPI(canvas, dpi) {
    // Set up CSS size.
    canvas.style.width = canvas.style.width || canvas.width + "px";
    canvas.style.height = canvas.style.height || canvas.height + "px";

    // Get size information.
    var scaleFactor = dpi / 96;
    var width = parseFloat(canvas.style.width);
    var height = parseFloat(canvas.style.height);

    // Backup the canvas contents.
    var oldScale = canvas.width / width;
    var backupScale = scaleFactor / oldScale;
    var backup = canvas.cloneNode(false);
    backup.getContext("2d").drawImage(canvas, 0, 0);

    // Resize the canvas.
    var ctx = canvas.getContext("2d");
    canvas.width = Math.ceil(width * scaleFactor);
    canvas.height = Math.ceil(height * scaleFactor);

    // Redraw the canvas image and scale future draws.
    ctx.setTransform(backupScale, 0, 0, backupScale, 0, 0);
    ctx.drawImage(backup, 0, 0);
    ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
}

async function generateInstructions() {
    const instructionsCanvasContainer = document.getElementById("instructions-canvas-container");
    instructionsCanvasContainer.innerHTML = "";
    disableInteraction();
    runStep4(async () => {
        try {
            // Update plate dimensions based on current step selector values
            updatePlateDimensions();
            
            const isHighQuality = document.getElementById("high-quality-instructions-check").checked;
            const step4PixelArray = getPixelArrayFromCanvas(step4Canvas);
            const resultImage = isBleedthroughEnabled()
                ? revertDarkenedImage(
                      step4PixelArray,
                      getDarkenedStudsToStuds(ALL_BRICKLINK_SOLID_COLORS.map((color) => color.hex))
                  )
                : step4PixelArray;

            const titlePageCanvas = document.createElement("canvas");
            instructionsCanvasContainer.appendChild(titlePageCanvas);
            const studMap = getUsedPixelsStudMap(resultImage);
            const filteredAvailableStudHexList = selectedSortedStuds
                .filter((pixelHex) => (studMap[pixelHex] || 0) > 0)
                .filter(function (item, pos, self) {
                    return self.indexOf(item) === pos; // remove duplicates
                });
            generateInstructionTitlePage(
                resultImage,
                targetResolution[0],
                PLATE_WIDTH,
                PLATE_HEIGHT,
                filteredAvailableStudHexList,
                SCALING_FACTOR,
                step4CanvasUpscaled,
                titlePageCanvas,
                selectedPixelPartNumber,
                PIXEL_WIDTH_CM
            );
            setDPI(titlePageCanvas, isHighQuality ? HIGH_DPI : LOW_DPI);

        const imgData = titlePageCanvas.toDataURL("image/png", 1.0);

        let pdf = new jsPDF({
            orientation: titlePageCanvas.width < titlePageCanvas.height ? "p" : "l",
            unit: "mm",
            format: [titlePageCanvas.width, titlePageCanvas.height],
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const totalPlates = resultImage.length / (4 * PLATE_WIDTH * PLATE_WIDTH);

        document.getElementById("pdf-progress-bar").style.width = `${100 / (totalPlates + 1)}%`;

        document.getElementById("pdf-progress-bar").style.width = "0%";
        document.getElementById("pdf-progress-container").hidden = false;
        document.getElementById("download-instructions-button").hidden = true;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, (pdfWidth * titlePageCanvas.height) / titlePageCanvas.width);
        
        // Remove title page canvas from DOM to free memory
        titlePageCanvas.remove();

        let numParts = 1;
        for (var i = 0; i < totalPlates; i++) {
            // Yield to browser to prevent UI freeze and allow garbage collection
            await sleep(10);
            
            if ((i + 1) % (isHighQuality ? 20 : 50) === 0) {
                addWaterMark(pdf, isHighQuality);
                pdf.save(`${t('pdfFilename')}-${t('pdfInstructions')}-${t('pdfPart')}-${numParts}.pdf`);
                numParts++;
                pdf = new jsPDF({
                    orientation: titlePageCanvas.width < titlePageCanvas.height ? "p" : "l",
                    unit: "mm",
                    format: [titlePageCanvas.width, titlePageCanvas.height],
                });
            } else {
                pdf.addPage();
            }

            document.getElementById("pdf-progress-bar").style.width = `${((i + 2) * 100) / (totalPlates + 1)}%`;

            const instructionPageCanvas = document.createElement("canvas");
            // Don't append to DOM - just use it for rendering
            
            const subPixelArray = getSubPixelArray(resultImage, i, targetResolution[0], PLATE_WIDTH);

            const row = Math.floor((i * PLATE_WIDTH) / targetResolution[0]);
            const col = i % (targetResolution[0] / PLATE_WIDTH);

            const variablePixelPieceDimensionsForPage =
                step3VariablePixelPieceDimensions == null
                    ? null
                    : getSubPixelMatrix(
                          step3VariablePixelPieceDimensions,
                          col * PLATE_WIDTH,
                          row * PLATE_WIDTH,
                          PLATE_WIDTH,
                          PLATE_WIDTH
                      );
            generateInstructionPage(
                subPixelArray,
                PLATE_WIDTH,
                filteredAvailableStudHexList,
                SCALING_FACTOR,
                instructionPageCanvas,
                i + 1,
                selectedPixelPartNumber,
                variablePixelPieceDimensionsForPage
            );

            setDPI(instructionPageCanvas, isHighQuality ? HIGH_DPI : LOW_DPI);
            
            // Use correct MIME type for image conversion
            const pageImgData = instructionPageCanvas.toDataURL("image/png", 1.0);

            pdf.addImage(
                pageImgData,
                "PNG",
                0,
                0,
                pdfWidth,
                (pdfWidth * instructionPageCanvas.height) / instructionPageCanvas.width
            );
            
            // Clear canvas to free memory
            instructionPageCanvas.width = 0;
            instructionPageCanvas.height = 0;
        }

        addWaterMark(pdf, isHighQuality);
        pdf.save(numParts > 1 ? `${t('pdfFilename')}-${t('pdfInstructions')}-${t('pdfPart')}-${numParts}.pdf` : `${t('pdfFilename')}-${t('pdfInstructions')}.pdf`);
        document.getElementById("pdf-progress-container").hidden = true;
        document.getElementById("download-instructions-button").hidden = false;
        enableInteraction();

        if (perfLoggingDatabase) {
            perfLoggingDatabase.ref("instructions-generated-count/total").transaction(incrementTransaction);
            const loggingTimestamp = Math.floor((Date.now() - (Date.now() % 8.64e7)) / 1000);
            perfLoggingDatabase.ref("instructions-generated-count/per-day/" + loggingTimestamp).transaction(incrementTransaction);
        }
        } catch (error) {
            console.error("Error generating PDF instructions:", error);
            document.getElementById("pdf-progress-container").hidden = true;
            document.getElementById("download-instructions-button").hidden = false;
            enableInteraction();
            alert("Error generating PDF. For very high resolutions, try disabling 'High Quality' option or using a smaller resolution.");
        }
    });
}

function getUsedPlateMatrices(depthPixelArray) {
    const availableParts = [...document.getElementById("depth-plates-container").children]
        .map((div) => div.children[0])
        .map((label) => label.children[0])
        .filter((input) => input.checked)
        .map((input) => input.name)
        .map((part) => part.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR).map((dimension) => Number(dimension)));
    const flippedParts = [];
    availableParts.forEach((part) => {
        if (part[0] !== part[1]) {
            flippedParts.push([part[1], part[0]]);
        }
    });
    flippedParts.forEach((part) => availableParts.push(part));
    const usedPlatesMatrices = [];
    for (
        let row = 0; // for each row of plates
        row < Math.ceil(targetResolution[1] / PLATE_WIDTH); // round up
        row++
    ) {
        for (
            let col = 0; // for each column of plates
            col < Math.ceil(targetResolution[0] / PLATE_WIDTH); // round up
            col++
        ) {
            const horizontalOffset = col * PLATE_WIDTH;
            const verticalOffset = row * PLATE_WIDTH;
            const depthSubPixelMatrix = getDepthSubPixelMatrix(
                depthPixelArray,
                targetResolution[0],
                horizontalOffset,
                verticalOffset,
                Math.min(PLATE_WIDTH, targetResolution[0] - horizontalOffset),
                Math.min(PLATE_WIDTH, targetResolution[1] - verticalOffset)
            );
            const perDepthLevelMatrices = [];
            for (
                let depthLevel = 0; // for each depth level
                depthLevel < Number(document.getElementById("num-depth-levels-slider").value) - 1;
                depthLevel++
            ) {
                const setPixelMatrix = getSetPixelMatrixFromInputMatrix(
                    depthSubPixelMatrix,
                    (depthPixel, _i, _j) => depthPixel <= depthLevel
                );
                perDepthLevelMatrices.push(getRequiredPartMatrixFromSetPixelMatrix(setPixelMatrix, availableParts));
            }
            usedPlatesMatrices.push(perDepthLevelMatrices);
        }
    }
    return usedPlatesMatrices;
}

async function generateDepthInstructions() {
    const instructionsCanvasContainer = document.getElementById("depth-instructions-canvas-container");
    instructionsCanvasContainer.innerHTML = "";
    disableInteraction();

    runStep4(async () => {
        try {
            // Update plate dimensions based on current step selector values
            updatePlateDimensions();
        
        const isHighQuality = document.getElementById("high-quality-depth-instructions-check").checked;
        const depthPixelArray = getPixelArrayFromCanvas(step3DepthCanvas);

        const usedPlatesMatrices = getUsedPlateMatrices(depthPixelArray);

        document.getElementById("depth-pdf-progress-bar").style.width = `${0}%`;

        document.getElementById("depth-pdf-progress-bar").style.width = "0%";
        document.getElementById("depth-pdf-progress-container").hidden = false;
        document.getElementById("download-depth-instructions-button").hidden = true;

        const titlePageCanvas = document.createElement("canvas");
        instructionsCanvasContainer.innerHTML = "";
        instructionsCanvasContainer.appendChild(titlePageCanvas);
        generateDepthInstructionTitlePage(
            usedPlatesMatrices,
            targetResolution,
            SCALING_FACTOR,
            titlePageCanvas,
            step3DepthCanvasUpscaled,
            PLATE_WIDTH
        );
        setDPI(titlePageCanvas, isHighQuality ? HIGH_DPI : LOW_DPI);

        const imgData = titlePageCanvas.toDataURL("image/png", 1.0);

        let pdf = new jsPDF({
            orientation: titlePageCanvas.width < titlePageCanvas.height ? "p" : "l",
            unit: "mm",
            format: [titlePageCanvas.width, titlePageCanvas.height],
        });

        pdf.addImage(imgData, "PNG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        
        // Remove title page canvas from DOM to free memory
        titlePageCanvas.remove();

        let numParts = 1;
        for (let i = 0; i < usedPlatesMatrices.length; i++) {
            // Yield to browser to prevent UI freeze and allow garbage collection
            await sleep(10);

            if ((i + 1) % (isHighQuality ? 20 : 50) === 0) {
                if (pdf != null) {
                    addWaterMark(pdf, isHighQuality);
                    pdf.save(`${t('pdfFilename')}-${t('pdfInstructions')}-${t('pdfPart')}-${numParts}.pdf`);

                    numParts++;
                }
                pdf = new jsPDF({
                    orientation: titlePageCanvas.width < titlePageCanvas.height ? "p" : "l",
                    unit: "mm",
                    format: [titlePageCanvas.width, titlePageCanvas.height],
                });
            } else {
                pdf.addPage();
            }

            const instructionPageCanvas = document.createElement("canvas");
            // Don't append to DOM - just use it for rendering

            perDepthLevelMatrices = usedPlatesMatrices[i];
            generateDepthInstructionPage(perDepthLevelMatrices, SCALING_FACTOR, instructionPageCanvas, i + 1);
            setDPI(instructionPageCanvas, isHighQuality ? HIGH_DPI : LOW_DPI);

            // Use correct MIME type for image conversion
            const pageImgData = instructionPageCanvas.toDataURL("image/png", 1.0);

            pdf.addImage(pageImgData, "PNG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());

            // Clear canvas to free memory
            instructionPageCanvas.width = 0;
            instructionPageCanvas.height = 0;

            document.getElementById("depth-pdf-progress-bar").style.width = `${
                ((i + 1) * 100) / (usedPlatesMatrices.length + 1)
            }%`;
        }

        addWaterMark(pdf, isHighQuality);
        pdf.save(numParts > 1 ? `${t('pdfFilename')}-${t('pdfInstructions')}-${t('pdfPart')}-${numParts}.pdf` : `${t('pdfFilename')}-${t('pdfInstructions')}.pdf`);
        document.getElementById("depth-pdf-progress-container").hidden = true;
        document.getElementById("download-depth-instructions-button").hidden = false;
        enableInteraction();

        if (perfLoggingDatabase) {
            perfLoggingDatabase.ref("depth-instructions-generated-count/total").transaction(incrementTransaction);
            const loggingTimestamp = Math.floor((Date.now() - (Date.now() % 8.64e7)) / 1000);
            perfLoggingDatabase.ref("depth-instructions-generated-count/per-day/" + loggingTimestamp).transaction(incrementTransaction);
        }
        } catch (error) {
            console.error("Error generating depth PDF instructions:", error);
            document.getElementById("depth-pdf-progress-container").hidden = true;
            document.getElementById("download-depth-instructions-button").hidden = false;
            enableInteraction();
            alert("Error generating PDF. For very high resolutions, try disabling 'High Quality' option or using a smaller resolution.");
        }
    });
}


document.getElementById("download-instructions-button").addEventListener("click", async () => {
    await generateInstructions();
});

document.getElementById("download-depth-instructions-button").addEventListener("click", async () => {
    await generateDepthInstructions();
});

document.getElementById("export-depth-to-bricklink-button").addEventListener("click", () => {
    disableInteraction();
    const depthPixelArray = getPixelArrayFromCanvas(step3DepthCanvas);
    const usedPlatesMatrices = getUsedPlateMatrices(depthPixelArray);
    const depthPartsMap = getUsedDepthPartsMap(usedPlatesMatrices.flat());

    navigator.clipboard.writeText(getDepthWantedListXML(depthPartsMap)).then(
        function () {
            enableInteraction();
        },
        function (err) {
            console.error("Async: Could not copy text: ", err);
        }
    );
});

function triggerDepthMapGeneration() {
    alert("Depth map auto-generation is not available. Please upload your own depth map image.");
    return;
    disableInteraction();
    const worker = new Worker("js/depth-map-web-worker.js");

    const loadingMessageComponent = document.getElementById("web-worker-loading-message");
    loadingMessageComponent.hidden = false;

    webWorkerInputCanvas.width = CNN_INPUT_IMAGE_WIDTH;
    webWorkerInputCanvas.height = CNN_INPUT_IMAGE_HEIGHT;
    webWorkerInputCanvasContext.drawImage(
        inputImage,
        0,
        0,
        inputImage.width,
        inputImage.height,
        0,
        0,
        CNN_INPUT_IMAGE_WIDTH,
        CNN_INPUT_IMAGE_HEIGHT
    );
    setTimeout(() => {
        const inputPixelArray = getPixelArrayFromCanvas(webWorkerInputCanvas);
        worker.postMessage({
            inputPixelArray,
        });

        worker.addEventListener("message", (e) => {
            const { result, loadingMessage } = e.data;
            if (result != null) {
                webWorkerOutputCanvas.width = CNN_INPUT_IMAGE_WIDTH;
                webWorkerOutputCanvas.height = CNN_INPUT_IMAGE_HEIGHT;
                drawPixelsOnCanvas(result, webWorkerOutputCanvas);
                setTimeout(() => {
                    inputDepthCanvas.width = SERIALIZE_EDGE_LENGTH;
                    inputDepthCanvas.height = SERIALIZE_EDGE_LENGTH;
                    inputDepthCanvasContext.drawImage(
                        webWorkerOutputCanvas,
                        0,
                        0,
                        CNN_INPUT_IMAGE_WIDTH,
                        CNN_INPUT_IMAGE_HEIGHT,
                        0,
                        0,
                        SERIALIZE_EDGE_LENGTH,
                        SERIALIZE_EDGE_LENGTH
                    );
                    setTimeout(() => {
                        loadingMessageComponent.hidden = true;
                        enableInteraction();
                        overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
                        runStep1();
                    }, 50); // TODO: find better way to check that input is finished
                }, 50); // TODO: find better way to check that input is finished
            } else if (loadingMessage != null) {
                loadingMessageComponent.innerHTML = loadingMessage;
            } else {
                console.log("Message from web worker: ", e.data);
            }
        });
    }, 50); // TODO: find better way to check that input is finished
}

var generateDepthBtn = document.getElementById("generate-depth-image");
if (generateDepthBtn) generateDepthBtn.addEventListener("click", triggerDepthMapGeneration);

const SERIALIZE_EDGE_LENGTH = 512;

function handleInputImage(e, dontClearDepth, dontLog) {
    const reader = new FileReader();
    reader.onload = function (event) {
        inputImage = new Image();
        inputImage.onload = function () {
            inputCanvas.width = SERIALIZE_EDGE_LENGTH;
            inputCanvas.height = SERIALIZE_EDGE_LENGTH;
            inputCanvasContext.drawImage(
                inputImage,
                0,
                0,
                inputImage.width,
                inputImage.height,
                0,
                0,
                SERIALIZE_EDGE_LENGTH,
                SERIALIZE_EDGE_LENGTH
            );

            // remove transparency
            const inputImagePixels = getPixelArrayFromCanvas(inputCanvas);
            for (var i = 3; i < inputImagePixels.length; i += 4) {
                inputImagePixels[i] = 255;
            }
            drawPixelsOnCanvas(inputImagePixels, inputCanvas);

            if (!dontClearDepth) {
                inputDepthCanvas.width = SERIALIZE_EDGE_LENGTH;
                inputDepthCanvas.height = SERIALIZE_EDGE_LENGTH;
                inputDepthCanvasContext.fillStyle = "black";
                inputDepthCanvasContext.fillRect(0, 0, inputDepthCanvas.width, inputDepthCanvas.height);
            }
        };
        inputImage.src = event.target.result;
        // Show visual step 1 and stepper
        document.getElementById("visual-step-1").hidden = false;
        document.getElementById("visual-step-1").classList.add("active");
        document.getElementById("step-navigation").hidden = false;
        document.getElementById("input-image-selector").innerHTML = t('reselectInputImage');
        document.getElementById("image-input-new").appendChild(document.getElementById("image-input"));
        document.getElementById("image-input-card").hidden = true;
        // Also set old steps-row for backward compat
        var stepsRow = document.getElementById("steps-row");
        if (stepsRow) stepsRow.hidden = false;
        var exContainer = document.getElementById("run-example-input-container");
        if (exContainer) exContainer.hidden = true;
        setTimeout(() => {
            step1CanvasUpscaled.width = SERIALIZE_EDGE_LENGTH;
            step1CanvasUpscaled.height = Math.floor((SERIALIZE_EDGE_LENGTH * inputImage.height) / inputImage.width);
            step1CanvasUpscaledContext.drawImage(
                inputCanvas,
                0,
                0,
                SERIALIZE_EDGE_LENGTH,
                SERIALIZE_EDGE_LENGTH,
                0,
                0,
                step1CanvasUpscaled.width,
                step1CanvasUpscaled.height
            );

            overridePixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
            overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
            initializeCropper();
            runStep1();
        }, 50); // TODO: find better way to check that input is finished

        if (!dontLog) {
            perfLoggingDatabase && perfLoggingDatabase.ref("input-image-count/total").transaction(incrementTransaction);
            const loggingTimestamp = Math.floor((Date.now() - (Date.now() % 8.64e7)) / 1000); // 8.64e+7 = ms in day
            perfLoggingDatabase && perfLoggingDatabase.ref("input-image-count/per-day/" + loggingTimestamp).transaction(incrementTransaction);
        }
    };
    reader.readAsDataURL(e.target.files[0]);
}

function handleInputDepthMapImage(e) {
    const reader = new FileReader();
    overrideDepthPixelArray = new Array(targetResolution[0] * targetResolution[1] * 4).fill(null);
    reader.onload = function (event) {
        inputImage = new Image();
        inputImage.onload = function () {
            inputDepthCanvas.width = SERIALIZE_EDGE_LENGTH;
            inputDepthCanvas.height = SERIALIZE_EDGE_LENGTH;
            inputDepthCanvasContext.drawImage(
                inputImage,
                0,
                0,
                inputImage.width,
                inputImage.height,
                0,
                0,
                SERIALIZE_EDGE_LENGTH,
                SERIALIZE_EDGE_LENGTH
            );
        };
        inputImage.src = event.target.result;
        setTimeout(() => {
            runStep1();
        }, 50); // TODO: find better way to check that input is finished

        // TODO: log for perf estimation?
    };
    reader.readAsDataURL(e.target.files[0]);
}


const imageURLMatch =
    window.location.href.match(
        /image=(https?((:\/\/)|(%3A%2F%2F)))?([-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?)/gi
    ) ?? [];
const imageURL =
    imageURLMatch.length > 0 ? imageURLMatch[0].replace(/image=(https?((:\/\/)|(%3A%2F%2F)))?/gi, "") : null;

if (imageURL != null) {
    setTimeout(() => {
        fetch("https://" + decodeURIComponent(imageURL))
            .then((response) => response.blob())
            .then((colorImage) => {
                try {
                    // use an object url to get around possible bad browser caching race conditions
                    const colorImageURL = URL.createObjectURL(colorImage);
                    const e = {
                        target: {
                            files: [colorImage],
                        },
                    };
                    handleInputImage(e, true, true);
                } catch (e) {
                    enableInteraction();
                }
            })
            .catch((err) => {
                enableInteraction();
            });
    }, 50); // TODO: find better way to check that input is finished
}

const imageSelectorHidden = document.getElementById("input-image-selector-hidden");
imageSelectorHidden.addEventListener("change", (e) => handleInputImage(e), false);
document.getElementById("input-image-selector").addEventListener("click", () => {
    imageSelectorHidden.click();
});

const depthImageSelectorHidden = document.getElementById("input-depth-image-selector-hidden");
depthImageSelectorHidden.addEventListener("change", handleInputDepthMapImage, false);
document.getElementById("input-depth-image-selector").addEventListener("click", () => {
    depthImageSelectorHidden.click();
});

window.addEventListener("appinstalled", () => {
    perfLoggingDatabase && perfLoggingDatabase.ref("pwa-install-count/total").transaction(incrementTransaction);
    const loggingTimestamp = Math.floor((Date.now() - (Date.now() % 8.64e7)) / 1000); // 8.64e+7 = ms in day
    perfLoggingDatabase && perfLoggingDatabase.ref("pwa-install-count/per-day/" + loggingTimestamp).transaction(incrementTransaction);
});

// Step Navigation System — 2-step visual flow, 4-step internal pipeline
// Visual Step 1 = Configure (internal step 1)
// Visual Step 2 = Farben verfeinern (HIDDEN — internal steps 2+3 still run)
// Visual Step 3 = Result (internal step 4)
let currentVisualStep = 1;
const stepProcessed = { 1: false, 2: false, 3: false, 4: false };

function showVisualStep(vstep) {
    // Hide all visual steps
    document.querySelectorAll('.visual-step').forEach(el => {
        el.classList.remove('active');
        el.hidden = true;
    });

    // Show target
    const target = document.getElementById('visual-step-' + vstep);
    if (target) {
        target.hidden = false;
        target.classList.add('active');
    }

    // Update stepper circles
    document.querySelectorAll('.mosaic-stepper-step').forEach(btn => {
        btn.classList.remove('active', 'completed');
    });
    var btn1 = document.getElementById('vstep-btn-1');
    var btn2 = document.getElementById('vstep-btn-2');
    var btn3 = document.getElementById('vstep-btn-3');

    if (vstep === 1) {
        if (btn1) btn1.classList.add('active');
    } else if (vstep === 2) {
        if (btn1) btn1.classList.add('completed');
        if (btn2) btn2.classList.add('active');
    } else if (vstep === 3) {
        if (btn1) btn1.classList.add('completed');
        if (btn2) btn2.classList.add('completed');
        if (btn3) btn3.classList.add('active');
    }

    currentVisualStep = vstep;

    // Scroll to top
    window.scrollTo(0, 0);
    // Tell parent iframe about height change
    window.parent.postMessage({ type: 'mosaic-resize', height: document.body.scrollHeight }, '*');
}

function runStepProcessing(targetStep, callback) {
    function runStepsSequentially(stepsToRun, index) {
        if (index >= stepsToRun.length) {
            if (callback) callback();
            return;
        }

        var step = stepsToRun[index];
        if (!stepProcessed[step]) {
            var stepFunctions = {
                1: runStep1Only,
                2: runStep2Only,
                3: runStep3Only,
                4: runStep4Only
            };
            stepFunctions[step]();
            var checkComplete = setInterval(function() {
                if (stepProcessed[step]) {
                    clearInterval(checkComplete);
                    runStepsSequentially(stepsToRun, index + 1);
                }
            }, 50);
        } else {
            runStepsSequentially(stepsToRun, index + 1);
        }
    }

    var stepsToRun = [];
    for (var i = 1; i <= targetStep; i++) {
        if (!stepProcessed[i]) {
            stepsToRun.push(i);
        }
    }

    if (stepsToRun.length > 0) {
        runStepsSequentially(stepsToRun, 0);
    } else {
        if (callback) callback();
    }
}

function invalidateStepsFrom(stepNumber) {
    for (var i = stepNumber; i <= 4; i++) {
        stepProcessed[i] = false;
    }
}

// Step 1 → Step 2: "Weiter: Farben" — runs internal steps 1-3, shows color editing
var createMosaicBtn = document.getElementById('create-mosaic-btn');
if (createMosaicBtn) {
    createMosaicBtn.addEventListener('click', function() {
        invalidateStepsFrom(1);
        runStepProcessing(3, function() {
            showVisualStep(2);
        });
    });
}

// Step 2 → Result: "Weiter: Ergebnis" — runs internal step 4, shows result
var goToResultBtn = document.getElementById('go-to-result-btn');
if (goToResultBtn) {
    goToResultBtn.addEventListener('click', function() {
        runStepProcessing(4, function() {
            showVisualStep(3);
        });
    });
}

// Step 2 → Step 1: "Zurück: Anpassen"
var backToStep1Btn = document.getElementById('back-to-step1-btn');
if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', function() {
        showVisualStep(1);
    });
}

// Result → Step 2: "Zurück: Farben"
var backToRefineBtn = document.getElementById('back-to-refine-btn');
if (backToRefineBtn) {
    backToRefineBtn.addEventListener('click', function() {
        showVisualStep(2);
    });
}

// Order mosaic button — adds WooCommerce product to cart
var orderMosaicBtn = document.getElementById('order-mosaic-button');
var MOSAIC_WC_PRODUCT_ID = 582;
if (orderMosaicBtn) {
    orderMosaicBtn.addEventListener('click', function() {
        // Navigate parent to WooCommerce add-to-cart URL
        try {
            window.parent.location.href = '/warenkorb/?add-to-cart=' + MOSAIC_WC_PRODUCT_ID;
        } catch(e) {
            window.open('https://brickonas.info/warenkorb/?add-to-cart=' + MOSAIC_WC_PRODUCT_ID, '_blank');
        }
    });
}

// Update product card meta when resolution changes
function updateMosaicProductMeta() {
    var sizeEl = document.getElementById('mosaic-product-size');
    var piecesEl = document.getElementById('mosaic-product-pieces');
    if (sizeEl) {
        sizeEl.innerHTML = targetResolution[0] + ' &times; ' + targetResolution[1] + ' Noppen';
    }
    if (piecesEl) {
        var total = targetResolution[0] * targetResolution[1];
        piecesEl.innerHTML = total.toLocaleString('de-DE') + ' Teile';
    }
}

// Stepper circle click handlers
document.querySelectorAll('.mosaic-stepper-step').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var vstep = parseInt(this.dataset.vstep);
        if (vstep === 1) {
            showVisualStep(1);
        } else if (vstep === 2 && stepProcessed[3]) {
            showVisualStep(2);
        } else if (vstep === 3 && stepProcessed[4]) {
            showVisualStep(3);
        }
    });
});

// Legacy goToStep for backward compat (internal code may call it)
function goToStep(stepNumber) {
    if (stepNumber <= 1) {
        showVisualStep(1);
    } else if (stepNumber <= 3) {
        showVisualStep(2);
    } else {
        showVisualStep(3);
    }
}

enableInteraction(); // enable interaction once everything has loaded in
