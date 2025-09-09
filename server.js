require('dotenv').config();
const connectDB = require('./src/config/db');
const app = require('./src/app');


(async () => {
try {
await connectDB();
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
} catch (e) {
console.error('Failed to start', e);
process.exit(1);
}
})();