// src/controllers/productController.js
const Product = require('../models/Product');
const Company = require('../models/Company');
const User = require('../models/User');
const StockGroup = require('../models/StockGroup');
const StockCategory = require('../models/StockCategory');
const Unit = require('../models/Unit');
const Godown = require('../models/Godown');

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

const {generateUniqueId} =require("../utils/generate16DigiId")
const mongoose = require('mongoose');
const   {createAuditLog}=require("../utils/createAuditLog")

// ✅ Batch insert helper
const insertInBatches = async (data, batchSize = 1000) => {
  let allInserted = [];

  if (data.length === 0) return allInserted;

  try {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      // 👇 ordered: false => skip invalid, continue inserting rest
      const inserted = await Product.insertMany(batch, { ordered: false });
      allInserted = allInserted.concat(inserted);
    }
  } catch (err) {
    console.error("⚠️ Partial insert error:", err.message);
    // No throw here so it continues gracefully
  }

  return allInserted;
};





// safeParse util (string ko JSON me parse kare)
const safeParse = (value, fallback) => {
  try {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value || fallback;
  } catch (err) {
    return fallback;
  }
};

exports.createProduct = asyncHandler(async (req, res) => {
  const body = req.body;
 

  console.log("req.body", req.body);

  // required fields
  const required = ["companyId", "code", "name"];
  for (const r of required) {
    if (!body[r]) throw new ApiError(400, `${r} is required`);
  }

  // validate refs
  const [company] = await Promise.all([
    Company.findById(body.companyId),
    // future client check
  ]);
  if (!company) throw new ApiError(404, "Company not found");

  if (body.stockGroup) {
    const sg = await StockGroup.findById(body.stockGroup);
    if (!sg) throw new ApiError(404, "StockGroup not found");
  }
  if (body.stockCategory) {
    const sc = await StockCategory.findById(body.stockCategory);
    if (!sc) throw new ApiError(404, "StockCategory not found");
  }
  if (body.unit) {
    const u = await Unit.findById(body.unit);
    if (!u) throw new ApiError(404, "Unit not found");
  }
  if (body.defaultGodown) {
    const g = await Godown.findById(body.defaultGodown);
    if (!g) throw new ApiError(404, "Godown not found");
  }

  // validate user
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  let clientId = user.clientID;
  console.log("clientId", clientId);

  // registration docs
    let registrationDocTypes;
    try {
      registrationDocTypes = JSON.parse(req.body.registrationDocTypes || '[]');
    } catch (e) {
      console.error('Failed to parse registrationDocTypes:', e);
      registrationDocTypes = [];
    }

    if (req?.files?.['registrationDocs']) {
      registrationDocs = req?.files['registrationDocs'].map((file, index) => ({
        type: registrationDocTypes[index] || 'Other',
        file: file.location,
        fileName: file.originalname
      }));
    }
  // let code=await generateUniqueId(Product,"code")

  // Build product object
  const productObj = {
    clientId: clientId,
    companyId: body.companyId,
    code: body.code,
    name: body.name,
    partNo: body.partNo,
    stockGroup: body.stockGroup || null,
    stockCategory: body.stockCategory || null,
    batch: body.batch === "true" || body.batch === true || false,
    unit: body.unit || null,
    alternateUnit: body.alternateUnit || null,
    minimumQuantity: body.minimumQuantity || undefined,
    defaultSupplier: body.defaultSupplier || undefined,
    minimumRate: body.minimumRate || undefined,
    maximumRate: body.maximumRate || undefined,
    defaultGodown: body.defaultGodown || null,
    productType: body.productType || undefined,
    taxConfiguration: safeParse(body.taxConfiguration, {}),
    openingQuantities: safeParse(body.openingQuantities, []),
    images: safeParse(body.images, []), // agar frontend se aaya ho
    remarks: body.remarks || undefined,
    status: body.status,
    createdBy: userId,
    auditLogs: [
      {
        action: "create",
        performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
        timestamp: new Date(),
        details: "Product created",
      },
    ],
  };
  console.log(req.body.productImageTypes,"producttypesssss")
  const productImageTypes=JSON.parse(req.body.productImageTypes)

  // === Handle Product Images from AWS ===
  if (req?.files?.["productImages"]) {
    const uploadedImages = req.files["productImages"].map((file,index) => ({
      angle: productImageTypes?.[index] || null,
      fileUrl: file.location, // actual S3 url
      previewUrl: file.location,
    }));
    productObj.images = (productObj.images || []).concat(uploadedImages);
  }

   

  // create product
  const product = await Product.create(productObj);
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  
  console.log(ipAddress, "ipaddress");
    await createAuditLog({
    module: "Product",
    action: "create",
    performedBy: req.user.id,
    referenceId: product._id,
    clientId:req.user.clientID,
    details: "Product created successfully",
    ipAddress,
  });

  res.status(201).json(new ApiResponse(201, product, "Product created"));
});

