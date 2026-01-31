import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../config.js";

/**
 * Service to handle all interactions with Google Gemini API.
 */
export class GeminiService {
    constructor() {
        if (!GEMINI_API_KEY) {
            console.warn("Gemini Service: No API Key found in config.");
        }
        this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "YOUR_API_KEY");
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    /**
     * Generates a 3D context-aware explanation for a specific part.
     * @param {string} meshName - The name of the clicked part (e.g., 'Right_Atrium')
     * @param {string} parentModelName - Context of the full model (e.g., 'Human Heart')
     * @returns {Promise<string>} The explanation text.
     */
    async explainMesh(meshName, parentModelName) {
        console.log(`🤖 Gemini thinking about: ${meshName} in ${parentModelName}...`);

        const prompt = `
            You are an expert 3D Tutor. 
            The user is looking at a 3D model of: ${parentModelName}.
            The user just clicked on a specific sub-part named: "${meshName}".
            
            Task:
            1. Identify what this part likely represents based on the name.
            2. Explain its function concisely (max 2 sentences).
            3. Use a friendly, educational tone.
            
            If the part name is generic (e.g. "Mesh_05"), ask the user to select a more specific part.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("❌ Gemini API Error:", error);
            return "I'm having trouble connecting to the brain base right now. Please check your API Key.";
        }
    }
}
