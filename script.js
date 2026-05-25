import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

// Global instances
let vision, gaze, painter, ui, calibration;
let elements;
let isPaintingEnabled = false;
let isTouchPainting = false;

async function init() {
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

    vision = new VisionService();
    gaze = new GazeEngine(3.0, 0.3); 
    painter = new ParticleSystem(1024);
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        document.getElementById("demos").classList.remove("invisible");
        ui.resizeAll();

        // Event Bindings
        elements.webcamBtn.onclick = togglewebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { painter.clear(); ui.clearPaintCanvas(); };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        window.onresize = () => ui.resizeAll();
        requestAnimationFrame(appLoop);
    } catch (err) {
        console.error("Init failed:", err);
    }
}

function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);

        if (calibration.isCalibrating) {
            calibration.drawCurrentDot();
            const raw = gaze.calculateRawGaze(results);
            if (raw) {
                calibration.currentPointSamples.push(raw);
                if (calibration.currentPointSamples.length >= 50) { 
                    calibration.processPointSamples(calibration.currentPointSamples);
                    calibration.currentPointSamples = [];
                    calibration.currentIndex++;
                    if (calibration.currentIndex >= calibration.sequence.length) {
                        const data = calibration.solve();
                        gaze.setCalibrationData(data);
                        ui.setFeedback("Calibrated!");
                    }
                }
            }
        } else {
            const point = gaze.getGazePoint(results);
            ui.renderGazeIndicator(point.x, point.y);
            if (results?.faceLandmarks) ui.drawFaceLandmarks(results.faceLandmarks[0]);
            

            if (isPaintingEnabled && !isTouchPainting) {
                const rect = elements.paintCanvas.getBoundingClientRect();
                painter.add(point.x * rect.width, point.y * rect.height);
            }
        }

        painter.update();
        const rect = elements.paintCanvas.getBoundingClientRect();
        painter.draw(ui.paintCtx, rect.width, rect.height);
    }
    requestAnimationFrame(appLoop);
}

async function togglewebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.innerText = "ENABLE WEBCAM";
    } else {
        await vision.startWebcam(elements.video);
        elements.video.onloadedmetadata = () => {
            setTimeout(() => {
                ui.resizeAll();
                isPaintingEnabled = true;
                elements.webcamBtn.innerText = "DISABLE WEBCAM";
            }, 200);
        };
    }
}

function startCalibration() {
    if (!vision.webcamRunning) return;
    calibration.start();
}

init();