// UPDATE product
// exports.updateProduct = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const body = req.body;

//   const product = await Product.findById(id);
//   if (!product) throw new ApiError(404, "Product not found");

//   // // if code changed, ensure uniqueness
//   // if (body.code && body.code !== product.code) {
//   //   const existing = await Product.findOne({ code: body.code });
//   //   if (existing) throw new ApiError(409, "Product code already exists");
//   // }

//   console.log(req,"rrqqqqqbosyyyyy")
//   // safe parse nested fields
//   body.taxConfiguration = safeParse(body.taxConfiguration, product.taxConfiguration);
//   body.openingQuantities = safeParse(body.openingQuantities, product.openingQuantities);
//   body.images = safeParse(body.images, product.images);

//   // === Handle Product Images from AWS in update also ===
//   const productImageTypes = safeParse(req.body.productImageTypes, []);
//   if (req?.files?.["productImages"]) {
//     const uploadedImages = req.files["productImages"].map((file, index) => ({
//       angle: productImageTypes?.[index] || null,
//       fileUrl: file.location,
//       previewUrl: file.location,
//     }));
//     body.images = (body.images || []).concat(uploadedImages);
//   }

//   Object.assign(product, body);
//   await product.save();

//   res.status(200).json(new ApiResponse(200, product, "Product updated"));
// });
exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 0: Validate ID
  if (!id) throw new ApiError(400, "Product ID is required");

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");

  // ✅ Safe parse nested fields
  req.body.taxConfiguration = safeParse(req.body.taxConfiguration, product.taxConfiguration);
  req.body.openingQuantities = safeParse(req.body.openingQuantities, product.openingQuantities);
  req.body.images = safeParse(req.body.images, product.images);

  // ✅ Handle product images
  const productImageTypes = safeParse(req.body.productImageTypes, []);
  if (req?.files?.["productImages"]) {
    const uploadedImages = req.files["productImages"].map((file, index) => ({
      angle: productImageTypes?.[index] || null,
      fileUrl: file.location,
      previewUrl: file.location,
    }));
    req.body.images = (req.body.images || []).concat(uploadedImages);
  }

  // ✅ Track changes for audit log
  const oldData = product.toObject();
  const allowedFields = [
    "name", "code", "description", "category", "unit", "price",
    "taxConfiguration", "openingQuantities", "images", "status"
  ];

  const changes = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key) && JSON.stringify(oldData[key]) !== JSON.stringify(req.body[key])) {
      changes[key] = { from: oldData[key], to: req.body[key] };
    }
  });

  // ✅ Apply updates
  Object.assign(product, req.body);

  // ✅ Push audit log
  if (!product.auditLogs) product.auditLogs = [];
  product.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Product updated",
    changes,
    timestamp: new Date()
  });

  // ✅ Save product
  await product.save();
   let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "Product",
    action: "update",
    performedBy: req.user.id,
    referenceId: product._id,
    clientId: req.user.clientID,
    details: "Product updated successfully",
    changes,
    ipAddress,
  });

  res.status(200).json(new ApiResponse(200, product, "Product updated"));
});





