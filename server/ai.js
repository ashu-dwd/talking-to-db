const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const cleanHTML = (text) => {
    try {
        // Remove markdown code blocks (both JSON and HTML)
        return text
            .replace(/```json\n?/g, "")
            .replace(/\n?```/g, "")
            .replace(/```html\n?/g, "")
            .trim();
    } catch (error) {
        console.error("Error cleaning HTML:", error);
        return text;
    }
};



const dbResponseEnhancedByGemini = async (tableData, userQuery, res, loginInfo) => {
    try {
        // Check if res object is provided
        if (!res || typeof res.cookie !== 'function') {
            throw new Error('Response object is required for cookie handling');
        }

        const prompt = `
            Context:
            - User Query: ${userQuery}
            - Database Result: ${JSON.stringify(tableData)}

            Instructions:
            1. Analyze the database result in relation to the user query
            2. Generate a response in HTML format
            3. For authentication:
               - If credentials match database result, return "success" status
               - If credentials don't match, return "failure" status
            4. For tables, use this basic styling: 
               <table style="border-collapse: collapse; width: 100%;">
               <td style="border: 1px solid #ddd; padding: 8px;">

            Response Format:
            For login attempts, return:
            {
                "html": "Your HTML response here",
                "message": "Authentication status message",
                "auth": {
                    "email": "user@example.com",
                    "status": "success/failure"
                }
            }
            For all other queries, return just the HTML content.
        `;

        const result = await model.generateContent(prompt);
        const cleanedResponse = cleanHTML(result.response.text());
        console.log('Cleaned Response:', cleanedResponse); // Debug log

        let response;
        try {
            // Check if the response is JSON
            if (cleanedResponse.startsWith("{")) {
                response = JSON.parse(cleanedResponse);
                console.log('Parsed Response:', response); // Debug log
            } else {
                response = { html: cleanedResponse };
            }
        } catch (error) {
            console.error("Error parsing Gemini response:", error);
            throw new Error("Invalid response format from Gemini");
        }

        let token = null;

        // Handle authentication if present
        if (response.auth && response.auth.status === "success" && response.auth.email) {
            token = jwt.sign(
                {
                    email: response.auth.email,
                    status: response.auth.status,
                },
                process.env.JWT_SECRET || "Ashu@1233", // Use environment variable if available
                { expiresIn: "1h" }
            );

            // Set cookie options
            const cookieOptions = {
                httpOnly: true,
                maxAge: 3600000, // 1 hour
                secure: process.env.NODE_ENV === 'production', // Only use secure in production
                sameSite: 'strict',
                path: '/'
            };

            // Set the cookie
            try {
                res.cookie('token', token, cookieOptions);
                console.log('Cookie set:', token); // Debug log
            } catch (error) {
                console.error('Error setting cookie:', error);
                throw new Error('Failed to set authentication cookie');
            }
        }

        return {
            html: response.html,
            message: response.message || null,
            token
        };
    } catch (error) {
        console.error("Error processing response:", error);
        throw new Error(`Failed to process database response: ${error.message}`);
    }
};

module.exports = {
    dbResponseEnhancedByGemini,
};