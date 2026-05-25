import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { DrawingUtils, FaceLandmarker } = vision;

/**
 * UIManager: Handles all visual rendering, scaling, and DOM updates.
 */
export class UIManager {
    constructor(elements) {
        this.elements = elements; 
        
        // Canvas Contexts
        this.canvasCtx = elements.outputCanvas.getContext("2d");
        this.gazeCtx = elements.gazeCanvas.getContext("2d");
        this.paintCtx = elements.paintCanvas.getContext("2d");

        // MediaPipe Drawing Helper
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
    }

    /**
     * CRITICAL FIX: Synchronizes all canvases.
     * 1. Output Canvas matches the raw hardware pixels of the webcam.
     * 2. Paint/Gaze canvases use DPI scaling for sharpness.
     */
    resizeAll() {
        const video = this.elements.video;
        const outCanvas = this.elements.outputCanvas;

        // 1. Sync Face Mesh Canvas (Output) to Video Stream Pixels
        if (video.videoWidth > 0) {
            // Internal buffer matches hardware resolution (e.g., 640x480)
            outCanvas.width = video.videoWidth;
            outCanvas.height = video.videoHeight;
            
            // CSS display size matches how the video looks on screen
            outCanvas.style.width = video.clientWidth + "px";
            outCanvas.style.height = video.clientHeight + "px";
        }

        // 2. DPI-Scaled Resizing for Gaze and Paint canvases
        const dpr = window.devicePixelRatio || 1;
        [this.elements.paintCanvas, this.elements.gazeCanvas].forEach(c => {
            const rect = c.getBoundingClientRect();
            if (rect.width > 0) {
                const ctx = c.getContext("2d");
                c.width = rect.width * dpr;
                c.height = rect.height * dpr;
                // Scale the coordinate system so 1 unit = 1 CSS pixel
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        });
        
        console.log(`UI Synced: Hardware ${video.videoWidth}px | Display ${video.clientWidth}px`);
    }

    /**
     * Draws the colorful Face Mesh.
     */
    drawFaceLandmarks(landmarks) {
        if (!landmarks) return;
        
        // Clear using internal buffer dimensions
        this.canvasCtx.clearRect(0, 0, this.elements.outputCanvas.width, this.elements.outputCanvas.height);
        
        const dm = this.drawingUtils;
        const FL = FaceLandmarker;

        // Tesselation (Transparent White/Gray)
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_TESSELATION, {color: "#C0C0C070", lineWidth: 1});
        
        // Eyes (Red for Right, Green for Left as per original logic)
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030", lineWidth: 2});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_RIGHT_IRIS, {color: "#FF3030", lineWidth: 2});
        
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30", lineWidth: 2});
        dm.drawConnectors(landmarks, FL.FACE_LANDMARKS_LEFT_IRIS, {color: "#30FF30", lineWidth: 2});
    }

    /**
     * Draws the estimation crosshair + Directional Text
     */
    renderGazeIndicator(x, y) {
        const ctx = this.gazeCtx;
        const rect = this.elements.gazeCanvas.getBoundingClientRect();

        // Clear using logical CSS pixels (because of setTransform)
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // 1. Draw Directional Text (Antoine Lame Style)
        ctx.fillStyle = "#555";
        ctx.font = "bold 12px sans-serif";
        let direction = "CENTER";
        if (x < 0.38) direction = "LEFT";
        if (x > 0.62) direction = "RIGHT";
        ctx.fillText(`GAZE: ${direction}`, 10, 20);

        // 2. Draw Crosshair
        ctx.strokeStyle = "#aaaaaa";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rect.width / 2, 0); ctx.lineTo(rect.width / 2, rect.height);
        ctx.moveTo(0, rect.height / 2); ctx.lineTo(rect.width, rect.height / 2);
        ctx.stroke();

        // 3. Draw Prediction Point
        ctx.fillStyle = "#FF3030";
        ctx.beginPath();
        ctx.arc(x * rect.width, y * rect.height, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Updates the sidebar blendshapes list
     */
    updateBlendshapesList(blendshapes) {
        if (!blendshapes?.[0]?.categories) return;
        
        // Filter to show most relevant shapes
        const important = ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight"];
        
        this.elements.blendShapesList.innerHTML = blendshapes[0].categories
            .filter(s => important.includes(s.categoryName))
            .map(s => {
                const score = s.score || 0;
                return `
                    <li class="blend-shapes-item">
                        <span class="blend-shapes-label">${s.categoryName}</span>
                        <div class="blend-shapes-value" style="width:${score * 100}%; height: 8px; background: #6200ee; border-radius: 4px;"></div>
                        <span style="font-size: 10px;">${score.toFixed(2)}</span>
                    </li>`;
            }).join("");
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
        // Clear logical pixels
        this.paintCtx.clearRect(0, 0, rect.width, rect.height); 
    }
}