// DELETE product
exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req?.user?.id;
  const clientID = req?.user?.clientID;

  // ✅ Step 1: Validate user
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (!clientID) throw new ApiError(403, "Invalid user");

  // ✅ Step 2: Find product with ownership check
  const product = await Product.findOne({ _id: id, clientId: clientID });
  if (!product)
    throw new ApiError(404, "Product not found or you are not authorized");

  // ✅ Step 3: Track changes for audit log
  const oldStatus = product.status;
  const changes = {};
  if (oldStatus !== "delete") {
    changes.status = { from: oldStatus, to: "delete" };
  }

  // ✅ Step 4: Apply soft delete
  product.status = "delete";

  // ✅ Step 5: Push audit log
  if (!product.auditLogs) product.auditLogs = [];
  product.auditLogs.push({
    action: "delete",
    performedBy: userId,
    details: "Product marked as deleted",
    changes,
    timestamp: new Date()
  });

  // ✅ Step 6: Save product
  await product.save();

let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "Product",
    action: "delete",
    performedBy: req.user.id,
    referenceId: product._id,
    clientId: req.user.clientID,
    details: "product marked as deleted",
    ipAddress,
  });


  res
    .status(200)
    .json(new ApiResponse(200, product, "Product status updated to Deleted"));
});



// GET product by id
exports.getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findOne({ _id: id, status: { $ne: "Delete" } })
  .select("-auditLogs")
    .populate('companyId', 'namePrint')
    .populate('clientId', 'name email')
    .populate('stockGroup', 'name')
    .populate('stockCategory', 'name')
    .populate('unit', 'name symbol')
    .populate('alternateUnit', 'name symbol')
    .populate('defaultGodown', 'name code');

  if (!product) throw new ApiError(404, 'Product not found or deleted');

  res.status(200).json(new ApiResponse(200, product));
});


// LIST / SEARCH products
exports.listProducts = asyncHandler(async (req, res) => {
  const { 
    search = "", 
    status = "", 
    sortBy = "createdAt", 
    sortOrder = "desc", 
    page = 1, 
    limit = 25,
    companyId, 
    clientId, 
    stockGroup, 
    stockCategory
  } = req.query;

  const filter = {};

  if (companyId) filter.companyId = companyId;
  if (clientId) filter.clientId = clientId;
  if (stockGroup) filter.stockGroup = stockGroup;
  if (stockCategory) filter.stockCategory = stockCategory;

  // ✅ Status filter (default: exclude Delete)
  filter.status = status && status.trim() !== "" ? status : { $ne: "Delete" };

  // 🔍 Search filter
  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { partNo: { $regex: search, $options: "i" } },
    ];
  }

  // 📑 Pagination setup
  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // ↕️ Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // ✅ Fetch data & total count in parallel
  const [items, total] = await Promise.all([
    Product.find(filter)
    .select("-auditLogs")
      .populate("stockGroup", "name")
      .populate("stockCategory", "name")
      .populate("unit", "name symbol")
      .skip(skip)
      .limit(perPage)
      .sort(sortOptions),
    Product.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      items.length ? "Products fetched successfully" : "No products found"
    )
  );
});
// LIST / SEARCH products
exports.listProductsByCompanyId = asyncHandler(async (req, res) => {
  console.log("hiiiii")
  const { 
    search = "", 
    status = "", 
    sortBy = "createdAt", 
    sortOrder = "desc", 
    page = 1, 
    limit = 25,
    
    clientId, 
    stockGroup, 
    stockCategory,
    

  } = req.query;
    const { companyId } = req.params;
   if (!companyId) throw new ApiError(400, "Company ID is required");


  const filter = {};

  if (companyId) filter.companyId = companyId;
  if (clientId) filter.clientId = clientId;
  if (stockGroup) filter.stockGroup = stockGroup;
  if (stockCategory) filter.stockCategory = stockCategory;

  // ✅ Status filter (default: exclude Delete)
  filter.status = status && status.trim() !== "" ? status : { $ne: "delete" };

  // 🔍 Search filter
  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { partNo: { $regex: search, $options: "i" } },
    
    ];
  }

  // 📑 Pagination setup
  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // ↕️ Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // ✅ Fetch data & total count in parallel
  const [items, total] = await Promise.all([
    Product.find(filter)
    .select("-auditLogs")
      .populate("stockGroup", "name")
      .populate("stockCategory", "name")
      .populate("unit", "name symbol")
      .populate("companyId", "namePrint")
      .skip(skip)
      .limit(perPage)
      .sort(sortOptions),
    Product.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      items.length ? "Products fetched successfully" : "No products found"
    )
  );
});



