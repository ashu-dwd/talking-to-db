const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const dbResponseEnhancedByGemini = async (TableData, UserQuery) => {

    const prompt = `
    Based on:
    User Query: ${UserQuery}
    Database Result: ${JSON.stringify(TableData)}
    
    As a database analyst, please provide:
    1. A clear summary of the data returned
    2. Key patterns or trends in the results
    3. Relevant statistics and metrics (e.g., averages, distributions, outliers)
    4. Any correlations or relationships between data points
    5. Business insights or actionable recommendations based on this data
    6. Data quality assessment (completeness, consistency)
    7. Suggestions for additional queries that could provide more context
    
    Focus on presenting concrete, data-driven insights rather than general observations. Format numbers and statistics appropriately, and highlight any unusual or significant findings.`
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
}

module.exports = { dbResponseEnhancedByGemini }
