/**
 * Native color distance implementations.
 * Replaces d3.js + d3-color-difference dependency (~600KB).
 *
 * Supported methods: CIEDE2000, CIE94, DIN99o, Euclidean RGB, Euclidean LAB
 */

// ============================================
// RGB <-> LAB conversion via XYZ (D65 illuminant)
// ============================================

// D65 reference white point
var D65_X = 0.95047;
var D65_Y = 1.00000;
var D65_Z = 1.08883;

function sRGBtoLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
    var lr = sRGBtoLinear(r);
    var lg = sRGBtoLinear(g);
    var lb = sRGBtoLinear(b);
    return [
        0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb,
        0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb,
        0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb
    ];
}

function xyzToLab(x, y, z) {
    var epsilon = 216 / 24389; // 0.008856
    var kappa = 24389 / 27;    // 903.3

    var fx = x / D65_X;
    var fy = y / D65_Y;
    var fz = z / D65_Z;

    fx = fx > epsilon ? Math.cbrt(fx) : (kappa * fx + 16) / 116;
    fy = fy > epsilon ? Math.cbrt(fy) : (kappa * fy + 16) / 116;
    fz = fz > epsilon ? Math.cbrt(fz) : (kappa * fz + 16) / 116;

    return [
        116 * fy - 16,       // L
        500 * (fx - fy),     // a
        200 * (fy - fz)      // b
    ];
}

function rgbToLab(r, g, b) {
    var xyz = rgbToXyz(r, g, b);
    return xyzToLab(xyz[0], xyz[1], xyz[2]);
}

// ============================================
// CIEDE2000 - Full implementation per CIE 142-2001
// ============================================

function ciede2000(lab1, lab2) {
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];

    var C1 = Math.sqrt(a1 * a1 + b1 * b1);
    var C2 = Math.sqrt(a2 * a2 + b2 * b2);
    var Cab = (C1 + C2) / 2;

    var Cab7 = Math.pow(Cab, 7);
    var G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 6103515625))); // 25^7 = 6103515625

    var a1p = a1 * (1 + G);
    var a2p = a2 * (1 + G);

    var C1p = Math.sqrt(a1p * a1p + b1 * b1);
    var C2p = Math.sqrt(a2p * a2p + b2 * b2);

    var h1p = Math.atan2(b1, a1p);
    if (h1p < 0) h1p += 2 * Math.PI;
    var h2p = Math.atan2(b2, a2p);
    if (h2p < 0) h2p += 2 * Math.PI;

    var dLp = L2 - L1;
    var dCp = C2p - C1p;

    var dhp;
    if (C1p * C2p === 0) {
        dhp = 0;
    } else {
        dhp = h2p - h1p;
        if (dhp > Math.PI) dhp -= 2 * Math.PI;
        else if (dhp < -Math.PI) dhp += 2 * Math.PI;
    }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2);

    var Lp = (L1 + L2) / 2;
    var Cp = (C1p + C2p) / 2;

    var hp;
    if (C1p * C2p === 0) {
        hp = h1p + h2p;
    } else {
        hp = (h1p + h2p) / 2;
        if (Math.abs(h1p - h2p) > Math.PI) {
            if (h1p + h2p < 2 * Math.PI) hp += Math.PI;
            else hp -= Math.PI;
        }
    }

    var T = 1
        - 0.17 * Math.cos(hp - Math.PI / 6)
        + 0.24 * Math.cos(2 * hp)
        + 0.32 * Math.cos(3 * hp + Math.PI / 30)
        - 0.20 * Math.cos(4 * hp - 63 * Math.PI / 180);

    var Lp50sq = (Lp - 50) * (Lp - 50);
    var SL = 1 + 0.015 * Lp50sq / Math.sqrt(20 + Lp50sq);
    var SC = 1 + 0.045 * Cp;
    var SH = 1 + 0.015 * Cp * T;

    var Cp7 = Math.pow(Cp, 7);
    var RC = 2 * Math.sqrt(Cp7 / (Cp7 + 6103515625));
    var dtheta = 30 * Math.exp(-Math.pow((hp * 180 / Math.PI - 275) / 25, 2));
    var RT = -Math.sin(2 * dtheta * Math.PI / 180) * RC;

    var dL = dLp / SL;
    var dC = dCp / SC;
    var dH = dHp / SH;

    return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
}

// ============================================
// CIE94 - Graphic arts weighting
// ============================================

