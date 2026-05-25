import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver } = vision;

/**
 * VisionService: The hardware and AI interface.
 * Manages MediaPipe lifecycle, camera permissions, and auto-scaling.
 */
export class VisionService {
    constructor() {
        this.faceLandmarker = null;
        this.webcamRunning = false;
        this.lastVideoTime = -1;
    }

    /**
     * Initializes the MediaPipe model.
     * Logic matched to original lines 112-132.
     */
    async initialize() {
        try {
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    // IMPORTANT: Use the model that supports IRIS landmarks
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                outputFaceLandmarks: true, 
                runningMode: "VIDEO",
                numFaces: 1
            });
            return true;
        } catch (error) {
            console.error("VisionService Init Error:", error);
            throw error;
        }
    }

    /**
     * Manages camera hardware.
     * Logic matched to original lines 222-251.
     */
    async startWebcam(videoElement) {
        if (!this.faceLandmarker) return;

        const constraints = {
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = stream;
            
            return new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    // Ensure the video is explicitly set to play
                    videoElement.play(); 
                    this.webcamRunning = true;
                    resolve(true);
                };
            });
        } catch (err) {
            console.error("Webcam Access Denied:", err);
            throw err;
        }
    }

    stopWebcam(videoElement) {
        this.webcamRunning = false;
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    /**
     * Performs AI inference.
     * Logic matched to original lines 752-761.
     */
    detectFrame(videoElement) {
        if (!this.webcamRunning || videoElement.readyState < 2) return null;

        // Only run detection if the frame has actually advanced
        if (this.lastVideoTime === videoElement.currentTime) return null;
        this.lastVideoTime = videoElement.currentTime;

        const timestamp = performance.now();
        return this.faceLandmarker.detectForVideo(videoElement, timestamp);
    }

    /**
     * Matches the responsive scaling logic from original lines 737-750.
     * Ensures the video and overlay canvas are aligned.
     */
    resizeVideoElement(video, canvas) {
        const vH = video.videoHeight;
        const vW = video.videoWidth;
        
        if (vH > 0 && vW > 0) {
            const container = video.parentElement?.parentElement;
            const maxWidth = container ? container.clientWidth - 10 : vW;
            
            const displayWidth = Math.min(vW, maxWidth);
            const ratio = vH / vW;
            const displayHeight = displayWidth * ratio;

            // Set CSS visual size
            video.style.width = displayWidth + "px";
            video.style.height = displayHeight + "px";
            canvas.style.width = displayWidth + "px";
            canvas.style.height = displayHeight + "px";

            // Set internal buffer size
            canvas.width = vW;
            canvas.height = vH;
        }
    }
}
