const mysql = require('mysql2');

// Create connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'react-project'
});

// Connect and handle initial connection error
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
    console.log('Connected to MySQL database!');
});

// Promisify the queryFunction to properly handle async operations
const queryFunction = (query) => {
    return new Promise((resolve, reject) => {
        if (!query) {
            reject(new Error('No query provided'));
            return;
        }

        // Log the query for debugging
        console.log('Executing query:', query);

        // Execute the query
        connection.execute(query, [], (error, results) => {
            if (error) {
                console.error('Query execution error:', error);
                reject(error);
                return;
            }
            resolve(results);
        });
    });
};

module.exports = { queryFunction, connection };