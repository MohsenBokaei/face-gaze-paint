import { VisionService } from './VisionService.js';
import { GazeEngine } from './GazeEngine.js';
import { ParticleSystem } from './ParticleSystem.js';
import { CalibrationManager } from './CalibrationManager.js';
import { UIManager } from './UIManager.js';

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
    gaze = new GazeEngine(3.0, 0.3); 
    painter = new ParticleSystem(1024);
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        document.getElementById("demos").classList.remove("invisible");
        
        // --- Event Bindings ---
        elements.webcamBtn.onclick = togglewebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => { painter.clear(); ui.clearPaintCanvas(); };
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        // --- Touch & Mouse Painting Logic ---
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
        elements.paintCanvas.addEventListener('touchstart', (e) => { isTouchPainting = true; handlePointer(e); }, {passive: false});
        elements.paintCanvas.addEventListener('touchend', () => { isTouchPainting = false; });
        elements.paintCanvas.addEventListener('touchmove', (e) => { if (isTouchPainting) handlePointer(e); }, {passive: false});

        window.onresize = () => ui.resizeAll();
        
        // Start the loop
        requestAnimationFrame(appLoop);
    } catch (err) {
        console.error("Initialization failed:", err);
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
                if (calibration.currentPointSamples.length >= 60) { 
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
            
            if (results?.faceLandmarks) {
                ui.drawFaceLandmarks(results.faceLandmarks[0]);
            }

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
        try {
            await vision.startWebcam(elements.video);
            
            // Critical for Chrome: ensure the video is actually playing
            elements.video.play();
            
            // Check for dimensions every 100ms until they are ready
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
            alert("Camera access failed. Ensure you are on HTTPS and allowed permissions.");
        }
    }
}
function startCalibration() {
    if (!vision || !vision.webcamRunning) return;
    ui.setFeedback("Follow the dots...");
    calibration.start();
}

init();
