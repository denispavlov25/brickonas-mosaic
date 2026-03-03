/**
 * PDF instruction generation.
 * Extracted from algo.js + index.js, parameterized to avoid DOM reads.
 * Requires: jsPDF, canvas-renderer.js, worker-algo.js (for getSubPixelArray, etc.), i18n.js
 */

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function setDPI(canvas, dpi) {
    var scaleFactor = dpi / 96;
    var w = canvas.width;
    var h = canvas.height;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * scaleFactor;
    canvas.height = h * scaleFactor;
    var ctx = canvas.getContext('2d');
    ctx.scale(scaleFactor, scaleFactor);
}

/**
 * Generate mosaic assembly instructions as PDF(s).
 *
 * @param {Object} config
 * @param {Uint8ClampedArray} config.pixelArray - Final result pixel array (RGBA)
 * @param {number[]} config.targetResolution - [width, height] in studs
 * @param {number} config.plateWidth - Plate size in studs (e.g. 16)
 * @param {number} config.plateHeight - Plate height in studs
 * @param {string[]} config.selectedSortedStuds - Hex codes of available colors
 * @param {number|string} config.pixelType - Pixel part type number
 * @param {Array|null} config.variablePixelPieceDimensions - Variable piece dims or null
 * @param {HTMLCanvasElement} config.previewCanvas - Upscaled preview canvas for title page
 * @param {boolean} config.isHighQuality - HQ (96 DPI) vs LQ (48 DPI)
 * @param {number} config.baseScalingFactor - Rendering scale (default 40)
 * @param {number} config.pixelWidthCm - Physical stud size in cm (0.8)
 * @param {function} config.onProgress - Progress callback(fraction 0-1)
 */
