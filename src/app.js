const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { notFound, errorHandler } = require('./middlewares/errorHandler'); // ✅ import your middleware
const authMiddleware=require("./middlewares/authMiddleware");
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const salesmanRoutes = require('./routes/salesman');
const godownRoutes = require('./routes/godownRoutes');
const stockCategoryRoutes = require('./routes/stockCategoryRoutes');
const stockGroupRoutes = require('./routes/stockGroupRoutes');
const unitRoutes = require('./routes/unitRoutes');
const productRoutes = require('./routes/productRoutes');
const userManagementRoute = require('./routes/userManagementRoute');
const customerRoute=require("./routes/customerRoutes")




const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true }));
app.get("/",(req,res)=>{
    res.send("API is working")
})
// Routes

app.use('/api/auth', authRoutes);
app.use(authMiddleware);
app.use('/api/company', companyRoutes);
app.use('/api/salesman', salesmanRoutes);
app.use("/api/godowns", godownRoutes);
app.use("/api/stock-categories", stockCategoryRoutes);
app.use("/api/stock-groups", stockGroupRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user-management", userManagementRoute);
app.use("/api/agent/customers",customerRoute)

// Not found middleware (for invalid routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
