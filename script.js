import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

// Global variables
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
        feedback: document.getElementById("calibration-feedback"),
        webcamBtn: document.getElementById("webcamButton"),
        calibrateBtn: document.getElementById("calibrate-button"),
        fullscreenBtn: document.getElementById("fullscreen-button"),
        clearBtn: document.getElementById("clear-paint-button"),
        blendShapesList: document.getElementById("video-blend-shapes") 
    };

    vision = new VisionService();
    // High sensitivity for better edge reach
    gaze = new GazeEngine(4.0, 0.15); 
    // Increased particle capacity for the "Flow-Field" effect
    painter = new ParticleSystem(3000); 
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        document.getElementById("demos").classList.remove("invisible");

        setTimeout(() => {
            ui.resizeAll();
        }, 500);
        
        // --- Event Bindings ---
        elements.webcamBtn.onclick = togglewebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { painter.clear(); ui.clearPaintCanvas(); };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        // Fallback Mouse/Touch logic
        const handlePointer = (e) => {
            if (e.type.startsWith('touch')) e.preventDefault();
            const rect = elements.paintCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            // In Flow-Field mode, we treat the mouse as a temporary gaze source
            painter.update((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height, rect.width, rect.height);
        };

        elements.paintCanvas.onmousedown = () => { isTouchPainting = true; };
        window.onmouseup = () => { isTouchPainting = false; };
        
        window.onresize = () => ui.resizeAll();
        
        requestAnimationFrame(appLoop);
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

// src/script.js

function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);
        const rect = elements.paintCanvas.getBoundingClientRect();

        // Check for results before doing gaze math
        const point = gaze.getGazePoint(results);

        if (calibration.isCalibrating) {
            // This must run even if results are null so the dot stays visible
            calibration.drawCurrentDot(); 

            // Only sample if the AI actually sees a face
            const raw = gaze.calculateRawGaze(results);
            if (raw) {
                calibration.settleCounter++; 
                if (calibration.settleCounter > calibration.config.settleFrames) {
                    calibration.currentPointSamples.push(raw);
                }

                if (calibration.currentPointSamples.length >= calibration.config.samplesPerPoint) {
                    calibration.processPointSamples(calibration.currentPointSamples);
                    calibration.currentPointSamples = [];
                    calibration.settleCounter = 0; 
                    calibration.currentIndex++;

                    if (calibration.currentIndex >= calibration.sequence.length) {
                        const data = calibration.solve();
                        if (data) {
                            gaze.setCalibrationData(data);
                            ui.setFeedback("Calibration Complete!");
                        }
                    }
                }
            }
        } else {
            // Painting Logic (Unchanged)
            ui.renderGazeIndicator(point.x, point.y);
            ui.paintCtx.fillStyle = 'rgba(244, 247, 246, 0.08)'; 
            ui.paintCtx.fillRect(0, 0, rect.width, rect.height);
            painter.update(point.x, point.y, rect.width, rect.height);
            painter.draw(ui.paintCtx);

            if (results?.faceLandmarks) {
                ui.drawFaceLandmarks(results.faceLandmarks[0]);
            }
        }
    }
    requestAnimationFrame(appLoop);
}

async function togglewebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.innerText = "ENABLE WEBCAM";
    } else {
        try {
            await vision.startWebcam(elements.video);
            elements.video.play();
            const checkDimensions = setInterval(() => {
                if (elements.video.videoWidth > 0) {
                    ui.resizeAll();
                    isPaintingEnabled = true;
                    elements.webcamBtn.innerText = "DISABLE WEBCAM";
                    clearInterval(checkDimensions);
                }
            }, 100);
        } catch (e) {
            console.error("Webcam Error:", e);
            alert("Could not access camera.");
        }
    }
}

function startCalibration() {
    if (!vision || !vision.webcamRunning) return;
    ui.setFeedback("Focus on the center of the shrinking dots...");
    calibration.start();
}

init();
