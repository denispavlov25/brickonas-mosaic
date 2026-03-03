/**
 * Canvas rendering functions (main thread only - needs DOM).
 * Extracted from algo.js.
 */

var MAX_CANVAS_DIMENSION = 2048;
var BASE_SCALING_FACTOR = 40;

function getScalingFactor(width, height) {
    return Math.max(1, Math.min(BASE_SCALING_FACTOR, Math.floor(MAX_CANVAS_DIMENSION / Math.max(width, height))));
}

function getPixelArrayFromCanvas(canvas) {
    var context = canvas.getContext("2d");
    var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels;
}

function drawPixelsOnCanvas(pixels, canvas) {
    var context = canvas.getContext("2d");
    var imageData = context.createImageData(canvas.width, canvas.height);
    var data = imageData.data;
    for (var i = 0; i < pixels.length && i < data.length; i++) {
        data[i] = pixels[i];
    }
    context.putImageData(imageData, 0, 0);
}

function drawPixel(ctx, x, y, radius, pixelHex, strokeHex, pixelType) {
    ctx.beginPath();
    if ([PIXEL_TYPE_OPTIONS[0].number, PIXEL_TYPE_OPTIONS[1].number].includes(pixelType)) {
        ctx.arc(x + radius, y + radius, radius, 0, 2 * Math.PI);
    } else {
        ctx.rect(x, y, 2 * radius, 2 * radius);
    }
    ctx.fillStyle = pixelHex;
    ctx.fill();
    ctx.strokeStyle = strokeHex;
    if (!("" + pixelType).match("^variable.*$")) {
        ctx.stroke();
    }
    if ([
        PIXEL_TYPE_OPTIONS[1].number,
        PIXEL_TYPE_OPTIONS[3].number,
        PIXEL_TYPE_OPTIONS[4].number,
        PIXEL_TYPE_OPTIONS[6].number,
        PIXEL_TYPE_OPTIONS[7].number
    ].includes(pixelType)) {
        ctx.beginPath();
        ctx.arc(x + radius, y + radius, radius * 0.6, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

function drawStudImageOnCanvas(pixels, width, scalingFactor, canvas, pixelType, plateDimensionsOverlay) {
    var ctx = canvas.getContext("2d");
    canvas.width = width * scalingFactor;
    canvas.height = ((pixels.length / 4) * scalingFactor) / width;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var radius = scalingFactor / 2;
    var totalPixels = pixels.length / 4;
    var isCircle = [PIXEL_TYPE_OPTIONS[0].number, PIXEL_TYPE_OPTIONS[1].number].includes(pixelType);
    var isVariable = ("" + pixelType).match("^variable.*$");
    var needsStroke = !isVariable;
    var needsStudCircle = [
        PIXEL_TYPE_OPTIONS[1].number,
        PIXEL_TYPE_OPTIONS[3].number,
        PIXEL_TYPE_OPTIONS[4].number,
        PIXEL_TYPE_OPTIONS[6].number,
        PIXEL_TYPE_OPTIONS[7].number
    ].includes(pixelType);

    // Group pixels by color for batch rendering (Path2D batching)
    var pixelsByColor = new Map();
    for (var i = 0; i < totalPixels; i++) {
        var pixelHex = rgbToHex(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
        if (!pixelsByColor.has(pixelHex)) {
            pixelsByColor.set(pixelHex, []);
        }
        pixelsByColor.get(pixelHex).push(i);
    }

    pixelsByColor.forEach(function(indices, pixelHex) {
        var fillPath = new Path2D();
        var studPath = needsStudCircle ? new Path2D() : null;

        for (var j = 0; j < indices.length; j++) {
            var idx = indices[j];
            var x = (idx % width) * 2 * radius;
            var y = Math.floor(idx / width) * 2 * radius;

            if (isCircle) {
                fillPath.arc(x + radius, y + radius, radius, 0, 2 * Math.PI);
                fillPath.closePath();
            } else {
                fillPath.rect(x, y, 2 * radius, 2 * radius);
            }

            if (studPath) {
                studPath.arc(x + radius, y + radius, radius * 0.6, 0, 2 * Math.PI);
                studPath.closePath();
            }
        }

        ctx.fillStyle = pixelHex;
        ctx.fill(fillPath);

        if (needsStroke) {
            ctx.strokeStyle = "#111111";
            ctx.stroke(fillPath);
        }

        if (studPath) {
            ctx.strokeStyle = "#111111";
            ctx.stroke(studPath);
        }
    });

    if (isVariable && plateDimensionsOverlay) {
        ctx.strokeStyle = "#888888";
        ctx.lineWidth = 5;
        for (var row = 0; row < plateDimensionsOverlay.length; row++) {
            for (var col = 0; col < plateDimensionsOverlay[0].length; col++) {
                var part = plateDimensionsOverlay[row][col];
                if (part != null) {
                    ctx.beginPath();
                    ctx.rect(col * 2 * radius, row * 2 * radius, 2 * radius * part[1], 2 * radius * part[0]);
                    ctx.stroke();
                }
            }
        }
    }
}

/**
 * Release canvas memory by zeroing dimensions
 */
function releaseCanvas(canvas) {
    canvas.width = 0;
    canvas.height = 0;
}
