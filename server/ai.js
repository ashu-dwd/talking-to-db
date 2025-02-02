const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const cleanHTML = (text) => {
    // Remove markdown code blocks and any extra whitespace
    return text.replace(/```html\n?|\n?```/g, '').trim();
};
const dbResponseEnhancedByGemini = async (TableData, UserQuery) => {

    const prompt = `
    Based on:
    User Query: ${UserQuery}
    Database Result: ${JSON.stringify(TableData)} \nGenerate reponse in HTML code. Just give me body part of html without body tag. dont add styling. Analyse the database result then provide information to user according to his query in easy words. you can use what u want. `
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
    return cleanHTML(result.response.text());
}

module.exports = { dbResponseEnhancedByGemini }
