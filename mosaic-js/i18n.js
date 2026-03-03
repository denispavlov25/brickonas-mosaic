// Internationalization (i18n) support
const translations = {
    en: {
        // Page title and header
        pageTitle: "Lego mosaic",
        
        // Step navigation
        step1Crop: "Step 1: Crop",
        step2Adjust: "Step 2: Adjust",
        step3Colors: "Step 3: Colors",
        step4Output: "Step 4: Output",
        
        // Step headers
        step1: "Step 1",
        step2: "Step 2",
        step3: "Step 3",
        step4: "Step 4",
        step2Header: "Step 2",
        step3Header: "Step 3",
        step4Header: "Result",
        
        // Step subtitles
        step1DepthSubtitle: "Get depth map",
        step1DepthSubtitle2: "Depth map cropping will match input image",
        step2Subtitle: "Interpolate + Adjust colors",
        step2DepthSubtitle: "Make depth discrete",
        step3Subtitle: "Align to closest pixel from available colors",
        step3DepthSubtitle: "Adjust Depth Map",
        step4Subtitle: "Your finished mosaic — download the build instructions as PDF",
        
        // Navigation buttons
        nextAdjust: "Next: Adjust Colors →",
        nextColors: "Next: Colors →",
        nextOutput: "Next: Output →",
        backCrop: "← Back: Crop",
        backConfigure: "← Back: Configure",
        backAdjust: "← Back: Adjust",
        backColors: "← Back: Colors",
        
        // Resolution section
        resolution: "Resolution",
        targetResolution: "Target Resolution:",
        resolutionStepWidth: "Resolution Step Width (plate size):",
        resolutionStepHeight: "Resolution Step Height (plate size):",
        width: "Width (number of studs):",
        height: "Height (number of studs):",
        
        // Input Image section
        inputImage: "Input Image",
        supportedFormats: "Supported image formats are dependent on your browser's compatibility",
        transparencyWarning: "Due to the nature of the Lego Art sets, images with transparency aren't fully supported",
        
        // Depth section
        depth: "Depth",
        depthThreshold: "Depth Threshold",
        depthThresholds: "Depth Thresholds",
        numDepthLevels: "Num. Depth Levels",
        
        // Stepper labels
        stepperUpload: "Upload Image",
        stepperCrop: "Crop",
        stepperConfigure: "Configure",
        stepperColors: "Colors",
        stepperResult: "Result",

        // Step headers (redesigned)
        step1Header: "Crop & Scale",
        mosaicUploadDesc: "Upload an image here. It will be processed automatically. In the next step you can select the format.",
        supportedFormatsShort: "Allowed files: JPG, PNG, GIF, WEBP",
        advancedSettings: "Advanced Settings",
        step2Hint: "Does the image look good? If you want to adjust colors, brightness or contrast, open the advanced settings.",

        // Get Started section
        getStarted: "Get Started",
        uploadImage: "Upload Image",
        pasteImage: "Paste Image",
        exampleImage: "Example Image",
        orPasteImage: "Or, paste an image from your clipboard",

        // HSV section
        hsv: "HSV",
        hueAdjustment: "Hue adjustment:",
        saturationAdjustment: "Saturation adjustment:",
        valueAdjustment: "Value adjustment:",
        resetHSV: "Reset HSV",
        
        // Color Adjustment section
        colorAdjustment: "Color Adjustment",
        hue: "Hue",
        saturation: "Saturation",
        brightness: "Brightness",
        contrast: "Contrast",
        value: "Value",
        clearOverrides: "Clear Overrides",
        brightnessAdjustment: "Brightness adjustment:",
        contrastAdjustment: "Contrast adjustment:",
        resetBrightness: "Reset Brightness",
        resetContrast: "Reset Contrast",
        
        // Interpolation section
        interpolation: "Interpolation",
        interpolationAlgorithm: "Interpolation Algorithm",
        default: "Default",
        maxPooling: "Max Pooling",
        minPooling: "Min Pooling",
        avgPooling: "Avg Pooling",
        dualMinMaxPooling: "Dual Min-Max Pooling",
        
        // Color tab
        color: "Color",
        
        // Available Colors/Studs section
        availableStuds: "Available Studs",
        availableColors: "Available Colors",
        colorPalette: "Color Palette",
        useInfiniteStuds: "Use infinite studs",
        studType: "Stud Type",
        clearAvailablePieces: "Clear Available Pieces",
        pixelPiece: "Pixel Piece",
        
        // Refine Colors section
        refineColors: "Refine Colors",
        eraserSize: "Eraser Size",
        eraser: "Eraser",
        paintbrush: "Paintbrush",
        clearColorOverrides: "Clear Color Overrides",
        
        // Refine Depth section
        refineDepth: "Refine Depth",
        editDepth: "Edit Depth",
        clearDepthOverrides: "Clear Depth Overrides",
        clearOverrides: "Clear Overrides",
        clickPixelIncrease: "● Click a pixel to increase its height",
        clickPixelDecrease: "● Click a pixel to decrease its height",
        
        // Output section
        piecesUsed: "Pieces Used",
        missingPieces: "Missing Pieces",
        downloadInstructions: "Download Instructions",
        instructions: "Instructions",
        generateInstructions: "Generate Color Instructions PDF",
        generateInstructionsPDF: "Generate Instructions PDF",
        generateDepthInstructions: "Generate Depth Instructions PDF",
        generateDepthInstructionsPDF: "Generate Depth Instructions PDF",
        highQuality: "High Quality",
        highQualityPdf: "High quality pdf",
        copyBricklinkXML: "Copy Bricklink XML to Clipboard",
        bricklinkUploadPage: "Bricklink Upload Page",
        usPickABrickPage: "U.S. Pick a Brick Page",
        
        // 3D Preview
        preview3D: "3D Preview",
        preview3DHelp: "If you can't see the 3D effect when hovering your mouse over the image, check the input from depth step 1",
        
        // Depth section - Step 1
        select: "Select",
        selectDepthMapImage: "Select Depth Map Image",
        selectDepthMapHelp: "If you have a depth map corresponding to your image you can select it here. If you don't, you can generate an approximation in the 'generate' section.",
        generate: "Generate",
        computeUsingDNN: "Compute Using DNN",
        computeDepthMapHelp: "This will compute an approximation of the depth map if you do not have one",
        computeDepthMapWarning: "Computing the depth map can be computationally expensive. Be prepared to wait a bit, and be careful, especially if you have a less powerful device.",
        howDoesThisWork: "How does this work?",
        dnnExplanation: "The depth map is computed using a DNN (deep neural network). For the reasons described in the 'about' section, everything is run entirely within the browser, using a modified version of ONNX.js. The model used is MiDaS.",
        citationForModel: "Citation for Model Used",
        important: "Important",
        
        // Step 1 subtitle
        step1Subtitle: "Crop + Scale input image",
        
        // Interpolation
        interpolationHelp: "This setting determines which algorithm is used to resize the image to the target resolution",
        browserDefault: "Browser Default",
        
        // Level Count and Thresholds
        levelCount: "Level Count",
        numberOfDepthLevels: "Number of depth levels:",
        depthLevelsHelp: "Determines how many discrete levels of depth you want the pixels of the image to have, where each level is one Lego plate deep",
        thresholds: "Thresholds",
        troubleshooting: "Troubleshooting",
        troubleshootingHelp: "If the discretized depth map is blank, make sure you've selected or computed a depth map in step 1, and adjust the thresholds so that they are between the sections of the image you want to separate",
        
        // Tools
        dropper: "Dropper",
        
        // Available Colors help
        availableColorsHelp1: "● This section specifies how many pieces of each color you have available to create the image",
        availableColorsHelp2: "● Color names are bricklink colors",
        availableColorsHelp3: "● Step 4 of the algorithm cannot run unless you select enough pieces to fill the picture ('Missing Pieces' must be 0)",
        availableColorsHelp4: "● If you're working with an existing set, then clear the available pieces and use the mix in option to add in the pieces from your set.",
        requiredPieces: "Required Pieces:",
        availablePieces: "Available Pieces:",
        missingPiecesLabel: "Missing Pieces:",
        infinitePieceCounts: "Infinite Piece Counts",
        infinitePieceCountsWarning: "Important: Infinite piece counts were used, since a linear error dithering algorithm was selected in the 'Quantization' section, or a variable piece type was selected in the 'Pixel Piece' section",
        paintbrushNote: "Note: Any colors painted using the paintbrush are assumed to exist when infinite piece counts are enabled",
        numberAvailable: "Number Available",
        addStud: "+ Add Stud",
        exportSelectedStuds: "Export Selected Studs",
        mixInStuds: "Mix in Studs From Existing Set",
        mixedInStudsNote: "Mixed in studs are added to studs already selected",
        matchPixelPieceNote: "Make sure the set you're mixing in studs from matches the selected pixel piece",
        importFromFile: "Import From File",
        
        // Step 4 Pieces Used
        missingPiecesWarning: "'Missing Pieces' under 'Available Colors' must be 0",
        piecesUsedInFinalImage: "Pieces Used in Final Image",
        dimensions: "Dimensions",
        numberUsed: "Number Used",
        piecesMissingFromStep3: "Pieces Missing From Step 3",
        addingPiecesHelp: "Adding these pieces will allow the image from step 4 to match the image from step 3",
        numberMissing: "Number Missing",
        
        // Instructions section
        instructionsSplitNote: "Longer instructions may be split into multiple files",
        colorNamesAreBricklink: "Color names are Bricklink colors",
        pdfGenerationWarning: "Depending on your hardware and the resolution you've chosen, the pdf can take quite a few seconds to generate. Be prepared to wait if you're generating instructions for larger resolutions, especially for high quality pdfs. Larger resolutions may also cause some slowness on the page or may not work at all on less powerful devices, so I recommend starting at the default and then going up.",
        
        // Get Started
        inputSet: "Input set",
        inputPieces: "Input Pieces:",
        inputPiecesTooltip: "This can also be changed or adjusted piece by piece later",
        selectInputImage: "Select Input Image",
        reselectInputImage: "Reselect Input Image",
        seeAnExample: "See an Example",
        
        // Stud map descriptions
        allStudColorsDesc: "All colors in which studs (1x1 round plates) are available",
        allTileColorsDesc: "All colors in which 1x1 round tiles are available",
        allSupportedColorsDesc: "All colors supported by the application",
        pickABrickDesc: "All colors in which studs are available on the Lego.com pick a brick page",
        
        // Metrics
        usageMetrics: "Usage Metrics",
        metricsNote: "Note: No user data is stored, so this is just aggregated info based on simple increments",
        date: "Date",
        imagesCreated: "Images created",
        
        // PDF content
        pdfLegoMosaic: "Lego mosaic",
        pdfFilename: "Lego-mosaic",
        pdfInstructions: "Instructions",
        pdfPart: "Part",
        pdfResolution: "Resolution",
        pdfPlates: "Plates",
        pdfPlateSize: "Plate Size",
        pdfSize: "Size",
        pdfTotal: "total",
        pdfSection: "Section",
        pdfDepthInstructions: "Depth Instructions",
        pdfDepthPlatingInstructions: "Depth Plating Instructions",
        pdfLevel: "Level",
        pdfColor: "Color",
        pdfNoDepthOffset: "No depth offset in section",
        
        // Tips section (3D Preview)
        tips: "Tips",
        previewEffectIntensity: "Preview effect intensity",
        tipsHelp1: "● This is a (very) rough preview of what the 3D effect might look like",
        tipsHelp2: "● Hover your mouse over the image to vary the perspective",
        tipsHelp3: "● Make sure your depth map is not blank",
        tipsHelp4: "● This is unlikely to work well on less powerful devices, since this is generated dynamically",
        tipsHelp5: "● Keep in mind that the effect varies from browser to browser, can be subtle, and may not be 100% representative of what the physical art piece would look like",
        
        // Depth Plates section
        depthPlates: "Depth Plates",
        depthPlatesHelp1: "● This is the set of plates that may be used to generate depth instructions and piece lists",
        depthPlatesHelp2: "● These pieces are used as padding so that the correct pixels protrude outwards",
        depthPlatesHelp3: "● Note that larger plates may be difficult to attach/detach from the base",
        availablePlates: "Available Plates:",
        
        // Loading status messages
        loadingProcessing: "Processing image\u2026",
        loadingRendering: "Rendering preview\u2026",
        loadingQuantizing: "Mapping colors\u2026",
        loadingOptimizing: "Optimizing piece counts\u2026",

        // Language
        language: "Language",
        english: "English",
        german: "German",
    },
    de: {
        // Page title and header
        pageTitle: "Lego Mosaik",
        
        // Step navigation
        step1Crop: "Schritt 1: Zuschneiden",
        step2Adjust: "Schritt 2: Anpassen",
        step3Colors: "Schritt 3: Farben",
        step4Output: "Schritt 4: Ausgabe",
        
        // Step headers
        step1: "Schritt 1",
        step2: "Schritt 2",
        step3: "Schritt 3",
        step4: "Schritt 4",
        step2Header: "Schritt 2",
        step3Header: "Schritt 3",
        step4Header: "Ergebnis",
        
        // Step subtitles
        step1DepthSubtitle: "Tiefenkarte erhalten",
        step1DepthSubtitle2: "Tiefenkarten-Zuschnitt entspricht dem Eingabebild",
        step2Subtitle: "Interpolieren + Farben anpassen",
        step2DepthSubtitle: "Tiefe diskretisieren",
        step3Subtitle: "An nächste Pixelfarbe aus verfügbaren Farben angleichen",
        step3DepthSubtitle: "Tiefenkarte anpassen",
        step4Subtitle: "Dein fertiges Mosaik – lade die Bauanleitung als PDF herunter",
        
        // Navigation buttons
        nextAdjust: "Weiter: Farben anpassen →",
        nextColors: "Weiter: Farben →",
        nextOutput: "Weiter: Ausgabe →",
        backCrop: "← Zurück: Zuschneiden",
        backConfigure: "← Zurück: Anpassen",
        backAdjust: "← Zurück: Anpassen",
        backColors: "← Zurück: Farben",
        
        // Resolution section
        resolution: "Auflösung",
        targetResolution: "Zielauflösung:",
        resolutionStepWidth: "Auflösungsschritt Breite (Plattengröße):",
        resolutionStepHeight: "Auflösungsschritt Höhe (Plattengröße):",
        width: "Breite (Noppenanzahl):",
        height: "Höhe (Noppenanzahl):",
        
        // Input Image section
        inputImage: "Eingabebild",
        supportedFormats: "Unterstützte Bildformate hängen von der Kompatibilität Ihres Browsers ab",
        transparencyWarning: "Aufgrund der Art der Lego Art Sets werden Bilder mit Transparenz nicht vollständig unterstützt",
        
        // Depth section
        depth: "Tiefe",
        depthThreshold: "Tiefenschwelle",
        depthThresholds: "Tiefenschwellen",
        numDepthLevels: "Anz. Tiefenstufen",
        
        // Stepper labels
        stepperUpload: "Bild hochladen",
        stepperCrop: "Zuschneiden",
        stepperConfigure: "Anpassen",
        stepperColors: "Farben",
        stepperResult: "Ergebnis",

        // Step headers (redesigned)
        step1Header: "Zuschneiden & Skalieren",
        mosaicUploadDesc: "Lade hier ein Bild hoch. Es wird automatisch verarbeitet. Im nächsten Schritt kannst du das Format auswählen.",
        supportedFormatsShort: "Erlaubte Dateien: JPG, PNG, GIF, WEBP",
        advancedSettings: "Erweiterte Einstellungen",
        step2Hint: "Sieht das Bild gut aus? Falls du Farben, Helligkeit oder Kontrast anpassen möchtest, öffne die erweiterten Einstellungen.",

        // Get Started section
        getStarted: "Loslegen",
        uploadImage: "Bild hochladen",
        pasteImage: "Bild einfügen",
        exampleImage: "Beispielbild",
        orPasteImage: "Oder fügen Sie ein Bild aus der Zwischenablage ein",
        
        // HSV section
        hsv: "HSV",
        hueAdjustment: "Farbton-Anpassung:",
        saturationAdjustment: "Sättigungs-Anpassung:",
        valueAdjustment: "Wert-Anpassung:",
        resetHSV: "HSV zurücksetzen",
        
        // Color Adjustment section
        colorAdjustment: "Farbanpassung",
        hue: "Farbton",
        saturation: "Sättigung",
        brightness: "Helligkeit",
        contrast: "Kontrast",
        value: "Wert",
        clearOverrides: "Überschreibungen löschen",
        brightnessAdjustment: "Helligkeits-Anpassung:",
        contrastAdjustment: "Kontrast-Anpassung:",
        resetBrightness: "Helligkeit zurücksetzen",
        resetContrast: "Kontrast zurücksetzen",
        
        // Interpolation section
        interpolation: "Interpolation",
        interpolationAlgorithm: "Interpolationsalgorithmus",
        default: "Standard",
        maxPooling: "Max Pooling",
        minPooling: "Min Pooling",
        avgPooling: "Durchschnitts-Pooling",
        dualMinMaxPooling: "Dual Min-Max Pooling",
        
        // Color tab
        color: "Farbe",
        
        // Available Colors/Studs section
        availableStuds: "Verfügbare Noppen",
        availableColors: "Verfügbare Farben",
        colorPalette: "Farbpalette",
        useInfiniteStuds: "Unendliche Noppen verwenden",
        studType: "Noppentyp",
        clearAvailablePieces: "Verfügbare Teile löschen",
        pixelPiece: "Pixel-Teil",
        
        // Refine Colors section
        refineColors: "Farben verfeinern",
        eraserSize: "Radiergröße",
        eraser: "Radierer",
        paintbrush: "Pinsel",
        clearColorOverrides: "Farbüberschreibungen löschen",
        
        // Refine Depth section
        refineDepth: "Tiefe verfeinern",
        editDepth: "Tiefe bearbeiten",
        clearDepthOverrides: "Tiefenüberschreibungen löschen",
        clearOverrides: "Überschreibungen löschen",
        clickPixelIncrease: "● Klicken Sie auf ein Pixel, um seine Höhe zu erhöhen",
        clickPixelDecrease: "● Klicken Sie auf ein Pixel, um seine Höhe zu verringern",
        
        // Output section
        piecesUsed: "Verwendete Teile",
        missingPieces: "Fehlende Teile",
        downloadInstructions: "Anleitung herunterladen",
        instructions: "Anleitungen",
        generateInstructions: "Farbanleitung PDF erstellen",
        generateInstructionsPDF: "Anleitung PDF erstellen",
        generateDepthInstructions: "Tiefenanleitung PDF erstellen",
        generateDepthInstructionsPDF: "Tiefenanleitung PDF erstellen",
        highQuality: "Hohe Qualität",
        highQualityPdf: "Hohe Qualität PDF",
        copyBricklinkXML: "Bricklink XML in Zwischenablage kopieren",
        bricklinkUploadPage: "Bricklink Upload-Seite",
        usPickABrickPage: "U.S. Pick a Brick Seite",
        
        // 3D Preview
        preview3D: "3D-Vorschau",
        preview3DHelp: "Wenn Sie den 3D-Effekt nicht sehen können, wenn Sie mit der Maus über das Bild fahren, überprüfen Sie die Eingabe von Tiefenschritt 1",
        
        // Depth section - Step 1
        select: "Auswählen",
        selectDepthMapImage: "Tiefenkartenbild auswählen",
        selectDepthMapHelp: "Wenn Sie eine Tiefenkarte haben, die Ihrem Bild entspricht, können Sie sie hier auswählen. Wenn nicht, können Sie im Abschnitt 'Generieren' eine Annäherung erstellen.",
        generate: "Generieren",
        computeUsingDNN: "Mit DNN berechnen",
        computeDepthMapHelp: "Dies berechnet eine Annäherung der Tiefenkarte, wenn Sie keine haben",
        computeDepthMapWarning: "Die Berechnung der Tiefenkarte kann rechenintensiv sein. Seien Sie bereit, etwas zu warten, und seien Sie vorsichtig, besonders wenn Sie ein weniger leistungsfähiges Gerät haben.",
        howDoesThisWork: "Wie funktioniert das?",
        dnnExplanation: "Die Tiefenkarte wird mit einem DNN (Deep Neural Network) berechnet. Aus den im Abschnitt 'Über' beschriebenen Gründen wird alles vollständig im Browser ausgeführt, unter Verwendung einer modifizierten Version von ONNX.js. Das verwendete Modell ist MiDaS.",
        citationForModel: "Zitat für verwendetes Modell",
        important: "Wichtig",
        
        // Step 1 subtitle
        step1Subtitle: "Eingabebild zuschneiden + skalieren",
        
        // Interpolation
        interpolationHelp: "Diese Einstellung bestimmt, welcher Algorithmus verwendet wird, um das Bild auf die Zielauflösung zu skalieren",
        browserDefault: "Browser-Standard",
        
        // Level Count and Thresholds
        levelCount: "Stufenanzahl",
        numberOfDepthLevels: "Anzahl der Tiefenstufen:",
        depthLevelsHelp: "Bestimmt, wie viele diskrete Tiefenstufen die Pixel des Bildes haben sollen, wobei jede Stufe eine Lego-Platte tief ist",
        thresholds: "Schwellenwerte",
        troubleshooting: "Fehlerbehebung",
        troubleshootingHelp: "Wenn die diskretisierte Tiefenkarte leer ist, stellen Sie sicher, dass Sie in Schritt 1 eine Tiefenkarte ausgewählt oder berechnet haben, und passen Sie die Schwellenwerte so an, dass sie zwischen den Abschnitten des Bildes liegen, die Sie trennen möchten",
        
        // Tools
        dropper: "Pipette",
        
        // Available Colors help
        availableColorsHelp1: "● In diesem Abschnitt wird angegeben, wie viele Teile jeder Farbe Sie zur Verfügung haben, um das Bild zu erstellen",
        availableColorsHelp2: "● Farbnamen sind Bricklink-Farben",
        availableColorsHelp3: "● Schritt 4 des Algorithmus kann nur ausgeführt werden, wenn Sie genügend Teile ausgewählt haben ('Fehlende Teile' muss 0 sein)",
        availableColorsHelp4: "● Wenn Sie mit einem vorhandenen Set arbeiten, löschen Sie die verfügbaren Teile und verwenden Sie die Misch-Option, um die Teile aus Ihrem Set hinzuzufügen.",
        requiredPieces: "Erforderliche Teile:",
        availablePieces: "Verfügbare Teile:",
        missingPiecesLabel: "Fehlende Teile:",
        infinitePieceCounts: "Unendliche Teileanzahl",
        infinitePieceCountsWarning: "Wichtig: Unendliche Teileanzahlen wurden verwendet, da ein linearer Fehlerdithering-Algorithmus im Abschnitt 'Quantisierung' ausgewählt wurde oder ein variabler Teiltyp im Abschnitt 'Pixel-Teil' ausgewählt wurde",
        paintbrushNote: "Hinweis: Alle mit dem Pinsel gemalten Farben werden als vorhanden angenommen, wenn unendliche Teileanzahlen aktiviert sind",
        numberAvailable: "Anzahl verfügbar",
        addStud: "+ Noppe hinzufügen",
        exportSelectedStuds: "Ausgewählte Noppen exportieren",
        mixInStuds: "Noppen aus vorhandenem Set mischen",
        mixedInStudsNote: "Gemischte Noppen werden zu bereits ausgewählten Noppen hinzugefügt",
        matchPixelPieceNote: "Stellen Sie sicher, dass das Set, aus dem Sie Noppen mischen, zum ausgewählten Pixel-Teil passt",
        importFromFile: "Aus Datei importieren",
        
        // Step 4 Pieces Used
        missingPiecesWarning: "'Fehlende Teile' unter 'Verfügbare Farben' muss 0 sein",
        piecesUsedInFinalImage: "Im Endbild verwendete Teile",
        dimensions: "Abmessungen",
        numberUsed: "Anzahl verwendet",
        piecesMissingFromStep3: "Fehlende Teile aus Schritt 3",
        addingPiecesHelp: "Das Hinzufügen dieser Teile ermöglicht es, dass das Bild aus Schritt 4 mit dem Bild aus Schritt 3 übereinstimmt",
        numberMissing: "Anzahl fehlend",
        
        // Instructions section
        instructionsSplitNote: "Längere Anleitungen können in mehrere Dateien aufgeteilt werden",
        colorNamesAreBricklink: "Farbnamen sind Bricklink-Farben",
        pdfGenerationWarning: "Je nach Hardware und gewählter Auflösung kann die PDF-Erstellung einige Sekunden dauern. Seien Sie bereit zu warten, wenn Sie Anleitungen für größere Auflösungen erstellen, besonders für hochwertige PDFs. Größere Auflösungen können auch zu Verlangsamungen auf der Seite führen oder auf weniger leistungsfähigen Geräten gar nicht funktionieren, daher empfehle ich, mit der Standardeinstellung zu beginnen und dann hochzugehen.",
        
        // Get Started
        inputSet: "Eingabe-Set",
        inputPieces: "Eingabe-Teile:",
        inputPiecesTooltip: "Dies kann auch später Teil für Teil geändert oder angepasst werden",
        selectInputImage: "Eingabebild auswählen",
        reselectInputImage: "Eingabebild erneut auswählen",
        seeAnExample: "Beispiel ansehen",
        
        // Stud map descriptions
        allStudColorsDesc: "Alle Farben, in denen Noppen (1x1 runde Platten) verfügbar sind",
        allTileColorsDesc: "Alle Farben, in denen 1x1 runde Fliesen verfügbar sind",
        allSupportedColorsDesc: "Alle von der Anwendung unterstützten Farben",
        pickABrickDesc: "Alle Farben, in denen Noppen auf der Lego.com Pick a Brick Seite verfügbar sind",
        
        // Metrics
        usageMetrics: "Nutzungsstatistiken",
        metricsNote: "Hinweis: Es werden keine Benutzerdaten gespeichert, dies sind nur aggregierte Informationen basierend auf einfachen Zählungen",
        date: "Datum",
        imagesCreated: "Erstellte Bilder",
        
        // PDF content
        pdfLegoMosaic: "Lego Mosaik",
        pdfFilename: "Lego-Mosaik",
        pdfInstructions: "Anleitung",
        pdfPart: "Teil",
        pdfResolution: "Auflösung",
        pdfPlates: "Platten",
        pdfPlateSize: "Plattengröße",
        pdfSize: "Größe",
        pdfTotal: "gesamt",
        pdfSection: "Abschnitt",
        pdfDepthInstructions: "Tiefenanleitung",
        pdfDepthPlatingInstructions: "Tiefenplatten-Anleitung",
        pdfLevel: "Ebene",
        pdfColor: "Farbe",
        pdfNoDepthOffset: "Kein Tiefenversatz im Abschnitt",
        
        // Tips section (3D Preview)
        tips: "Tipps",
        previewEffectIntensity: "Vorschau-Effektintensität",
        tipsHelp1: "● Dies ist eine (sehr) grobe Vorschau davon, wie der 3D-Effekt aussehen könnte",
        tipsHelp2: "● Bewegen Sie Ihre Maus über das Bild, um die Perspektive zu ändern",
        tipsHelp3: "● Stellen Sie sicher, dass Ihre Tiefenkarte nicht leer ist",
        tipsHelp4: "● Dies funktioniert wahrscheinlich nicht gut auf weniger leistungsfähigen Geräten, da dies dynamisch generiert wird",
        tipsHelp5: "● Bedenken Sie, dass der Effekt von Browser zu Browser variiert, subtil sein kann und möglicherweise nicht zu 100% repräsentativ für das physische Kunstwerk ist",
        
        // Depth Plates section
        depthPlates: "Tiefenplatten",
        depthPlatesHelp1: "● Dies ist der Satz von Platten, der verwendet werden kann, um Tiefenanweisungen und Teilelisten zu generieren",
        depthPlatesHelp2: "● Diese Teile werden als Polsterung verwendet, damit die richtigen Pixel nach außen ragen",
        depthPlatesHelp3: "● Beachten Sie, dass größere Platten schwer von der Basis zu befestigen/entfernen sein können",
        availablePlates: "Verfügbare Platten:",
        
        // Loading status messages
        loadingProcessing: "Bild wird verarbeitet\u2026",
        loadingRendering: "Vorschau wird gerendert\u2026",
        loadingQuantizing: "Farben werden zugeordnet\u2026",
        loadingOptimizing: "Teileanzahl wird optimiert\u2026",

        // Language
        language: "Sprache",
        english: "Englisch",
        german: "Deutsch",
    }
};

