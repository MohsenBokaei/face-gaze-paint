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

// Inside script.js, update the appLoop function:

// Inside script.js, update the appLoop logic for the fractal behavior:

// Inside script.js appLoop()

function appLoop() {
    if (vision && vision.webcamRunning) {
        const results = vision.detectFrame(elements.video);
        const rect = elements.paintCanvas.getBoundingClientRect();
        const point = gaze.getGazePoint(results);

        if (!calibration.isCalibrating) {
            // 1. DIFFUSION (Blur slightly)
            // This spreads the "scent" so particles can find it
            ui.paintCtx.globalAlpha = 0.9; // Slow decay
            
            // 2. DECAY (Fade slightly)
            // We draw the canvas over itself with a slight blur/offset
            ui.paintCtx.drawImage(elements.paintCanvas, 0, 0);
            
            // 3. UPDATE MYCELIUM
            // Pass the canvas context so particles can "smell" the existing lines
            painter.update(point.x, point.y, rect.width, rect.height, ui.paintCtx);
            
            // 4. DRAW
            painter.draw(ui.paintCtx);
            
            // UI Feedback
            ui.renderGazeIndicator(point.x, point.y);
        }
    }
    requestAnimationFrame(appLoop);
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