async function generateInstructions(config) {
    var pixelArray = config.pixelArray;
    var targetResolution = config.targetResolution;
    var plateWidth = config.plateWidth;
    var plateHeight = config.plateHeight;
    var selectedSortedStuds = config.selectedSortedStuds;
    var pixelType = config.pixelType;
    var variablePixelPieceDimensions = config.variablePixelPieceDimensions;
    var previewCanvas = config.previewCanvas;
    var isHighQuality = config.isHighQuality;
    var baseScalingFactor = config.baseScalingFactor || 40;
    var pixelWidthCm = config.pixelWidthCm || 0.8;
    var onProgress = config.onProgress || function() {};

    var dpi = isHighQuality ? 96 : 48;
    var maxPagesPerPart = isHighQuality ? 20 : 50;

    var width = targetResolution[0];
    var totalPlates = pixelArray.length / (4 * plateWidth * plateWidth);

    // Get used studs for this result
    var usedStudMap = getUsedPixelsStudMap(pixelArray);
    var usedStudHexList = selectedSortedStuds.filter(function(hex) {
        return (usedStudMap[hex] || 0) > 0;
    });

    // Create title page
    var titleCanvas = document.createElement('canvas');
    generateInstructionTitlePage(
        pixelArray, width, plateWidth, plateHeight, usedStudHexList,
        baseScalingFactor, previewCanvas, titleCanvas, pixelType, pixelWidthCm
    );
    setDPI(titleCanvas, dpi);

    var titleImgData = titleCanvas.toDataURL('image/png');

    // Initialize first PDF
    var pdf = new jsPDF({
        orientation: titleCanvas.width < titleCanvas.height ? 'p' : 'l',
        unit: 'mm',
        format: [titleCanvas.width, titleCanvas.height]
    });

    var pdfWidth = pdf.internal.pageSize.getWidth();
    pdf.addImage(titleImgData, 'PNG', 0, 0, pdfWidth, (pdfWidth * titleCanvas.height) / titleCanvas.width);

    // Release title canvas memory
    titleCanvas.width = 0;
    titleCanvas.height = 0;

    onProgress(1 / (totalPlates + 1));

    var numParts = 1;
    var filename = t('pdfFilename') + ' - ' + t('pdfInstructions') + ' (' + width + 'x' + (pixelArray.length / (4 * width)) + ')';

    for (var i = 0; i < totalPlates; i++) {
        var platePixels = getSubPixelArray(pixelArray, i, width, plateWidth);
        var plateCanvas = document.createElement('canvas');

        var variablePixelDims = null;
        if (variablePixelPieceDimensions) {
            var horizontalOffset = (i * plateWidth) % width;
            var verticalOffset = plateWidth * Math.floor((i * plateWidth) / width);
            variablePixelDims = getSubPixelMatrix(
                variablePixelPieceDimensions, horizontalOffset, verticalOffset, plateWidth, plateWidth
            );
        }

        generateInstructionPage(
            platePixels, plateWidth, usedStudHexList, baseScalingFactor,
            plateCanvas, i + 1, pixelType, variablePixelDims
        );
        setDPI(plateCanvas, dpi);

        var plateImgData = plateCanvas.toDataURL('image/png');

        // Split PDF every N pages
        if ((i + 1) % maxPagesPerPart === 0) {
            pdf.addPage();
            pdf.addImage(plateImgData, 'PNG', 0, 0, pdfWidth, (pdfWidth * plateCanvas.height) / plateCanvas.width);
            pdf.save(filename + '-' + t('pdfPart') + '-' + numParts + '.pdf');
            numParts++;
            // Start new PDF
            pdf = new jsPDF({
                orientation: plateCanvas.width < plateCanvas.height ? 'p' : 'l',
                unit: 'mm',
                format: [plateCanvas.width, plateCanvas.height]
            });
            pdfWidth = pdf.internal.pageSize.getWidth();
        } else {
            pdf.addPage();
            pdf.addImage(plateImgData, 'PNG', 0, 0, pdfWidth, (pdfWidth * plateCanvas.height) / plateCanvas.width);
        }

        // Release plate canvas memory
        plateCanvas.width = 0;
        plateCanvas.height = 0;

        onProgress((i + 2) / (totalPlates + 1));

        // Yield to browser for GC and UI repaint
        await sleep(10);
    }

    // Save final (or only) part
    if (numParts === 1) {
        pdf.save(filename + '.pdf');
    } else {
        pdf.save(filename + '-' + t('pdfPart') + '-' + numParts + '.pdf');
    }
}

/**
 * Generate depth instructions as PDF(s).
 *
 * @param {Object} config
 * @param {Array} config.usedPlateMatrices - Per-plate array of per-depth-level part matrices
 * @param {number[]} config.targetResolution - [width, height]
 * @param {number} config.plateWidth - Plate size
 * @param {HTMLCanvasElement} config.depthPreviewCanvas - Depth preview canvas for title page
 * @param {boolean} config.isHighQuality
 * @param {number} config.baseScalingFactor
 * @param {function} config.onProgress
 */
