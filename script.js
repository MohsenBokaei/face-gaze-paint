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
    // 4.0 Sensitivity is the "Sweet Spot" for reaching corners
    gaze = new GazeEngine(4.0, 0.15); 
    // 3000 particles create a dense, silk-like flow field
    painter = new ParticleSystem(3000); 
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        document.getElementById("demos").classList.remove("invisible");

        // Wait for layout to settle then sync canvas resolutions
        setTimeout(() => { ui.resizeAll(); }, 500);
        
        // --- Event Bindings ---
        elements.webcamBtn.onclick = togglewebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { painter.clear(); ui.clearPaintCanvas(); };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        // Mouse/Touch override (acts as a manual "Magnet" for the flow field)
        const handlePointer = (e) => {
            if (e.type.startsWith('touch')) e.preventDefault();
            const rect = elements.paintCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Normalize coordinates (0-1) for the painter
            const nx = (clientX - rect.left) / rect.width;
            const ny = (clientY - rect.top) / rect.height;
            painter.update(nx, ny, rect.width, rect.height);
        };

        elements.paintCanvas.onmousedown = () => { isTouchPainting = true; };
        window.onmouseup = () => { isTouchPainting = false; };
        elements.paintCanvas.onmousemove = (e) => { if (isTouchPainting) handlePointer(e); };

        window.onresize = () => ui.resizeAll();
        
        // Kick off the core loop
        requestAnimationFrame(appLoop);
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);
        const rect = elements.paintCanvas.getBoundingClientRect();
        
        // Get the current gaze position (will use calibration if available)
        const point = gaze.getGazePoint(results);

        // --- 1. CALIBRATION MODE ---
        if (calibration.isCalibrating) {
            // ALWAYS draw the dot so the user sees it
            calibration.drawCurrentDot(); 

            const raw = gaze.calculateRawGaze(results);
            if (raw) {
                // Wait for eyes to stop moving before recording
                calibration.settleCounter++; 
                if (calibration.settleCounter > calibration.config.settleFrames) {
                    calibration.currentPointSamples.push(raw);
                }

                // If enough samples are collected for the current dot
                if (calibration.currentPointSamples.length >= calibration.config.samplesPerPoint) {
                    calibration.processPointSamples(calibration.currentPointSamples);
                    calibration.currentPointSamples = [];
                    calibration.settleCounter = 0; 
                    calibration.currentIndex++;

                    // If all 9 points are finished, solve the mapping
                    if (calibration.currentIndex >= calibration.sequence.length) {
                        const data = calibration.solve();
                        if (data) {
                            gaze.setCalibrationData(data);
                            ui.setFeedback("Calibrated Successfully!");
                        }
                    }
                }
            }
        } 
        // --- 2. PAINTING MODE ---
        else {
            ui.renderGazeIndicator(point.x, point.y);
            
            // Create "Motion Trails" by not clearing the canvas fully
            ui.paintCtx.fillStyle = 'rgba(244, 247, 246, 0.08)'; 
            ui.paintCtx.fillRect(0, 0, rect.width, rect.height);

            // If webcam is on and not touch painting, use gaze to drive the flow
            if (isPaintingEnabled && !isTouchPainting) {
                painter.update(point.x, point.y, rect.width, rect.height);
            } else {
                // If not painting, particles just drift naturally
                painter.update(-1, -1, rect.width, rect.height); 
            }
            
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
    if (!vision || !vision.webcamRunning) {
        alert("Please enable webcam first.");
        return;
    }
    ui.setFeedback("Focus on the center of the shrinking dots...");
    calibration.start();
}

init();
