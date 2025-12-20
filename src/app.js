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
const vendorRoute=require("./routes/vendorRoute")
const agentRoute=require("./routes/agentRoutes")
const ladgerRoute=require("./routes/ladgerRoutes")
const stockItemRoutes=require("./routes/stockItem.routes")
const auditLogRoutes=require("./routes/auditLogRoutes")
const contactRoute=require("./routes/contactFormRoutes")
const orderRoute =require("./routes/order.routes")
const cartRoute =require("./routes/cartRoutes")
const paymentRoute =require("./routes/paymentRoutes")
const projectRoute = require("./routes/projectRoutes")
const customerGroupRoute=require("./routes/customerGroupRoutes")
const couponRoutes = require("./routes/Coupon");
const BillTemplateRoute = require("./routes/billTemplateRoutes");
const posRoutes  = require('./routes/posRoutes')
const BulkUploadRoute = require('./routes/bulkUploadRoute');

const app = express();
app.use(cors());
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",          // 🧑‍💻 Local dev
//       "http://192.168.1.7:5173",        // 🔗 Local network access
//       "https://ledgerface.netlify.app", // 🌐 Production
//       "https://ledgerface.vercel.app",  // 🧩 Another deployed version
//     ],
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
//   })
// );
// const corsOptions = {
//   origin: "http://localhost:5173",   // frontend URL
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true
// };

// app.use(cors(corsOptions));

// ✅ Handle preflight


// app.use(helmet());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true }));

app.get("/",(req,res)=>{

    res.send("API is working 09/12")


})
// app.post("/api/stock-items/create",(req,res)=>{
//     console.log("Stock items endpoint hit",req.body);
//     res.send("API is working")
// })
// Routes
app.use("/api/pos",posRoutes)
app.use("/api/coupons", couponRoutes);  //coupnonRoutes
app.use('/api/auth', authRoutes);
app.use("/api/contactUs",contactRoute)
app.use("/api/project", projectRoute);
app.use(authMiddleware);
app.use('/api/company', companyRoutes);
app.use('/api/bulk', BulkUploadRoute);
app.use('/api/salesman', salesmanRoutes);
app.use("/api/godowns", godownRoutes);
app.use("/api/stock-categories", stockCategoryRoutes);
app.use("/api/stock-groups", stockGroupRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user-management", userManagementRoute);

app.use("/api/customer-group",customerGroupRoute)
app.use("/api/customers",customerRoute)
app.use("/api/vendors",vendorRoute)
app.use("/api/agents",agentRoute)
app.use("/api/ledgers",ladgerRoute)
app.use("/api/stock-items",stockItemRoutes)
app.use("/api/auditLog",auditLogRoutes)
// app.use("/api/contactUs",contactRoute)
app.use("/api/order",orderRoute)
app.use("/api/cart",cartRoute)
app.use("/api/payment",paymentRoute)
app.use("/api/bill-templates",BillTemplateRoute)

// Not found middleware (for invalid routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);



module.exports = app;
