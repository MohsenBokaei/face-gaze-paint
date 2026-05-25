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
     * Resizes canvases while preventing distortion and handling High-DPI.
     */
    resizeAll() {
        const video = this.elements.video;
        const outCanvas = this.elements.outputCanvas;

        // 1. Face Mesh Canvas: Must match internal video resolution
        if (video.videoWidth > 0) {
            outCanvas.width = video.videoWidth;
            outCanvas.height = video.videoHeight;
        }

        // 2. DPI-Scaled Resizing for Gaze and Paint
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
        // Use internal width/height to match MediaPipe 0-1 range
        this.canvasCtx.clearRect(0, 0, this.elements.outputCanvas.width, this.elements.outputCanvas.height);
        
        const dm = this.drawingUtils;
        const FL = FaceLandmarker;

        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030", lineWidth: 2});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30", lineWidth: 2});
    }

    renderGazeIndicator(x, y) {
        const rect = this.elements.gazeCanvas.getBoundingClientRect();
        this.gazeCtx.clearRect(0, 0, rect.width, rect.height);
        
        this.gazeCtx.strokeStyle = "#ccc";
        this.gazeCtx.lineWidth = 1;
        this.gazeCtx.beginPath();
        this.gazeCtx.moveTo(rect.width/2, 0); this.gazeCtx.lineTo(rect.width/2, rect.height);
        this.gazeCtx.moveTo(0, rect.height/2); this.gazeCtx.lineTo(rect.width, rect.height/2);
        this.gazeCtx.stroke();

        this.gazeCtx.fillStyle = "red";
        this.gazeCtx.beginPath();
        this.gazeCtx.arc(x * rect.width, y * rect.height, 6, 0, Math.PI * 2);
        this.gazeCtx.fill();
    }

    updateBlendshapesList(blendshapes) {
        if (!blendshapes?.[0]?.categories) return;
        const important = ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight"];
        
        this.elements.blendShapesList.innerHTML = blendshapes[0].categories
            .filter(s => important.includes(s.categoryName))
            .map(s => `
                <li class="blend-shapes-item">
                    <span class="blend-shapes-label">${s.categoryName}</span>
                    <div style="flex-grow:1; margin: 0 10px; background:#eee; height:6px; border-radius:3px;">
                        <div class="blend-shapes-value" style="width:${s.score * 100}%"></div>
                    </div>
                    <span>${s.score.toFixed(2)}</span>
                </li>`).join("");
    }

    setFeedback(text) { this.elements.feedback.textContent = text; }
    toggleFullscreen(el) { if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen(); }
    clearPaintCanvas() { 
        const rect = this.elements.paintCanvas.getBoundingClientRect();
        this.paintCtx.clearRect(0, 0, rect.width, rect.height); 
    }
}
