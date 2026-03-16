# HandSpace 🖐️🌐

**HandSpace** is an interactive web-based prototype for exploring 3D models with real-time **hand tracking** and a simple browser UI. Built with **Three.js** and **MediaPipe Hands**, it demonstrates a lightweight, browser-native approach to spatial interaction without requiring specialized hardware like VR/AR headsets.

## 💡 Why HandSpace?

HandSpace makes interactive 3D learning accessible, affordable, and easy to use. It runs in a web browser using a webcam so students and educators can explore spatial concepts without specialized hardware.
**Key motivations:**

Many classroom concepts are easier to understand when they are shown in 3D ather than explained using flat images, yet they are often taught using static diagrams. During our time as students, we observed how difficult it was for many learners to fully grasp spatial concepts when they were presented from only a single viewpoint.

**How it helps in the classroom:**

- Interactive models let students rotate, zoom, and inspect objects for deeper insight.
- Real-time hand tracking provides an intuitive, low-friction interaction method.
- Designed for educators: simple setup and clear demonstrations that enhance teaching and learning outcomes.

By focusing on education, HandSpace aims to support clearer classroom demonstrations and make interactive 3D tools part of everyday learning environments.



## ✨ Features

-   **Real-Time Hand Tracking**: Uses Google MediaPipe to track 21 hand landmarks directly in the browser.
-   **Green Band Filter**: Tracks **only the hand** with a visible green ring/band on any finger (with a short lock-on grace period).
-   **3D Model Support**: Load and visualize GLTF/GLB models.
-   **Modular Architecture**: Clean, vanilla JavaScript structure separated into Scenes, Models, and Interaction logic.
-   **Zero Backend**: Runs entirely client-side (requires a static file server).

## 🚀 Getting Started

### Prerequisites
-   A modern web browser (Chrome, Edge, Firefox) with WebGL support.
-   A webcam.
-   A local static file server (e.g., VS Code Live Server, Python `http.server`, Node `http-server`).
-   **Node.js (recommended)** for installing local dependencies (Three.js + MediaPipe + TFJS).

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/HandSpace.git
    cd HandSpace
    ```
2.  **Run Locally**:
    -   **Windows (Automated)**: Double-click `run.bat`.
    -   **VS Code**: Right-click `index.html` -> "Open with Live Server".
    -   **Python**:
        ```bash
        python -m http.server 8000
        ```
    -   **Node**:
        ```bash
        npm install
        npx http-server .
        ```

3.  **Open in Browser**:
    -   Navigate to `http://localhost:8000`.
    -   Allow camera access when prompted.

## 🎮 Controls

## 🎥 Demo

▶️ **Video Demo**:https://www.youtube.com/watch?v=WLLimAwa0aY

### Mouse/Keyboard
-   **Left Drag**: Rotate Camera (Orbit).
-   **Right Drag**: Pan Camera.
-   **Scroll**: Zoom Camera.
-   **UI Buttons**: Use on-screen buttons to Reset view or change Scale manually.

## 📂 Project Structure

```
HandSpace/
├── index.html          # Entry point
├── style.css           # Global styles
├── models/             # 3D assets (.glb files)
└── src/
    ├── main.js         # App entry point
    ├── scene/          # Three.js setup (Scene, Camera, Lights, Plane)
    ├── models/         # GLTF Loader & Model Manager
    ├── hand/           # MediaPipe setup & Green band filtering
    ├── interaction/    # Object selection / click interactions
    └── ui/             # UI controls & overlay logic
```

## � Technical Architecture

For a detailed technical overview including system architecture diagrams, data flow, state machines, and module breakdowns, see:

📐 **[TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)**

This document includes:
- System architecture diagram
- Data flow sequence diagram
- Module-by-module breakdown
- Performance considerations


**🚀 Future Enhancements**

🤖 AI-Powered Tutor (Primary Focus)

In a future version, HandSpace will integrate the Gemini API to introduce an AI-powered tutor that can explain and guide users through the 3D models displayed on screen.

The AI tutor will be able to:

Explain what the object is and its real-world significance

Describe different parts and internal structures of the model

Answer student questions in natural language

Adapt explanations based on education level (school, high school, beginner)

Support interactive learning, allowing students to rotate, zoom, and explore models while asking questions

This enhancement transforms HandSpace from a simple visualization tool into an interactive educational assistant, combining spatial interaction with conversational AI to improve understanding and engagement.

**🔧 Other Planned Improvements**

Alongside the AI tutor, future versions of HandSpace may include:

Built-in educational 3D model library (anatomy, geometry, Earth, molecules)

Annotation and labeling tools for live explanations

Voice-based interaction combined with hand tracking

Accessibility enhancements for diverse learners

## �🛠️ Built With

-   [Three.js](https://threejs.org/) - 3D Library
-   [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) - Hand Tracking
-   Vanilla HTML5/CSS/JS