async function generateDepthInstructions(config) {
    var usedPlateMatrices = config.usedPlateMatrices;
    var targetResolution = config.targetResolution;
    var plateWidth = config.plateWidth;
    var depthPreviewCanvas = config.depthPreviewCanvas;
    var isHighQuality = config.isHighQuality;
    var baseScalingFactor = config.baseScalingFactor || 40;
    var onProgress = config.onProgress || function() {};

    var dpi = isHighQuality ? 96 : 48;
    var maxPagesPerPart = isHighQuality ? 20 : 50;
    var totalPlates = usedPlateMatrices.length;

    // Create title page
    var titleCanvas = document.createElement('canvas');
    generateDepthInstructionTitlePage(
        usedPlateMatrices, targetResolution, baseScalingFactor, titleCanvas, depthPreviewCanvas, plateWidth
    );
    setDPI(titleCanvas, dpi);

    var titleImgData = titleCanvas.toDataURL('image/png');

    var pdf = new jsPDF({
        orientation: titleCanvas.width < titleCanvas.height ? 'p' : 'l',
        unit: 'mm',
        format: [titleCanvas.width, titleCanvas.height]
    });

    var pdfWidth = pdf.internal.pageSize.getWidth();
    pdf.addImage(titleImgData, 'PNG', 0, 0, pdfWidth, (pdfWidth * titleCanvas.height) / titleCanvas.width);
    titleCanvas.width = 0;
    titleCanvas.height = 0;

    onProgress(1 / (totalPlates + 1));

    var numParts = 1;
    var filename = t('pdfFilename') + ' - ' + t('pdfDepthInstructions') + ' (' + targetResolution[0] + 'x' + targetResolution[1] + ')';

    for (var i = 0; i < totalPlates; i++) {
        var plateCanvas = document.createElement('canvas');
        generateDepthInstructionPage(usedPlateMatrices[i], baseScalingFactor, plateCanvas, i + 1);
        setDPI(plateCanvas, dpi);

        var plateImgData = plateCanvas.toDataURL('image/png');

        if ((i + 1) % maxPagesPerPart === 0) {
            pdf.addPage();
            pdf.addImage(plateImgData, 'PNG', 0, 0, pdfWidth, (pdfWidth * plateCanvas.height) / plateCanvas.width);
            pdf.save(filename + '-' + t('pdfPart') + '-' + numParts + '.pdf');
            numParts++;
            pdf = new jsPDF({
                orientation: plateCanvas.width < plateCanvas.height ? 'p' : 'l',
                unit: 'mm',
                format: [plateCanvas.width, plateCanvas.height]
            });
            pdfWidth = pdf.internal.pageSize.getWidth();
        } else {
            pdf.addPage();
            pdf.addImage(plateImgData, 'PNG', 0, 0, pdfWidth, (pdfWidth * plateCanvas.height) / plateCanvas.width);
        }

        plateCanvas.width = 0;
        plateCanvas.height = 0;

        onProgress((i + 2) / (totalPlates + 1));
        await sleep(10);
    }

    if (numParts === 1) {
        pdf.save(filename + '.pdf');
    } else {
        pdf.save(filename + '-' + t('pdfPart') + '-' + numParts + '.pdf');
    }
}

// ============================================
// Functions from algo.js needed for PDF rendering (DOM-dependent)
// ============================================

function drawStudCountForContext(studMap, availableStudHexList, scalingFactor, ctx, horizontalOffset, verticalOffset, pixelType) {
    var radius = scalingFactor / 2;
    ctx.font = (scalingFactor / 2) + 'px Arial';
    availableStudHexList.forEach(function(pixelHex, i) {
        var number = i + 1;
        ctx.beginPath();
        var x = horizontalOffset;
        var y = verticalOffset + radius * 2.5 * number;
        drawPixel(ctx, x - radius, y - radius, radius, pixelHex, inverseHex(pixelHex), PIXEL_TYPE_TO_FLATTENED[pixelType]);
        ctx.fillStyle = inverseHex(pixelHex);
        ctx.fillText(number, x - (scalingFactor * (1 + Math.floor(number / 2) / 6)) / 8, y + scalingFactor / 8);
        ctx.fillStyle = "#000000";
        if (!("" + pixelType).match("^variable.*$")) {
            ctx.fillText('X ' + (studMap[pixelHex] || 0), x + radius * 1.5, y);
        }
        ctx.font = (scalingFactor / 2.5) + 'px Arial';
        ctx.fillText(translateColor(HEX_TO_COLOR_NAME[pixelHex]) || pixelHex, x + radius * 1.5, y + scalingFactor / 2.5);
        ctx.font = (scalingFactor / 2) + 'px Arial';
    });

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.rect(horizontalOffset - radius * 2, verticalOffset + radius * 0.75, radius * 11, radius * 2.5 * (availableStudHexList.length + 0.5));
    ctx.stroke();
}

