import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';

let vision, gaze, painter, ui, calibration;
let elements;
let isPaintingEnabled = false;

// --- تابع مدیریت دوربین ---
async function togglewebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.innerText = "ENABLE WEBCAM";
    } else {
        try {
            await vision.startWebcam(elements.video);
            elements.video.play();
            const check = setInterval(() => {
                if (elements.video.videoWidth > 0) {
                    ui.resizeAll();
                    isPaintingEnabled = true;
                    elements.webcamBtn.innerText = "DISABLE WEBCAM";
                    clearInterval(check);
                }
            }, 100);
        } catch (e) { alert("Camera Access Error"); }
    }
}

// --- تابع کالیبراسیون ---
function startCalibration() {
    if (!vision || !vision.webcamRunning) return;
    ui.setFeedback("Focus on the center of the colonies...");
    calibration.start();
}

// --- حلقه اصلی شبیه‌سازی ---
function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);
        const rect = elements.paintCanvas.getBoundingClientRect();
        const point = gaze.getGazePoint(results);

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
                        if (data) gaze.setCalibrationData(data);
                        ui.setFeedback("Colony DNA Synced.");
                    }
                }
            }
        } else {
            ui.renderGazeIndicator(point.x, point.y);
            
            // اگر دوربین فعال باشد، مختصات نگاه ارسال می‌شود، در غیر این صورت -1
            const nx = isPaintingEnabled ? point.x : -1;
            const ny = isPaintingEnabled ? point.y : -1;

            painter.update(nx, ny, rect.width, rect.height);
            painter.draw(ui.paintCtx, rect.width, rect.height);
            
            if (results?.faceLandmarks) ui.drawFaceLandmarks(results.faceLandmarks[0]);
        }
    }
    requestAnimationFrame(appLoop);
}

// --- مقداردهی اولیه ---
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

    vision = new VisionService();
    gaze = new GazeEngine(4.0, 0.12); 
    painter = new ParticleSystem(10000); 
    ui = new UIManager(elements);
    calibration = new CalibrationManager(elements.overlayCanvas, elements.overlayCanvas.getContext("2d"));

    try {
        await vision.initialize();
        document.getElementById("demos").classList.remove("invisible");
        
        elements.webcamBtn.onclick = togglewebcam;
        elements.calibrateBtn.onclick = startCalibration;
        elements.clearBtn.onclick = () => painter.clear();
        elements.fullscreenBtn.onclick = () => ui.toggleFullscreen(elements.paintCanvas);

        window.onresize = () => ui.resizeAll();
        setTimeout(() => ui.resizeAll(), 500);
        
        requestAnimationFrame(appLoop);
    } catch (err) { console.error("Initialization failed:", err); }
}

init();
