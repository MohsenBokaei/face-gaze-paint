import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { DrawingUtils, FaceLandmarker } = vision;

/**
 * UIManager: The "Stage Manager".
 * Handles all visual rendering and High-DPI canvas scaling.
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
     * Handles High-DPI scaling (Retina support).
     * Matches original lines 134-150.
     */
    resizeCanvas(canvas, context) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Buffer size (Internal resolution)
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Logical size (Scaling the drawing context)
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Re-apply standard painting styles
        if (canvas === this.elements.paintCanvas) {
            context.strokeStyle = "#005c99"; 
            context.lineWidth = 3;
            context.lineCap = "round"; 
            context.lineJoin = "round";
        }
    }

    resizeAll() {
        this.resizeCanvas(this.elements.outputCanvas, this.canvasCtx);
        this.resizeCanvas(this.elements.paintCanvas, this.paintCtx);
        this.resizeCanvas(this.elements.gazeCanvas, this.gazeCtx);
    }

    /**
     * Draws the Face Mesh.
     * Matches original lines 785-802.
     */
    drawFaceLandmarks(landmarks) {
        if (!landmarks) return;
        
        // Clear using logical (CSS) dimensions due to setTransform
        const rect = this.elements.outputCanvas.getBoundingClientRect();
        this.canvasCtx.clearRect(0, 0, rect.width, rect.height);
        
        const dm = this.drawingUtils;
        const FL = FaceLandmarker;

        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30"});
    }

    /**
     * Draws the estimation crosshair.
     * Logic corrected for High-DPI scaled contexts.
     */
    renderGazeIndicator(x, y) {
        const ctx = this.gazeCtx;
        const rect = this.elements.gazeCanvas.getBoundingClientRect();

        // Clear the scaled context
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Draw crosshair using CSS dimensions
        ctx.strokeStyle = "#aaaaaa";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rect.width / 2, 0); ctx.lineTo(rect.width / 2, rect.height);
        ctx.moveTo(0, rect.height / 2); ctx.lineTo(rect.width, rect.height / 2);
        ctx.stroke();

        // Draw red gaze dot
        ctx.fillStyle = "#FF3030";
        ctx.beginPath();
        ctx.arc(x * rect.width, y * rect.height, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    updateBlendshapesList(blendshapes) {
        if (!blendshapes?.[0]?.categories) {
            this.elements.blendShapesList.innerHTML = "";
            return;
        }

        let html = blendshapes[0].categories.map(s => {
            const score = s.score || 0;
            const sW = Math.max(0, Math.min(100, score * 100));
            return `
                <li class="blend-shapes-item">
                    <span class="blend-shapes-label">${s.displayName || s.categoryName}</span>
                    <span class="blend-shapes-value" style="width:${sW}%">${score.toFixed(4)}</span>
                </li>`;
        }).join("");
        
        this.elements.blendShapesList.innerHTML = html;
    }

    toggleFullscreen(element) {
        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(e => console.error(e));
        } else {
            document.exitFullscreen();
        }
    }

    setFeedback(text) {
        this.elements.feedback.textContent = text;
    }

    clearPaintCanvas() {
        const rect = this.elements.paintCanvas.getBoundingClientRect();
        this.paintCtx.clearRect(0, 0, rect.width, rect.height);
    }
}