function generateInstructionTitlePage(pixelArray, width, plateWidth, plateHeight, availableStudHexList, scalingFactor, finalImageCanvas, canvas, pixelType, pixelWidthCm) {
    var ctx = canvas.getContext("2d");
    var pictureWidth = plateWidth * scalingFactor;
    var pictureHeight = plateWidth * scalingFactor;
    var radius = scalingFactor / 2;
    var studMap = getUsedPixelsStudMap(pixelArray);
    var numPlates = pixelArray.length / (4 * plateWidth * plateWidth);
    var platesPerRow = width / plateWidth;
    var platesPerCol = numPlates / platesPerRow;

    var legendSquareSide = scalingFactor;
    var legendGridWidth = legendSquareSide * platesPerRow;
    var legendGridHeight = legendSquareSide * platesPerCol;
    var titleAreaHeight = pictureHeight * 0.45;
    var previewImageHeight = legendGridHeight;
    var gapBetween = scalingFactor;
    var totalContentHeight = titleAreaHeight + legendGridHeight + gapBetween + previewImageHeight + scalingFactor;

    canvas.height = Math.max(pictureHeight * 1.5, pictureHeight * 0.4 + availableStudHexList.length * radius * 2.5, totalContentHeight);
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStudCountForContext(studMap, availableStudHexList, scalingFactor, ctx, pictureWidth * 0.25, pictureHeight * 0.2 - radius, pixelType);

    ctx.fillStyle = "#000000";
    ctx.font = (scalingFactor * 2) + 'px Arial';
    ctx.fillText(t('pdfLegoMosaic'), pictureWidth * 0.75, pictureHeight * 0.28);
    ctx.font = (scalingFactor / 2) + 'px Arial';
    ctx.fillText(t('pdfResolution') + ': ' + width + ' x ' + (pixelArray.length / (4 * width)), pictureWidth * 0.75, pictureHeight * 0.34);
    ctx.fillText(t('pdfPlates') + ': ' + platesPerRow + ' x ' + platesPerCol + ' (' + numPlates + ' ' + t('pdfTotal') + ')', pictureWidth * 0.75, pictureHeight * 0.38);
    ctx.fillText(t('pdfPlateSize') + ': ' + plateWidth + ' x ' + plateHeight, pictureWidth * 0.75, pictureHeight * 0.42);
    var height = pixelArray.length / (4 * width);
    ctx.fillText(t('pdfSize') + ': ' + (width * pixelWidthCm).toFixed(1) + ' x ' + (height * pixelWidthCm).toFixed(1) + ' cm', pictureWidth * 0.75, pictureHeight * 0.46);

    var legendHorizontalOffset = pictureWidth * 0.75;
    var legendVerticalOffset = pictureHeight * 0.52;

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = (legendSquareSide / 2) + 'px Arial';

    for (var i = 0; i < numPlates; i++) {
        var horIndex = ((i * plateWidth) % width) / plateWidth;
        var vertIndex = Math.floor((i * plateWidth) / width);
        ctx.beginPath();
        ctx.rect(legendHorizontalOffset + horIndex * legendSquareSide, legendVerticalOffset + vertIndex * legendSquareSide, legendSquareSide, legendSquareSide);
        ctx.fillText(i + 1, legendHorizontalOffset + (horIndex + 0.18) * legendSquareSide, legendVerticalOffset + (vertIndex + 0.65) * legendSquareSide);
        ctx.stroke();
    }

    var previewVerticalOffset = legendVerticalOffset + legendGridHeight + gapBetween;
    ctx.drawImage(finalImageCanvas, 0, 0, finalImageCanvas.width, finalImageCanvas.height,
        legendHorizontalOffset, previewVerticalOffset, legendGridWidth, previewImageHeight);
}