function cie94(lab1, lab2) {
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];

    var dL = L1 - L2;
    var C1 = Math.sqrt(a1 * a1 + b1 * b1);
    var C2 = Math.sqrt(a2 * a2 + b2 * b2);
    var dC = C1 - C2;
    var da = a1 - a2;
    var db = b1 - b2;
    var dH2 = da * da + db * db - dC * dC;
    if (dH2 < 0) dH2 = 0;

    // Graphic arts: kL=1, K1=0.045, K2=0.015
    var SL = 1;
    var SC = 1 + 0.045 * C1;
    var SH = 1 + 0.015 * C1;

    var valL = dL / SL;
    var valC = dC / SC;
    var valH2 = dH2 / (SH * SH);

    return Math.sqrt(valL * valL + valC * valC + valH2);
}

// ============================================
// DIN99o - Based on DIN 6176 / CIE technical report
// ============================================

function din99o(lab1, lab2) {
    // Convert LAB to DIN99o space
    function labToDin99o(L, a, b) {
        var L99 = 325.22 * Math.log(1 + 0.0036 * L);
        // Rotation by 50 degrees
        var angle = 50 * Math.PI / 180;
        var e = a * Math.cos(angle) + b * Math.sin(angle);
        var f = 0.83 * (-a * Math.sin(angle) + b * Math.cos(angle));
        var G = Math.sqrt(e * e + f * f);
        var C99 = 22.5 * Math.log(1 + 0.003 * G);
        var h99;
        if (G === 0) {
            h99 = 0;
        } else {
            h99 = Math.atan2(f, e);
        }
        var a99 = C99 * Math.cos(h99);
        var b99 = C99 * Math.sin(h99);
        return [L99, a99, b99];
    }

    var d1 = labToDin99o(lab1[0], lab1[1], lab1[2]);
    var d2 = labToDin99o(lab2[0], lab2[1], lab2[2]);

    var dL = d1[0] - d2[0];
    var da = d1[1] - d2[1];
    var db = d1[2] - d2[2];

    return Math.sqrt(dL * dL + da * da + db * db);
}

// ============================================
// Simple distance functions
// ============================================

function euclideanRGB(rgb1, rgb2) {
    var sum = 0;
    for (var i = 0; i < 3; i++) {
        sum += Math.abs(rgb1[i] - rgb2[i]);
    }
    return sum;
}

function euclideanLAB(lab1, lab2) {
    var dL = lab1[0] - lab2[0];
    var da = lab1[1] - lab2[1];
    var db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
}

// ============================================
// Factory: create distance function with caching
// ============================================

/**
 * Creates a color distance function with internal LAB cache.
 * @param {string} methodName - One of: 'ciede2000', 'cie94', 'din99o', 'euclideanRGB', 'euclideanLAB'
 * @returns {function(rgb1, rgb2): number} Distance function taking two [r,g,b] arrays
 */
function createColorDistanceFunction(methodName) {
    if (methodName === 'euclideanRGB') {
        return euclideanRGB;
    }

    // For LAB-based methods, cache the LAB conversion
    var labCache = new Map();

    function getLab(r, g, b) {
        var key = (r << 16) | (g << 8) | b;
        var lab = labCache.get(key);
        if (lab === undefined) {
            lab = rgbToLab(r, g, b);
            labCache.set(key, lab);
        }
        return lab;
    }

    var distFn;
    switch (methodName) {
        case 'euclideanLAB':
            distFn = euclideanLAB;
            break;
        case 'cie94':
            distFn = cie94;
            break;
        case 'din99o':
            distFn = din99o;
            break;
        case 'ciede2000':
        default:
            distFn = ciede2000;
            break;
    }

    return function(rgb1, rgb2) {
        var lab1 = getLab(rgb1[0], rgb1[1], rgb1[2]);
        var lab2 = getLab(rgb2[0], rgb2[1], rgb2[2]);
        return distFn(lab1, lab2);
    };
}

/**
 * Info about available color distance functions (for UI population)
 */
var colorDistanceFunctionsInfo = {
    euclideanRGB: { name: "Euclidean RGB" },
    euclideanLAB: { name: "Euclidean LAB" },
    cie94: { name: "CIE94" },
    ciede2000: { name: "CIEDE2000" },
    din99o: { name: "DIN99o" }
};

var defaultDistanceFunctionKey = "ciede2000";
