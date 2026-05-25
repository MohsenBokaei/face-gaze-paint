import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

// 1. Setup DOM Elements
const elements = {
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

// 2. Instantiate Classes
const vision = new VisionService();
const gaze = new GazeEngine(3.0, 0.3); // Sensitivity, Smoothing
const painter = new ParticleSystem(1024);
const ui = new UIManager(elements);
const calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

let isPaintingEnabled = false;

// 3. Initialization
async function init() {
    try {
        await vision.initialize();
        document.getElementById("demos").classList.remove("invisible");
        ui.resizeAll();
        
        // Event Listeners
        elements.webcamBtn.onclick = toggleWebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { painter.clear(); ui.clearPaintCanvas(); };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);
        window.onresize = () => ui.resizeAll();

        // Start Loop
        requestAnimationFrame(appLoop);
    } catch (err) {
        console.error("Critical Init Error:", err);
    }
}

// 4. Main Loop
function appLoop() {
    const results = vision.detectFrame(elements.video);

    if (calibration.isCalibrating) {
        calibration.drawCurrentDot();
        const raw = gaze.calculateRawGaze(results);
        
        if (raw && results) {
            calibration.currentPointSamples.push(raw);
            // Sample for 1.5 seconds (Approx 90 frames)
            if (calibration.currentPointSamples.length >= 60) { 
                calibration.processPointSamples(calibration.currentPointSamples);
                calibration.currentPointSamples = [];
                calibration.currentIndex++;

                if (calibration.currentIndex >= calibration.sequence.length) {
                    const data = calibration.solve();
                    gaze.setCalibrationData(data);
                    ui.setFeedback("Calibrated Successfully!");
                }
            }
        }
    } else {
        const point = gaze.getGazePoint(results);
        ui.renderGazeIndicator(point.x, point.y);
        
        if (results?.faceLandmarks) ui.drawFaceLandmarks(results.faceLandmarks[0]);
        if (results?.faceBlendshapes) ui.updateBlendshapesList(results.faceBlendshapes);

        if (isPaintingEnabled && vision.webcamRunning) {
            const rect = elements.paintCanvas.getBoundingClientRect();
            painter.add(point.x * rect.width, point.y * rect.height);
        }
    }

    painter.update();
    painter.draw(ui.paintCtx, elements.paintCanvas.width, elements.paintCanvas.height);
    
    requestAnimationFrame(appLoop);
}

async function toggleWebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.innerText = "ENABLE WEBCAM";
    } else {
        await vision.startWebcam(elements.video);
        isPaintingEnabled = true;
        elements.webcamBtn.innerText = "DISABLE WEBCAM";
        ui.resizeAll();
    }
}

function startCalibration() {
    if (!vision.webcamRunning) return;
    ui.setFeedback("Stay still and follow the dots...");
    calibration.start();
}

init();