function generateInstructionPage(pixelArray, plateWidth, availableStudHexList, scalingFactor, canvas, plateNumber, pixelType, variablePixelPieceDimensions) {
    var ctx = canvas.getContext("2d");
    var pictureWidth = plateWidth * scalingFactor;
    var pictureHeight = ((pixelArray.length / 4) * scalingFactor) / plateWidth;
    var innerPadding = scalingFactor / 12;
    var radius = scalingFactor / 2;
    var studMap = getUsedPixelsStudMap(pixelArray);

    canvas.height = Math.max(pictureHeight * 1.5, pictureHeight * 0.4 + availableStudHexList.length * radius * 2.5);
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.rect(pictureWidth * 0.75, pictureHeight * 0.2, pictureWidth, pictureHeight);
    ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.fillRect(pictureWidth * 0.75, pictureHeight * 0.2, pictureWidth, pictureHeight);

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = scalingFactor + 'px Arial';
    ctx.beginPath();
    ctx.fillText(t('pdfSection') + ' ' + plateNumber, pictureWidth * 0.75, pictureHeight * 0.2 - scalingFactor);
    ctx.stroke();

    // Draw each stud with its color number
    var usedStudHexList = availableStudHexList.filter(function(hex) { return (studMap[hex] || 0) > 0; });
    var pixelHexToNumber = {};
    availableStudHexList.forEach(function(hex, i) { pixelHexToNumber[hex] = i + 1; });

    ctx.lineWidth = 1;
    for (var i = 0; i < pixelArray.length / 4; i++) {
        var pixelHex = rgbToHex(pixelArray[i * 4], pixelArray[i * 4 + 1], pixelArray[i * 4 + 2]);
        var x = pictureWidth * 0.75 + (i % plateWidth) * 2 * radius;
        var y = pictureHeight * 0.2 + Math.floor(i / plateWidth) * 2 * radius;

        drawPixel(ctx, x, y, radius - innerPadding, pixelHex, inverseHex(pixelHex), PIXEL_TYPE_TO_FLATTENED[pixelType]);

        // Draw the number
        var number = pixelHexToNumber[pixelHex];
        if (number !== undefined) {
            ctx.fillStyle = inverseHex(pixelHex);
            ctx.font = (scalingFactor * 0.55) + 'px Arial';
            ctx.fillText(number, x + radius * 0.25 - (number >= 10 ? scalingFactor * 0.13 : 0), y + radius * 1.15);
        }
    }

    // Variable pixel piece boundaries
    if (variablePixelPieceDimensions) {
        ctx.strokeStyle = "#888888";
        ctx.lineWidth = 3;
        for (var row = 0; row < variablePixelPieceDimensions.length; row++) {
            for (var col = 0; col < variablePixelPieceDimensions[0].length; col++) {
                var part = variablePixelPieceDimensions[row][col];
                if (part != null) {
                    ctx.beginPath();
                    ctx.rect(
                        pictureWidth * 0.75 + col * 2 * radius,
                        pictureHeight * 0.2 + row * 2 * radius,
                        2 * radius * part[1],
                        2 * radius * part[0]
                    );
                    ctx.stroke();
                }
            }
        }
    }

    // Draw legend
    drawStudCountForContext(studMap, usedStudHexList, scalingFactor, ctx, pictureWidth * 0.25, pictureHeight * 0.2 - radius, pixelType);
}

