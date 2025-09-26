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
  let clientId = user.clientAgent;
  console.log("clientId", clientId);

  // registration docs
  let registrationDocs = [];
  if (req?.files?.["registrationDocs"]) {
    registrationDocs = req.files["registrationDocs"].map((file) => ({
      type: req.body.docType || "Other",
      file: file.location,
      fileName: file.originalname,
    }));
  }
  let code=await generateUniqueId(Product,"code")

  // Build product object
  const productObj = {
    clientId: clientId,
    companyId: body.companyId,
    code: code,
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

  res.status(201).json(new ApiResponse(201, product, "Product created"));
});

// UPDATE product
exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");

  // // if code changed, ensure uniqueness
  // if (body.code && body.code !== product.code) {
  //   const existing = await Product.findOne({ code: body.code });
  //   if (existing) throw new ApiError(409, "Product code already exists");
  // }

  console.log(req,"rrqqqqqbosyyyyy")
  // safe parse nested fields
  body.taxConfiguration = safeParse(body.taxConfiguration, product.taxConfiguration);
  body.openingQuantities = safeParse(body.openingQuantities, product.openingQuantities);
  body.images = safeParse(body.images, product.images);

  // === Handle Product Images from AWS in update also ===
  const productImageTypes = safeParse(req.body.productImageTypes, []);
  if (req?.files?.["productImages"]) {
    const uploadedImages = req.files["productImages"].map((file, index) => ({
      angle: productImageTypes?.[index] || null,
      fileUrl: file.location,
      previewUrl: file.location,
    }));
    body.images = (body.images || []).concat(uploadedImages);
  }

  Object.assign(product, body);
  await product.save();

  res.status(200).json(new ApiResponse(200, product, "Product updated"));
});



// DELETE product
exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // validate user
  const userId = req?.user?.id;
  const clientAgentId=req?.user?.clientAgent

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");


  
if (!clientAgentId) throw new ApiError(403, "Invalid user");

  // Find product and check ownership in one query
  const product = await Product.findOneAndUpdate(
    { _id: id, clientId: clientAgentId },
    { status: "Delete" },
    { new: true } // updated document return kare
  );

  if (!product)
    throw new ApiError(404, "Product not found or you are not authorized");

  res
    .status(200)
    .json(new ApiResponse(200, product, "Product status updated to Deleted"));
});


// GET product by id
exports.getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findOne({ _id: id, status: { $ne: "Delete" } })
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