// Color translations (Bricklink color names to German)
const colorTranslations = {
    de: {
        "White": "Weiß",
        "Very Light Gray": "Sehr Hellgrau",
        "Very Light Bluish Gray": "Sehr Hell Bläulichgrau",
        "Light Bluish Gray": "Hell Bläulichgrau",
        "Light Gray": "Hellgrau",
        "Dark Gray": "Dunkelgrau",
        "Dark Bluish Gray": "Dunkel Bläulichgrau",
        "Black": "Schwarz",
        "Dark Red": "Dunkelrot",
        "Red": "Rot",
        "Rust": "Rostbraun",
        "Coral": "Koralle",
        "Salmon": "Lachs",
        "Light Salmon": "Helllachs",
        "Sand Red": "Sandrot",
        "Reddish Brown": "Rotbraun",
        "Brown": "Braun",
        "Dark Brown": "Dunkelbraun",
        "Dark Tan": "Dunkel Beige",
        "Tan": "Beige",
        "Light Nougat": "Hell Nougat",
        "Nougat": "Nougat",
        "Medium Nougat": "Mittel Nougat",
        "Dark Nougat": "Dunkel Nougat",
        "Medium Brown": "Mittelbraun",
        "Fabuland Brown": "Fabuland Braun",
        "Fabuland Orange": "Fabuland Orange",
        "Earth Orange": "Erdorange",
        "Dark Orange": "Dunkelorange",
        "Neon Orange": "Neonorange",
        "Orange": "Orange",
        "Medium Orange": "Mittelorange",
        "Bright Light Orange": "Leuchtend Hellorange",
        "Light Orange": "Hellorange",
        "Very Light Orange": "Sehr Hellorange",
        "Dark Yellow": "Dunkelgelb",
        "Yellow": "Gelb",
        "Bright Light Yellow": "Leuchtend Hellgelb",
        "Light Yellow": "Hellgelb",
        "Light Lime": "Hell Limone",
        "Yellowish Green": "Gelbgrün",
        "Neon Green": "Neongrün",
        "Medium Lime": "Mittel Limone",
        "Lime": "Limone",
        "Olive Green": "Olivgrün",
        "Dark Green": "Dunkelgrün",
        "Green": "Grün",
        "Bright Green": "Leuchtend Grün",
        "Medium Green": "Mittelgrün",
        "Light Green": "Hellgrün",
        "Sand Green": "Sandgrün",
        "Dark Turquoise": "Dunkeltürkis",
        "Light Turquoise": "Helltürkis",
        "Aqua": "Aqua",
        "Light Aqua": "Hellaqua",
        "Dark Blue": "Dunkelblau",
        "Blue": "Blau",
        "Dark Azure": "Dunkel Azur",
        "Medium Azure": "Mittel Azur",
        "Medium Blue": "Mittelblau",
        "Maersk Blue": "Maersk Blau",
        "Bright Light Blue": "Leuchtend Hellblau",
        "Light Blue": "Hellblau",
        "Sky Blue": "Himmelblau",
        "Sand Blue": "Sandblau",
        "Blue-Violet": "Blauviolett",
        "Dark Blue-Violet": "Dunkel Blauviolett",
        "Violet": "Violett",
        "Medium Violet": "Mittelviolett",
        "Light Violet": "Hellviolett",
        "Dark Purple": "Dunkellila",
        "Purple": "Lila",
        "Light Purple": "Helllila",
        "Medium Lavender": "Mittel Lavendel",
        "Clikits Lavender": "Clikits Lavendel",
        "Lavender": "Lavendel",
        "Sand Purple": "Sandlila",
        "Magenta": "Magenta",
        "Dark Pink": "Dunkelrosa",
        "Medium Dark Pink": "Mittel Dunkelrosa",
        "Bright Pink": "Leuchtend Rosa",
        "Pink": "Rosa",
        "Light Pink": "Hellrosa"
    }
};

// Function to translate color names
function translateColor(colorName) {
    if (currentLanguage === 'en') {
        return colorName;
    }
    return colorTranslations[currentLanguage]?.[colorName] || colorName;
}

let currentLanguage = localStorage.getItem('language') || 'de';

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updatePageLanguage();
    updateLanguageSelector();
}

function t(key) {
    return translations[currentLanguage][key] || translations['en'][key] || key;
}

function updatePageLanguage() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            element.textContent = translations[currentLanguage][key];
        }
    });
    
    // Update all elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[currentLanguage][key]) {
            element.placeholder = translations[currentLanguage][key];
        }
    });
    
    // Update all elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (translations[currentLanguage][key]) {
            element.setAttribute('title', translations[currentLanguage][key]);
        }
    });
    
    // Update page title
    document.title = t('pageTitle');
}

function updateLanguageSelector() {
    const selector = document.getElementById('language-selector');
    if (selector) {
        selector.value = currentLanguage;
    }
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', () => {
    updatePageLanguage();
    updateLanguageSelector();
});
