import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

// --- 1. Global Variables (Accessible by all functions) ---
let vision, gaze, painter, ui, calibration;
let elements; // Define this here so toggleWebcam can see it
let isPaintingEnabled = false;
let isTouchPainting = false;

/**
 * Main App Entry Point
 */
async function init() {
    // Populate the elements object now that the DOM is ready
    elements = {
        video: document.getElementById("webcam"),
        outputCanvas: document.getElementById("output_canvas"),
        gazeCanvas: document.getElementById("gaze_canvas"),
        paintCanvas: document.getElementById("paint_canvas"),
        overlayCanvas: document.getElementById("calibration_fullscreen"),
        blendShapesList: document.getElementById("video-blend-shapes"),
        feedback: document.getElementById("calibration-feedback"),
        webcamBtn: document.getElementById("webcamButton"),
        calibrateBtn: document.getElementById("calibrate-button"),
        fullscreenBtn: document.getElementById("fullscreen-button"),
        clearBtn: document.getElementById("clear-paint-button")
    };

    // Initialize Services
    vision = new VisionService();
    gaze = new GazeEngine(3.0, 0.3); 
    painter = new ParticleSystem(1024);
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        
        // Reveal UI
        document.getElementById("demos").classList.remove("invisible");
        
        // --- Event Bindings ---
        elements.webcamBtn.onclick = toggleWebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { 
            painter.clear(); 
            ui.clearPaintCanvas(); 
        };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        // --- Touch & Mouse Event Handlers ---
        const handlePointer = (e) => {
            if (e.type.startsWith('touch')) e.preventDefault();
            const rect = elements.paintCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            painter.add(clientX - rect.left, clientY - rect.top);
        };

        elements.paintCanvas.onmousedown = () => { isTouchPainting = true; };
        window.onmouseup = () => { isTouchPainting = false; };
        elements.paintCanvas.onmousemove = (e) => { if (isTouchPainting) handlePointer(e); };

        elements.paintCanvas.addEventListener('touchstart', (e) => { 
            isTouchPainting = true; handlePointer(e); 
        }, {passive: false});
        elements.paintCanvas.addEventListener('touchend', () => { isTouchPainting = false; });
        elements.paintCanvas.addEventListener('touchmove', (e) => { 
            if (isTouchPainting) handlePointer(e); 
        }, {passive: false});

        window.addEventListener('resize', () => ui.resizeAll());

        // Start loop
        requestAnimationFrame(appLoop);
        
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

/**
 * Main Animation Loop
 */
function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);

        let isBlinking = false;
        if (results?.faceBlendshapes?.[0]) {
            const categories = results.faceBlendshapes[0].categories;
            const blinkL = categories.find(c => c.categoryName === "eyeBlinkLeft")?.score || 0;
            const blinkR = categories.find(c => c.categoryName === "eyeBlinkRight")?.score || 0;
            if (blinkL > 0.45 && blinkR > 0.45) isBlinking = true;
        }

        if (calibration.isCalibrating) {
            calibration.drawCurrentDot();
            const raw = gaze.calculateRawGaze(results);
            if (raw) {
                calibration.currentPointSamples.push(raw);
                if (calibration.currentPointSamples.length >= 45) { 
                    calibration.processPointSamples(calibration.currentPointSamples);
                    calibration.currentPointSamples = [];
                    calibration.currentIndex++;
                    if (calibration.currentIndex >= calibration.sequence.length) {
                        const result = calibration.solve();
                        gaze.setCalibrationData(result);
                        ui.setFeedback(`Calibrated!`);
                    }
                }
            }
        } else {
            const point = gaze.getGazePoint(results);
            ui.renderGazeIndicator(point.x, point.y);
            if (results?.faceLandmarks) ui.drawFaceLandmarks(results.faceLandmarks[0]);
            if (results?.faceBlendshapes) ui.updateBlendshapesList(results.faceBlendshapes);

            if (isPaintingEnabled && !isBlinking && !isTouchPainting) {
                const rect = elements.paintCanvas.getBoundingClientRect();
                painter.add(point.x * rect.width, point.y * rect.height);
                ui.setFeedback("");
            } else if (isBlinking && isPaintingEnabled) {
                ui.setFeedback("Paused (Blink Detected)");
            }
        }

        painter.update();
        const rect = elements.paintCanvas.getBoundingClientRect();
        painter.draw(ui.paintCtx, rect.width, rect.height);
    }
    requestAnimationFrame(appLoop);
}

async function toggleWebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.innerText = "ENABLE WEBCAM";
        ui.setFeedback("Webcam Disabled");
    } else {
        await vision.startWebcam(elements.video);
        elements.video.onloadedmetadata = () => {
            setTimeout(() => {
                ui.resizeAll();
                isPaintingEnabled = true;
                elements.webcamBtn.innerText = "DISABLE WEBCAM";
                ui.setFeedback("");
            }, 100);
        };
    }
}

function startCalibration() {
    if (!vision || !vision.webcamRunning) return;
    ui.setFeedback("Follow the red dots...");
    calibration.start();
}

init();
