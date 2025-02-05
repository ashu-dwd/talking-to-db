//MIDDLEWARE func to check if user is logged in or not by checking jwt token in headers
const authCheck = (req, res, next) => {
    const token = req.headers.token;
    console.log(token)
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "Ashu@1233");
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
}


module.exports = { authCheck };