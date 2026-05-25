import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { DrawingUtils, FaceLandmarker } = vision;

export class UIManager {
    constructor(elements) {
        this.elements = elements; 
        this.canvasCtx = elements.outputCanvas.getContext("2d");
        this.gazeCtx = elements.gazeCanvas.getContext("2d");
        this.paintCtx = elements.paintCanvas.getContext("2d");
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
    }

    /**
     * CRITICAL FIX: Match canvas buffer to the actual Video Stream resolution
     */
    resizeAll() {
        const video = this.elements.video;
        const outCanvas = this.elements.outputCanvas;

        // Sync Face Mesh Canvas to Video Stream Pixels
        if (video.videoWidth > 0) {
            // 1. Match internal buffer to actual webcam hardware resolution
            outCanvas.width = video.videoWidth;
            outCanvas.height = video.videoHeight;
            
            // 2. Force the canvas display size to match the video display size exactly
            outCanvas.style.width = video.clientWidth + "px";
            outCanvas.style.height = video.clientHeight + "px";
            
            console.log(`UI Synced: ${video.videoWidth}x${video.videoHeight}`);
        }

        // Standard resizing for Gaze and Paint canvases (using DPI scaling)
        const dpr = window.devicePixelRatio || 1;
        [this.elements.paintCanvas, this.elements.gazeCanvas].forEach(c => {
            const rect = c.getBoundingClientRect();
            if (rect.width > 0) {
                c.width = rect.width * dpr;
                c.height = rect.height * dpr;
                c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        });
    }

    drawFaceLandmarks(landmarks) {
        if (!landmarks) return;
        // Clear based on internal buffer width/height
        this.canvasCtx.clearRect(0, 0, this.elements.outputCanvas.width, this.elements.outputCanvas.height);
        
        const dm = this.drawingUtils;
        const FL = FaceLandmarker;

        // DrawingUtils automatically maps MediaPipe's 0-1 coordinates 
        // to the Canvas width/height we set in resizeAll()
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030"});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30"});
    }

    renderGazeIndicator(x, y) {
        const rect = this.elements.gazeCanvas.getBoundingClientRect();
        this.gazeCtx.clearRect(0, 0, rect.width, rect.height);
        this.gazeCtx.strokeStyle = "#aaaaaa";
        this.gazeCtx.lineWidth = 1;
        this.gazeCtx.beginPath();
        this.gazeCtx.moveTo(rect.width / 2, 0); this.gazeCtx.lineTo(rect.width / 2, rect.height);
        this.gazeCtx.moveTo(0, rect.height / 2); this.gazeCtx.lineTo(rect.width, rect.height / 2);
        this.gazeCtx.stroke();
        this.gazeCtx.fillStyle = "#FF3030";
        this.gazeCtx.beginPath();
        this.gazeCtx.arc(x * rect.width, y * rect.height, 8, 0, Math.PI * 2);
        this.gazeCtx.fill();
    }

    updateBlendshapesList(blendshapes) {
        if (!blendshapes?.[0]?.categories) return;
        this.elements.blendShapesList.innerHTML = blendshapes[0].categories.map(s => {
            const score = s.score || 0;
            return `<li class="blend-shapes-item">
                <span class="blend-shapes-label">${s.displayName || s.categoryName}</span>
                <span class="blend-shapes-value" style="width:${score * 100}%">${score.toFixed(4)}</span>
            </li>`;
        }).join("");
    }

    setFeedback(text) { this.elements.feedback.textContent = text; }
    toggleFullscreen(el) { if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen(); }
    clearPaintCanvas() { 
        const rect = this.elements.paintCanvas.getBoundingClientRect();
        this.paintCtx.clearRect(0, 0, rect.width, rect.height); 
    }
}
