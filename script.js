import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

// Global variables
let vision, gaze, painter, ui, calibration;
let isPaintingEnabled = false;

/**
 * Main App Entry Point
 * Replaces p5.js setup()
 */
async function init() {
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

    // Initialize Services
    vision = new VisionService();
    gaze = new GazeEngine(3.0, 0.3);
    painter = new ParticleSystem(1024);
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        
        // REVEAL UI
        document.getElementById("demos").classList.remove("invisible");
        ui.resizeAll();

        // Event Bindings
        elements.webcamBtn.onclick = toggleWebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { 
            painter.clear(); 
            ui.clearPaintCanvas(); 
        };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        window.addEventListener('resize', () => ui.resizeAll());

        // Start the continuous loop (Replaces p5.js draw())
        requestAnimationFrame(appLoop);
        
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

/**
 * Main Animation Loop
 * Replaces p5.js draw()
 */
function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(document.getElementById("webcam"));

        if (calibration.isCalibrating) {
            calibration.drawCurrentDot();
            const raw = gaze.calculateRawGaze(results);
            
            if (raw) {
                calibration.currentPointSamples.push(raw);
                // 45 samples is approx 0.75 seconds of stable looking
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

            if (isPaintingEnabled) {
                // Map gaze to actual canvas pixels
                const rect = ui.elements.paintCanvas.getBoundingClientRect();
                painter.add(point.x * rect.width, point.y * rect.height);
            }
        }

        // Run Physics and Painting
        painter.update();
        painter.draw(ui.paintCtx, ui.elements.paintCanvas.width, ui.elements.paintCanvas.height);
    }

    requestAnimationFrame(appLoop);
}

async function toggleWebcam() {
    const video = document.getElementById("webcam");
    if (vision.webcamRunning) {
        vision.stopWebcam(video);
        isPaintingEnabled = false;
        document.getElementById("webcamButton").innerText = "ENABLE WEBCAM";
    } else {
        await vision.startWebcam(video);
        isPaintingEnabled = true;
        document.getElementById("webcamButton").innerText = "DISABLE WEBCAM";
        ui.resizeAll();
    }
}

function startCalibration() {
    if (!vision || !vision.webcamRunning) return;
    ui.setFeedback("Stay still and look at the dots...");
    calibration.start();
}

// Kick off the application
init();
