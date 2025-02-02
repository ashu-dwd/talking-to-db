const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { dbResponseEnhancedByGemini } = require('./ai');
const { queryFunction } = require('./connect');
require("dotenv").config();

const app = express();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to clean SQL query from markdown
const cleanSqlQuery = (text) => {
    // Remove markdown code blocks and any extra whitespace
    return text.replace(/```sql\n?|\n?```/g, '').trim();
};

//checking if the query is select
const isSelectQuery = (query) => {
    const isSelect = query.toLowerCase().startsWith('select');
    if (!isSelect) {
        return false;
    }
    return query;
};

const sendingTableDataToGemini = async (req, res) => {
    const { query, params } = req.body;  // Now expecting both query request and parameters

    if (!query) {
        return res.status(400).json({
            success: false,
            message: "Query request is required"
        });
    }

    try {
        const prompt = `
        You are a MySQL query generator for a blog application with users, posts, and comments. For INSERT/UPDATE operations, respond user by this feature will come soon in future version.You should only respond with the exact MySQL2 query needed, without any explanations or additional text. Here is what user wants: ${query}

Database Schema:
1. Users Table:
   - id (int, auto-increment, primary key)
   - username (varchar(255))
   - email (varchar(255))
   - password (varchar(255))
   - createdAt (datetime)
   - updatedAt (datetime)

2. Posts Table:
   - id (int, auto-increment, primary key)
   - title (varchar(255))
   - content (varchar(255))
   - username (varchar(255))
   - createdAt (datetime)
   - updatedAt (datetime)

3. Comments Table:
   - id (int, auto-increment, primary key)
   - CommentBody (varchar(255))
   - username (varchar(255))
   - postId (int)
   - createdAt (datetime)
   - updatedAt (datetime)

Rules for query generation:
1. Use proper MySQL2 syntax
2. Include only the query, no explanations
3. Use appropriate JOIN operations when querying related tables
4. Always use prepared statements with ? for variables
6. Never include actual values for passwords or sensitive data
7. Follow proper SQL injection prevention practices

Remember: Provide only the query, nothing else. No explanations, no comments, no additional text.
        `;

        // Generate SQL query using Gemini
        const result = await model.generateContent(prompt);
        const sqlQuery = cleanSqlQuery(result.response.text());

        if (!isSelectQuery(sqlQuery)) {
            return res.status(200).json({
                success: true,
                message: "Invalid query. Please provide a valid SELECT query. You cant update insert or delete data"
            });
        }


        // Execute the query with parameters if provided
        let databaseResponse = null;
        if (queryFunction) {
            try {
                databaseResponse = await queryFunction(sqlQuery, params || []);
            } catch (dbError) {
                console.error("Database Error:", dbError);
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: dbError.message,
                    query: sqlQuery
                });
            }
        }

        // Debugging logs
        console.log('User Request:', query);
        console.log('Parameters:', params);
        console.log("Generated Query:", sqlQuery);
        console.log("Database Response:", databaseResponse);

        const enhancedResponse = await dbResponseEnhancedByGemini(databaseResponse, query);

        // Return response
        return res.status(200).json({
            success: true,
            query: sqlQuery,
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