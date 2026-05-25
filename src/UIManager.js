import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { DrawingUtils, FaceLandmarker } = vision;

/**
 * UIManager: The "Stage Manager".
 * Handles all visual rendering (Face Mesh, Gaze, Blendshapes) and DOM scaling.
 */
export class UIManager {
    constructor(elements) {
        this.elements = elements; 
        
        // Contexts
        this.canvasCtx = elements.outputCanvas.getContext("2d");
        this.gazeCtx = elements.gazeCanvas.getContext("2d");
        this.paintCtx = elements.paintCanvas.getContext("2d");

        // MediaPipe Drawing Helper
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
    }

    /**
     * Handles High-DPI scaling to prevent blurry canvases on modern screens.
     * Logic matched to original lines 134-150.
     */
    resizeCanvas(canvas, context) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Set internal buffer size
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Scale context so drawing commands use CSS pixel units
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Re-apply standard painting styles (Original lines 145-148)
        if (canvas === this.elements.paintCanvas) {
            context.strokeStyle = "#005c99"; 
            context.lineWidth = 3;
            context.lineCap = "round"; 
            context.lineJoin = "round";
        }
    }

    /**
     * Resizes every canvas in the app.
     */
    resizeAll() {
        this.resizeCanvas(this.elements.outputCanvas, this.canvasCtx);
        this.resizeCanvas(this.elements.paintCanvas, this.paintCtx);
        // Gaze canvas is small and fixed in original, but we scale it for safety
        this.resizeCanvas(this.elements.gazeCanvas, this.gazeCtx);
    }

    /**
     * Draws the colorful Face Mesh.
     * Logic matched to original lines 785-802.
     */
    drawFaceLandmarks(landmarks) {
        if (!landmarks) return;
        
        this.canvasCtx.clearRect(0, 0, this.elements.outputCanvas.width, this.elements.outputCanvas.height);
        
        const dm = this.drawingUtils;
        const FL = FaceLandmarker;

        // 1. Tesselation (Transparent Gray)
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
        
        // 2. Right Eye / Brow / Iris (Red)
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYEBROW, {color: "#FF3030"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_IRIS, {color: "#FF3030"});
        
        // 3. Left Eye / Brow / Iris (Green)
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYEBROW, {color: "#30FF30"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_IRIS, {color: "#30FF30"});
        
        // 4. Face Oval and Lips (White/Gray)
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_FACE_OVAL, {color: "#E0E0E0"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LIPS, {color: "#E0E0E0"});
    }

    /**
     * Draws the estimation crosshair.
     * Logic matched to original lines 253-270.
     */
    renderGazeIndicator(x, y) {
        const ctx = this.gazeCtx;
        const canvas = this.elements.gazeCanvas;
        // Use internal buffer dimensions
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        
        ctx.strokeStyle = "#aaaaaa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
        ctx.stroke();

        ctx.fillStyle = "#FF3030";
        ctx.beginPath();
        // FIXED REFERENCE HERE: was this.ctx
        ctx.arc(x * w, y * h, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Renders the Blendshapes list.
     * Logic matched to original lines 833-841.
     */
    updateBlendshapesList(blendshapes) {
        if (!blendshapes?.[0]?.categories) {
            this.elements.blendShapesList.innerHTML = "";
            return;
        }

        let html = "";
        blendshapes[0].categories.forEach((s) => {
            const score = s.score || 0;
            const sW = Math.max(0, Math.min(100, score * 100)); // Percentage width
            const label = s.displayName || s.categoryName || 'Unknown';
            
            html += `
                <li class="blend-shapes-item">
                    <span class="blend-shapes-label">${label}</span>
                    <span class="blend-shapes-value" style="width:${sW}%">${score.toFixed(4)}</span>
                </li>`;
        });
        this.elements.blendShapesList.innerHTML = html;
    }

    /**
     * Fullscreen API wrapper.
     * Logic matched to original lines 608-620.
     */
    toggleFullscreen(element) {
        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(err => {
                console.error(`Fullscreen error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Feedback helper for calibration.
     */
    setFeedback(text) {
        this.elements.feedback.textContent = text;
    }

    clearPaintCanvas() {
        this.paintCtx.clearRect(0, 0, this.elements.paintCanvas.width, this.elements.paintCanvas.height);
    }
}