exports.createBulkProducts = asyncHandler(async (req, res) => {
  const { products } = req.body;

  // ✅ Validate request
  if (!Array.isArray(products) || products.length === 0) {
    throw new ApiError(400, "Products array is required in body");
  }

  // ✅ Validate user
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  const clientId = user.clientID;

  // ✅ Preload all reference IDs once
  const [companies, stockGroups, stockCategories, units, godowns] = await Promise.all([
    Company.find({}, "_id"),
    StockGroup.find({}, "_id"),
    StockCategory.find({}, "_id"),
    Unit.find({}, "_id"),
    Godown.find({}, "_id"),
  ]);

  const validIds = {
    companies: new Set(companies.map((c) => String(c._id))),
    stockGroups: new Set(stockGroups.map((s) => String(s._id))),
    stockCategories: new Set(stockCategories.map((s) => String(s._id))),
    units: new Set(units.map((u) => String(u._id))),
    godowns: new Set(godowns.map((g) => String(g._id))),
  };

  const results = [];
  const errors = [];

  // ✅ Process each product
  for (const [index, body] of products.entries()) {
    try {
      const required = ["companyId", "code", "name"];
      for (const field of required) {
        if (!body[field]) throw new Error(`${field} is required`);
      }

      // Validate references
      if (!validIds.companies.has(String(body.companyId))) throw new Error("Invalid companyId");
      if (body.stockGroup && !validIds.stockGroups.has(String(body.stockGroup))) throw new Error("Invalid stockGroup");
      if (body.stockCategory && !validIds.stockCategories.has(String(body.stockCategory))) throw new Error("Invalid stockCategory");
      if (body.unit && !validIds.units.has(String(body.unit))) throw new Error("Invalid unit");
      if (body.defaultGodown && !validIds.godowns.has(String(body.defaultGodown))) throw new Error("Invalid defaultGodown");

      const productObj = {
        clientId,
        companyId: body.companyId,
        code: body.code,
        name: body.name,
        partNo: body.partNo || undefined,
        stockGroup: body.stockGroup || null,
        stockCategory: body.stockCategory || null,
        batch: body.batch === "true" || body.batch === true || false,
        unit: body.unit || null,
        alternateUnit: body.alternateUnit || null,
        minimumQuantity: body.minimumQuantity || undefined,
        defaultSupplier: body.defaultSupplier || undefined,
        minimumRate: body.minimumRate || undefined,
        maximumRate: body.maximumRate || undefined,
        defaultGodown: body.defaultGodown || null,
        productType: body.productType || undefined,
        taxConfiguration: safeParse(body.taxConfiguration, {}),
        openingQuantities: safeParse(body.openingQuantities, []),
        remarks: body.remarks || undefined,
        status: body.status || "active",
        createdBy: userId,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk product import",
          },
        ],
      };

      results.push(productObj);
    } catch (err) {
      errors.push({
        index,
        code: body?.code,
        name: body?.name,
        error: err.message,
      });
    }
  }

  // ✅ Insert in batches
  const inserted = await insertInBatches(results, 1000);

  // ✅ Final response
  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: products.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((p) => p._id),
        errors,
      },
      "Bulk product import completed successfully"
    )
  );
});


