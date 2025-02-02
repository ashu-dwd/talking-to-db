const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { dbResponseEnhancedByGemini } = require('./ai');
const { queryFunction } = require('./connect');
require("dotenv").config();
const cors = require('cors');

const app = express();
const port = 3000;


const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Helper function to clean SQL query from markdown
const cleanSqlQuery = (text) => {
    // Remove markdown code blocks and any extra whitespace
    return text.replace(/```json\n?|\n?```/g, '').replace(/```javascript\n?|\n?```/g, '').trim();
};


//checking if the query is select
function isSelectQuery(query) {
    console.log(query);
    const isSelect = query.sqlQuery.toString().toLowerCase().startsWith('select');
    console.log(isSelect);
    if (!isSelect) {
        return false;
    }
    return query;
}



const sendingTableDataToGemini = async (req, res) => {
    const { query } = req.body;  // Now expecting both query request and parameters

    if (!query) {
        return res.status(400).json({
            success: false,
            message: "Query request is required"
        });
    }

    try {
        const prompt = `You are a MySQL query generator for a blog application with users, posts, and comments. Your responses must strictly follow these rules:

Database Schema:
1. Users Table:
id (int, auto-increment, primary key)
username (varchar(255))
email (varchar(255))
password (varchar(255))
createdAt (datetime)
updatedAt (datetime)
2. Posts Table:
id (int, auto-increment, primary key)
title (varchar(255))
content (varchar(255))
username (varchar(255))
createdAt (datetime)
updatedAt (datetime)
3. Comments Table:
id (int, auto-increment, primary key)
CommentBody (varchar(255))
username (varchar(255))
postId (int)
createdAt (datetime)
updatedAt (datetime)
Rules for Query Generation:
Respond with the exact MySQL2 query only – No explanations, no extra text, no comments.
Use proper MySQL2 syntax.
Use JOIN operations for retrieving related data efficiently.
Always use prepared statements with ? placeholders for variable binding.
Never include actual values for sensitive data like passwords.
Prevent SQL injection risks by structuring queries securely.
Strictly provide the query and values in a single response – Do not separate them.
Use current date and time for createdAt and updatedAt fields.Dont add them as variable.
Your Task:
Whenever the user requests a MySQL query, respond only with the exact MySQL2 query, following the above rules. Do not add any explanations, greetings, or extra text. Also return an object with the sqlQuery and values. User request is this: ${query}`;

        // Generate SQL query using Gemini
        const result = await model.generateContent(prompt);
        const aiQuery = cleanSqlQuery(result.response.text());
        console.log(aiQuery);
        const jsonQuery = JSON.parse(aiQuery);
        console.log(jsonQuery);

        // if (!isSelectQuery(sqlQuery)) {
        //     return res.status(200).json({
        //         success: true,
        //         message: "Invalid query. Please provide a valid SELECT query. You cant update insert or delete data"
        //     });


        // Execute the query with parameters if provided
        let databaseResponse = null;
        if (queryFunction) {
            try {
                databaseResponse = await queryFunction(jsonQuery || []);
            } catch (dbError) {
                console.error("Database Error:", dbError);
                return res.status(200).json({
                    success: false,
                    message: "Database error",
                    error: dbError.message,
                    query: sqlQuery
                });
            }
        }

        // Debugging logs
        console.log('User Request:', query);
        //console.log('Parameters:', params);
        console.log("Generated Query:", jsonQuery);
        console.log("Database Response:", databaseResponse);

        const enhancedResponse = await dbResponseEnhancedByGemini(databaseResponse, query);

        // Return response
        return res.status(200).json({
            success: true,
            query: jsonQuery,
            data: enhancedResponse
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while processing your request.",
            error: error.message
        });
    }
};

app.post("/", sendingTableDataToGemini);

app.listen(port, () => {
    console.log(`App is listening on port: ${port}`);
});