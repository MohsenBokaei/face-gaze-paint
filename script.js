import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

// Global variables
let vision, gaze, painter, ui, calibration;
let elements; 
let isPaintingEnabled = false;

/**
 * --- EVENT HANDLERS ---
 * Defined as declarations to prevent ReferenceErrors during hoisting.
 */

async function togglewebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.querySelector('.mdc-button__label').innerText = "ENABLE WEBCAM";
    } else {
        try {
            await vision.startWebcam(elements.video);
            elements.video.play();
            
            // Wait for video metadata to be ready to sync UI
            const checkDimensions = setInterval(() => {
                if (elements.video.videoWidth > 0) {
                    ui.resizeAll();
                    isPaintingEnabled = true;
                    elements.webcamBtn.querySelector('.mdc-button__label').innerText = "DISABLE WEBCAM";
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
    if (!vision || !vision.webcamRunning) {
        alert("Please enable webcam before calibrating.");
        return;
    }
    ui.setFeedback("Focus on the center of the shrinking colonies...");
    calibration.start();
}

/**
 * --- MAIN LOOP ---
 */
function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);
        const rect = elements.paintCanvas.getBoundingClientRect();
        
        // Get the gaze point (smoothed and calibrated)
        const point = gaze.getGazePoint(results);

        // 1. CALIBRATION MODE
        if (calibration.isCalibrating) {
            calibration.drawCurrentDot(); 

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
                            ui.setFeedback("Colony DNA Synced.");
                        }
                    }
                }
            }
        } 
        // 2. MYCELIUM PAINTING MODE
        else {
            ui.renderGazeIndicator(point.x, point.y);
            
            // Logic: If painting is active, use gaze coordinates. 
            // If not, use -1 to let the colony explore naturally.
            const nx = isPaintingEnabled ? point.x : -1;
            const ny = isPaintingEnabled ? point.y : -1;

            // PHYSARUM LOGIC: 
            // Update the internal pheromone grid and move 10,000 agents
            painter.update(nx, ny, rect.width, rect.height);
            
            // DRAW: Render the current state of the colony to the canvas
            painter.draw(ui.paintCtx, rect.width, rect.height);

            // Optional: Draw face mesh overlay
            if (results?.faceLandmarks) {
                ui.drawFaceLandmarks(results.faceLandmarks[0]);
            }
        }
    }
    requestAnimationFrame(appLoop);
}

/**
 * --- INITIALIZATION ---
 */
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
        clearBtn: document.getElementById("clear-paint-button")
    };

    // Instantiate Services
    vision = new VisionService();
    gaze = new GazeEngine(4.0, 0.12); 
    painter = new ParticleSystem(10000); // Massive agent count for branching textures
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        
        // Show the UI once models are loaded
        document.getElementById("demos").classList.remove("invisible");

        // Set up event listeners
        elements.webcamBtn.onclick = togglewebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { painter.clear(); ui.clearPaintCanvas(); };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        window.onresize = () => ui.resizeAll();
        
        // Initial layout sync
        setTimeout(() => ui.resizeAll(), 500);
        
        // Start the loop
        requestAnimationFrame(appLoop);
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

// Kick off the application
init();
