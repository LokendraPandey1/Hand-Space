# 🤖 AI Integration: Team Roles

This document outlines the high-level responsibilities for the "Point-and-Click" AI Explanation feature.

---

## 👥 Department 1: AI Backend Lead (Vibhi)
**Mission**: "The Brain"  
**Focus**: Data IO & Intelligence.  
**Goal**: Abstract the complex Gemini API into a simple function call.  
**Primary Responsibility**: Ensure the backend service (`geminiService.js`) reliably assumes the persona of a 3D tutor and returns concise explanations.

---

## 👥 Department 2: 3D Interaction Dev (Vibhu)
**Mission**: "The Eyes"  
**Focus**: Raycasting & Scene.  
**Goal**: Translate a 2D screen click into a specific 3D Mesh Object.  
**Primary Responsibility**: Handle the math (`raycaster.js`) to detect exactly which part of the model the user is pointing at.

---

## 👥 Department 3: UI/UX Architect (Lokendra)
**Mission**: "The Face"  
**Focus**: HTML/CSS & Visuals.  
**Goal**: Beautiful "Glassmorphism" cards, Buttons, and Loading States.  
**Primary Responsibility**: Create the visual interface that users interact with, ensuring it looks modern and provides feedback (loading states, result cards).

---

## 👥 Department 4: System Orchestrator (Jagmeet)
**Mission**: "The Glue"  
**Focus**: Logic Flow & Events.  
**Goal**: Connect the Button (Dept 3) -> to the Click (Dept 2) -> to the AI (Dept 1).  
**Primary Responsibility**: Manage the application state (switching between Normal Mode and Gemini Mode) and wire the inputs to outputs in `main.js`.
