import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Service to handle all interactions with Google Gemini API.
 */
export class GeminiService {
    constructor() {
        this.genAI = null;
        this.apiKey = null;
        this.initPromise = this.init();
    }

    async init() {
        try {
            const res = await fetch('http://localhost:5000/api/config');
            const config = await res.json();
            this.apiKey = config.GEMINI_API_KEY;

            if (!this.apiKey) {
                console.warn("Gemini Service: No API Key found in config.");
            } else {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
            }
        } catch (err) {
            console.error("Failed to fetch config:", err);
        }
    }

    async ensureReady() {
        await this.initPromise;
    }

    /**
     * Generates a 3D context-aware explanation for a specific part.
     * @param {string} meshName - The name of the clicked part
     * @param {string} parentModelName - Context of the full model
     * @param {string} [imageBase64] - Optional base64 screenshot of the current view
     * @returns {Promise<string>} The explanation text.
     */
    async explainMesh(meshName, parentModelName, imageBase64 = null, language = 'English') {
        await this.ensureReady();

        if (!this.genAI) {
            return "⚠️ **API Key Not Configured**.<br>Please add GEMINI_API_KEY to your .env file.";
        }

        console.log(`🤖 Gemini thinking about: ${meshName} in ${parentModelName}...`);

        const prompt = `
            You are an expert 3D Tutor.
            The user is looking at a 3D model of: "${parentModelName}".
            
            ${imageBase64 ? "I have attached a screenshot of what the user is currently looking at." : ""}
            **IMPORTANT:** In the screenshot, there is a small **RED DOT / MARKER**. This red dot marks the EXACT spot the user clicked.
            Focus entirely on the structural feature (bump, valve, tube, surface area) that is **directly underneath or touching the RED DOT**.

            Task:
            1. Identify specifically what the RED DOT is touching.
            2. Be precise contextually.
            3. Explain its function concisely (max 2 sentences).
            4. Use a friendly, educational tone.
            
            **OUTPUT FORMAT:**
            Return a strictly valid JSON object. Do not wrap in markdown or code blocks.
            Structure:
            {
                "part_name": "Name of the part",
                "description": "Concise explanation..."
            }
            
            **LANGUAGE INSTRUCTION:**
            The user has requested the explanation in: **${language}**.
            Translate values to **${language}**.
        `;

        // Prepare parts for the model
        const parts = [{ text: prompt }];
        if (imageBase64) {
            const base64Data = imageBase64.split(',')[1] || imageBase64;
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                }
            });
        }

        // Reduced list to save quota - stick to lighter models first
        const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-pro"];

        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🔄 Attempting to generate with model: ${modelName}`);
                const modelInstance = this.genAI.getGenerativeModel({ model: modelName });

                const result = await modelInstance.generateContent(parts);
                const response = await result.response;
                return response.text();
            } catch (error) {
                console.warn(`⚠️ Failed with ${modelName}:`, error);
                lastError = error;

                // Check for Quota Exceeded (429) or other specific limits
                const errString = error.toString().toLowerCase();
                if (errString.includes("429") || errString.includes("quota") || errString.includes("limit")) {
                    console.error("🚫 Quota Exceeded. Stopping retries.");
                    return "⚠️ **API Quota Exceeded**.<br>You have hit the free tier limit. Please wait a minute and try again.";
                }

                // Check for Overloaded (503)
                if (errString.includes("503") || errString.includes("overloaded")) {
                    console.warn("⚠️ Model Overloaded, trying next...");
                    continue; // Explicit continue to try next model
                }

                // Fallback: Try without image if image was present (maybe payload too large?)
                if (imageBase64 && modelName === modelsToTry[0]) {
                    console.log("⚠️ Retrying without image...");
                    try {
                        const result = await modelInstance.generateContent(prompt);
                        const response = await result.response;
                        return response.text();
                    } catch (retryError) {
                        if (retryError.message.includes("429")) {
                            return "⚠️ **API Quota Exceeded**.<br>Please wait a few moments.";
                        }
                        console.warn("⚠️ Text-only retry also failed:", retryError);
                        lastError = retryError;
                    }
                }
            }
        }

        console.error("❌ All models failed.");
        const errorMsg = lastError ? (lastError.message || lastError.toString()) : "Unknown Error";
        return `I'm having trouble connecting.<br><br><b>Debug Info:</b><br>${errorMsg}`;
    }
}
