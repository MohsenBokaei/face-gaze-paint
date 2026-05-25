import { VisionService } from './src/VisionService.js';
import { GazeEngine } from './src/GazeEngine.js';
import { ParticleSystem } from './src/ParticleSystem.js';
import { CalibrationManager } from './src/CalibrationManager.js';
import { UIManager } from './src/UIManager.js';
// Note: MathUtils is usually imported inside the files above, not here.

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

        setTimeout(() => {
            ui.resizeAll();
        }, 500);
        
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
        const point = gaze.getGazePoint(results);
        const rect = elements.paintCanvas.getBoundingClientRect();

        // 1. Update the UI Indicator
        ui.renderGazeIndicator(point.x, point.y);

        // 2. Clear the canvas slightly to create "trails" 
        // (This makes the silk look like it's moving)
        ui.paintCtx.fillStyle = 'rgba(244, 247, 246, 0.1)'; // Matches body background
        ui.paintCtx.fillRect(0, 0, rect.width, rect.height);

        // 3. Update the whole field based on gaze
        painter.update(point.x, point.y, rect.width, rect.height);
        
        // 4. Draw the field
        painter.draw(ui.paintCtx);

        if (results?.faceLandmarks) {
            ui.drawFaceLandmarks(results.faceLandmarks[0]);
        }
    }
    requestAnimationFrame(appLoop);
}

async function togglewebcam() {
    if (vision.webcamRunning) {
        vision.stopWebcam(elements.video);
        isPaintingEnabled = false;
        elements.webcamBtn.innerText = "ENABLE WEBCAM"; // Corrected
    } else {
        try {
            await vision.startWebcam(elements.video);
            
            elements.video.play();
            
            const checkDimensions = setInterval(() => {
                if (elements.video.videoWidth > 0) {
                    ui.resizeAll();
                    isPaintingEnabled = true;
                    elements.webcamBtn.innerText = "DISABLE WEBCAM"; // Corrected
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
    ui.setFeedback("Follow the dots...");
    calibration.start();
}

init();