function drawDepthPlatesCountForContext(usedDepthParts, scalingFactor, ctx, horizontalOffset, verticalOffset) {
    var sortedDepthParts = Object.keys(usedDepthParts).filter(function(part) { return (usedDepthParts[part] || 0) > 0; });
    if (sortedDepthParts.length === 0) {
        ctx.fillStyle = "#000000";
        ctx.fillText(t('pdfNoDepthOffset'), horizontalOffset - scalingFactor * 1.5, verticalOffset + scalingFactor * 0.75);
        return;
    }
    sortedDepthParts = sortedDepthParts.sort(function(p1, p2) {
        var a = p1.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR), b = p2.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        return Number(a[0]) * Number(a[1]) - Number(b[0]) * Number(b[1]);
    });

    ctx.font = (scalingFactor / 2) + 'px Arial';
    var lineHeight = scalingFactor * 1.5;
    sortedDepthParts.forEach(function(part, i) {
        var x = horizontalOffset + scalingFactor * 0.8;
        var y = verticalOffset + lineHeight * (i + 0.75);
        ctx.fillStyle = "#000000";
        ctx.fillRect(x - lineHeight * 0.1, y - lineHeight * 0.35, lineHeight, lineHeight * 0.5);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(part, x, y);
        ctx.fillStyle = "#000000";
        ctx.fillText(' X ' + usedDepthParts[part], x + lineHeight, y);
    });
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.rect(horizontalOffset, verticalOffset, scalingFactor * 4, lineHeight * (sortedDepthParts.length + 0.5));
    ctx.stroke();
}

function generateDepthInstructionTitlePage(usedPlatesMatrices, targetResolution, scalingFactor, canvas, finalDepthImageCanvas, plateWidth) {
    var ctx = canvas.getContext("2d");
    var pictureWidth = usedPlatesMatrices[0][0].length * scalingFactor;
    var pictureHeight = usedPlatesMatrices[0][0][0].length * scalingFactor;
    var usedDepthParts = getUsedDepthPartsMap(usedPlatesMatrices.flat());
    var sortedDepthParts = Object.keys(usedDepthParts);
    sortedDepthParts.sort(function(p1, p2) {
        var a = p1.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR), b = p2.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        return Number(a[0]) * Number(a[1]) - Number(b[0]) * Number(b[1]);
    });

    var betweenLevelPicturePadding = pictureHeight * 0.2;
    canvas.height = Math.max(
        pictureHeight * 1.5 + (pictureHeight + betweenLevelPicturePadding) * (usedPlatesMatrices[0].length - 1),
        pictureHeight * 0.4 + sortedDepthParts.length * (scalingFactor / 2) * 2.5
    );
    canvas.width = pictureWidth * 2;

    drawDepthPlatesCountForContext(usedDepthParts, scalingFactor, ctx, pictureWidth * 0.25, pictureHeight * 0.2 - scalingFactor / 2);

    ctx.fillStyle = "#000000";
    ctx.font = (scalingFactor * 2) + 'px Arial';
    ctx.fillText(t('pdfLegoMosaic'), pictureWidth * 0.75, pictureHeight * 0.28);
    ctx.font = (scalingFactor / 2) + 'px Arial';
    ctx.fillText(t('pdfDepthInstructions'), pictureWidth * 0.75, pictureHeight * 0.34);
    ctx.fillText(t('pdfResolution') + ': ' + targetResolution[0] + ' x ' + targetResolution[1], pictureWidth * 0.75, pictureHeight * 0.37);

    var legendHorizontalOffset = pictureWidth * 0.75;
    var legendVerticalOffset = pictureHeight * 0.41;
    var numPlates = usedPlatesMatrices.length;
    var legendSquareSide = scalingFactor;

    ctx.drawImage(finalDepthImageCanvas, 0, 0, finalDepthImageCanvas.width, finalDepthImageCanvas.height,
        legendHorizontalOffset + legendSquareSide / 4 + (legendSquareSide * targetResolution[0]) / plateWidth,
        legendVerticalOffset,
        (legendSquareSide * targetResolution[0]) / plateWidth,
        legendSquareSide * ((numPlates * plateWidth) / targetResolution[0])
    );

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = (legendSquareSide / 2) + 'px Arial';
    for (var i = 0; i < numPlates; i++) {
        var horIndex = ((i * plateWidth) % targetResolution[0]) / plateWidth;
        var vertIndex = Math.floor((i * plateWidth) / targetResolution[0]);
        ctx.beginPath();
        ctx.rect(legendHorizontalOffset + horIndex * legendSquareSide, legendVerticalOffset + vertIndex * legendSquareSide, legendSquareSide, legendSquareSide);
        ctx.fillText(i + 1, legendHorizontalOffset + (horIndex + 0.18) * legendSquareSide, legendVerticalOffset + (vertIndex + 0.65) * legendSquareSide);
        ctx.stroke();
    }
}

