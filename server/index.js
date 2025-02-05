const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { dbResponseEnhancedByGemini } = require('./ai');
const { queryFunction } = require('./connect');
require("dotenv").config();
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Init Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());

const cleanSqlQuery = text => text.replace(/```(json|javascript)?\n?|\n?```/g, '').trim();

const generateMySQLPrompt = (request, loginInfo) => `
You are a secure MySQL query generator specializing in HR management systems.

DATABASE CONFIGURATION:
Database Name: country-data
Server: MariaDB 10.4.32
Charset: UTF-8 Unicode (utf8mb4)

TABLE SCHEMAS:

1. AUTHENTICATION & USER MANAGEMENT
\`\`\`sql
CREATE TABLE employee_login (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL, 
    role ENUM('Admin', 'Manager', 'Staff') NOT NULL
);
\`\`\`

2. ORGANIZATIONAL STRUCTURE
\`\`\`sql
CREATE TABLE regions (
    region_id INT (11) AUTO_INCREMENT PRIMARY KEY,
    region_name VARCHAR (25) DEFAULT NULL
);

CREATE TABLE countries (
    country_id CHAR (2) PRIMARY KEY,
    country_name VARCHAR (40) DEFAULT NULL,
    region_id INT (11) NOT NULL,
    FOREIGN KEY (region_id) REFERENCES regions (region_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE locations (
    location_id INT (11) AUTO_INCREMENT PRIMARY KEY,
    street_address VARCHAR (40) DEFAULT NULL,
    postal_code VARCHAR (12) DEFAULT NULL,
    city VARCHAR (30) NOT NULL,
    state_province VARCHAR (25) DEFAULT NULL,
    country_id CHAR (2) NOT NULL,
    FOREIGN KEY (country_id) REFERENCES countries (country_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE departments (
    department_id INT (11) AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR (30) NOT NULL,
    location_id INT (11) DEFAULT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (location_id) ON DELETE CASCADE ON UPDATE CASCADE
);
\`\`\`

3. EMPLOYMENT & COMPENSATION
\`\`\`sql
CREATE TABLE jobs (
    job_id INT (11) AUTO_INCREMENT PRIMARY KEY,
    job_title VARCHAR (35) NOT NULL,
    min_salary DECIMAL (8, 2) DEFAULT NULL,
    max_salary DECIMAL (8, 2) DEFAULT NULL
);

CREATE TABLE employees (
    employee_id INT (11) AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR (20) DEFAULT NULL,
    last_name VARCHAR (25) NOT NULL,
    email VARCHAR (100) NOT NULL,
    phone_number VARCHAR (20) DEFAULT NULL,
    hire_date DATE NOT NULL,
    job_id INT (11) NOT NULL,
    salary DECIMAL (8, 2) NOT NULL,
    manager_id INT (11) DEFAULT NULL,
    department_id INT (11) DEFAULT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs (job_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES employees (employee_id)
);

CREATE TABLE dependents (
    dependent_id INT (11) AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR (50) NOT NULL,
    last_name VARCHAR (50) NOT NULL,
    relationship VARCHAR (25) NOT NULL,
    employee_id INT (11) NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE
);
\`\`\`

QUERY TYPES AND HANDLING:

1. LOGIN REQUESTS:
For requests containing email and password:
{
  "sqlQuery": "SELECT id, role FROM employee_login WHERE email = ? AND password = ?",
  "values": [email, password],
  "success": true,
  "message": "Login query generated",
  "requiresAuth": false
}

2. DATA REQUESTS:
For authenticated data queries:
{
  "sqlQuery": "SELECT ... FROM ... WHERE ...",
  "values": [...],
  "success": true,
  "message": "Query generated",
  "requiresAuth": true
}

CURRENT REQUEST:
${request}, loginInfo: ${loginInfo}

Generate a secure MySQL query following these specifications.`;

// Main request handler
const handleDatabaseQuery = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, message: "Query required" });
        }

        // Check auth status
        const loginInfo = req.cookies.token && req.cookies.token !== 'null'
            ? "USER is logged in . Good to go!"
            : "User is not logged in. Ask Him to send login credentials.";
        console.log(loginInfo);
        console.log(req.cookies)


        // Generate and clean query
        const result = await model.generateContent(generateMySQLPrompt(query, loginInfo));
        const aiQuery = cleanSqlQuery(result.response.text());
        const jsonQuery = JSON.parse(aiQuery);
        console.log(jsonQuery);

        // Handle login vs data requests
        if (jsonQuery.message === "Login query generated") {
            const dbResponse = await queryFunction(jsonQuery);
            const enhancedResponse = await dbResponseEnhancedByGemini(dbResponse, query, res, loginInfo);
            return res.status(200).json({
                success: true,
                query: jsonQuery,
                data: enhancedResponse
            });
        }

        return res.status(200).json({
            success: false,
            data: { html: `${jsonQuery.message} Please login to access this feature.` }
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

app.post("/", handleDatabaseQuery);

app.listen(port, () => console.log(`✅ Server running on port ${port}`));