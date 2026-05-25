import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { DrawingUtils, FaceLandmarker } = vision;

/**
 * UIManager: Manages all canvas rendering, responsive scaling, and UI feedback.
 */
export class UIManager {
    constructor(elements) {
        this.elements = elements; 
        
        // Setup Contexts
        this.canvasCtx = elements.outputCanvas.getContext("2d");
        this.gazeCtx = elements.gazeCanvas.getContext("2d");
        this.paintCtx = elements.paintCanvas.getContext("2d");
        
        // MediaPipe Drawing Utils
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
    }

    /**
     * Synchronizes canvas resolutions with the layout.
     * Fixes distortion by matching internal buffers to display sizes.
     */
    resizeAll() {
        const video = this.elements.video;
        const outCanvas = this.elements.outputCanvas;

        // 1. Face Mesh Canvas: Must match raw webcam pixels for AI alignment
        if (video.videoWidth > 0) {
            outCanvas.width = video.videoWidth;
            outCanvas.height = video.videoHeight;
            // CSS handles the absolute positioning and 100% stretch
        }

        // 2. High-DPI Scaling for Gaze and Paint canvases
        const dpr = window.devicePixelRatio || 1;
        
        [this.elements.paintCanvas, this.elements.gazeCanvas].forEach(c => {
            const rect = c.getBoundingClientRect();
            // Only resize if the element is visible on screen
            if (rect.width > 0) {
                const ctx = c.getContext("2d");
                c.width = rect.width * dpr;
                c.height = rect.height * dpr;
                // Normalize the coordinate system so 1 unit = 1 CSS pixel
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        });
        
        console.log(`Resolution Synced: Webcam ${video.videoWidth}x${video.videoHeight}`);
    }

    /**
     * Draws the Face Mesh.
     * Landmarks are normalized (0.0 - 1.0), so they map to internal buffer width/height.
     */
    drawFaceLandmarks(landmarks) {
        if (!landmarks) return;
        
        const canvas = this.elements.outputCanvas;
        this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        const dm = this.drawingUtils;
        const FL = FaceLandmarker;

        // Draw with specific colors
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030", lineWidth: 2});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30", lineWidth: 2});
    }

    /**
     * Draws the red gaze dot in the sidebar indicator.
     */
    renderGazeIndicator(x, y) {
        const ctx = this.gazeCtx;
        const rect = this.elements.gazeCanvas.getBoundingClientRect();

        // Clear using logical pixels (because of setTransform)
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Draw crosshair
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rect.width / 2, 0); ctx.lineTo(rect.width / 2, rect.height);
        ctx.moveTo(0, rect.height / 2); ctx.lineTo(rect.width, rect.height / 2);
        ctx.stroke();

        // Draw red gaze dot
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(x * rect.width, y * rect.height, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Optional: Safe method for updating expressions if you re-add them later.
     */
    updateBlendshapesList(blendshapes) {
        if (!this.elements.blendShapesList || !blendshapes?.[0]?.categories) return;

        const important = ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight"];
        
        this.elements.blendShapesList.innerHTML = blendshapes[0].categories
            .filter(s => important.includes(s.categoryName))
            .map(s => `
                <li class="blend-shapes-item">
                    <span class="blend-shapes-label">${s.categoryName}</span>
                    <div style="flex-grow:1; margin: 0 10px; background:#eee; height:6px; border-radius:3px;">
                        <div style="width:${s.score * 100}%; background:#6200ee; height:100%; border-radius:3px;"></div>
                    </div>
                    <span>${s.score.toFixed(2)}</span>
                </li>`).join("");
    }

    setFeedback(text) { 
        this.elements.feedback.textContent = text; 
    }

    toggleFullscreen(el) { 
        if (!document.fullscreenElement) {
            el.requestFullscreen().catch(e => console.error(e));
        } else {
            document.exitFullscreen();
        }
    }

    clearPaintCanvas() { 
        const rect = this.elements.paintCanvas.getBoundingClientRect();
        this.paintCtx.clearRect(0, 0, rect.width, rect.height); 
    }
}