function generateDepthInstructionPage(perDepthLevelMatrices, scalingFactor, canvas, plateNumber) {
    var ctx = canvas.getContext("2d");
    var pictureWidth = perDepthLevelMatrices[0].length * scalingFactor;
    var pictureHeight = perDepthLevelMatrices[0][0].length * scalingFactor;
    var radius = scalingFactor / 2;
    var usedDepthParts = getUsedDepthPartsMap(perDepthLevelMatrices);

    var betweenLevelPicturePadding = pictureHeight * 0.2;
    canvas.height = Math.max(
        pictureHeight * 1.5 + (pictureHeight + betweenLevelPicturePadding) * (perDepthLevelMatrices.length - 1),
        pictureHeight * 0.4 + Object.keys(usedDepthParts).length * radius * 2.5
    );
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#000000";
    ctx.font = scalingFactor + 'px Arial';
    ctx.beginPath();
    ctx.fillText(t('pdfSection') + ' ' + plateNumber + ' ' + t('pdfDepthPlatingInstructions'), pictureWidth * 0.75, pictureHeight * 0.2 - scalingFactor);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.font = (scalingFactor * 0.75) + 'px Arial';

    for (var depthIndex = 0; depthIndex < perDepthLevelMatrices.length; depthIndex++) {
        var horizontalOffset = pictureWidth * 0.75;
        var verticalOffset = pictureHeight * 0.25 + (pictureHeight + betweenLevelPicturePadding) * depthIndex;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.rect(horizontalOffset, verticalOffset, pictureWidth, pictureHeight);
        ctx.strokeStyle = "#000000";
        ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.fillRect(horizontalOffset, verticalOffset, pictureWidth, pictureHeight);

        ctx.beginPath();
        ctx.fillText(t('pdfLevel') + ' ' + (depthIndex + 1), pictureWidth * 0.75, verticalOffset - scalingFactor * 0.5);
        ctx.stroke();

        var partMatrix = perDepthLevelMatrices[depthIndex];
        ctx.fillStyle = "#222222";
        ctx.lineWidth = 2;
        var innerPadding = scalingFactor / 12;
        var innerRadius = scalingFactor * 0.5 - 2 * innerPadding;

        for (var row = 0; row < partMatrix.length; row++) {
            for (var col = 0; col < partMatrix[0].length; col++) {
                ctx.beginPath();
                ctx.arc(horizontalOffset + (col + 0.5) * scalingFactor, verticalOffset + (row + 0.5) * scalingFactor, innerRadius, 0, 2 * Math.PI);
                ctx.fill();

                var part = partMatrix[row][col];
                if (part != null) {
                    ctx.strokeStyle = "#888888";
                    ctx.beginPath();
                    ctx.rect(horizontalOffset + col * scalingFactor, verticalOffset + row * scalingFactor, scalingFactor * part[1], scalingFactor * part[0]);
                    ctx.stroke();
                    ctx.strokeStyle = "#FFFFFF";
                    ctx.beginPath();
                    ctx.rect(horizontalOffset + col * scalingFactor + innerPadding, verticalOffset + row * scalingFactor + innerPadding,
                        scalingFactor * part[1] - 2 * innerPadding, scalingFactor * part[0] - 2 * innerPadding);
                    ctx.stroke();
                }
            }
        }
    }

    drawDepthPlatesCountForContext(usedDepthParts, scalingFactor, ctx, pictureWidth * 0.25, pictureHeight * 0.2 - radius);
}
