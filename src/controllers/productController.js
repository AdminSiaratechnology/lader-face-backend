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

// Helper to map uploaded files to image objects
function mapUploadedImages(req) {
  if (!req.files || !req.files.images) return [];
  return req.files.images.map(f => {
    const url = f.location || f.path || f.filename || null;
    return {
      angle: f.fieldname || f.originalname || '',
      fileUrl: url,
      previewUrl: url
    };
  });
}

// Utility: safe parse (if string then JSON.parse, else return as is)
function safeParse(value, fallback = undefined) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }
  return value;
}

// CREATE product
exports.createProduct = asyncHandler(async (req, res) => {
  const body = req.body;

  // required fields
  const required = ['clientId', 'companyId', 'code', 'name'];
  for (const r of required) {
    if (!body[r]) throw new ApiError(400, `${r} is required`);
  }

  // validate refs
  const [company, client] = await Promise.all([
    Company.findById(body.companyId),
    User.findById(body.clientId)
  ]);
  if (!company) throw new ApiError(404, 'Company not found');
  if (!client) throw new ApiError(404, 'Client not found');

  if (body.stockGroup) {
    const sg = await StockGroup.findById(body.stockGroup);
    if (!sg) throw new ApiError(404, 'StockGroup not found');
  }
  if (body.stockCategory) {
    const sc = await StockCategory.findById(body.stockCategory);
    if (!sc) throw new ApiError(404, 'StockCategory not found');
  }
  if (body.unit) {
    const u = await Unit.findById(body.unit);
    if (!u) throw new ApiError(404, 'Unit not found');
  }
  if (body.defaultGodown) {
    const g = await Godown.findById(body.defaultGodown);
    if (!g) throw new ApiError(404, 'Godown not found');
  }

  // Build product object
  const productObj = {
    clientId: body.clientId,
    companyId: body.companyId,
    code: body.code,
    name: body.name,
    partNo: body.partNo,
    stockGroup: body.stockGroup || null,
    stockCategory: body.stockCategory || null,
    batch: body.batch === 'true' || body.batch === true || false,
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
    images: safeParse(body.images, []),
    remarks: body.remarks || undefined
  };

  // images from upload
  const uploadedImages = mapUploadedImages(req);
  if (uploadedImages.length) {
    productObj.images = (productObj.images || []).concat(uploadedImages);
  }

  const product = await Product.create(productObj);
  res.status(201).json(new ApiResponse(201, product, 'Product created'));
});

// UPDATE product
exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found');

  // if code changed, ensure uniqueness
  if (body.code && body.code !== product.code) {
    const existing = await Product.findOne({ code: body.code });
    if (existing) throw new ApiError(409, 'Product code already exists');
  }

  // safe parse nested fields
  body.taxConfiguration = safeParse(body.taxConfiguration, product.taxConfiguration);
  body.openingQuantities = safeParse(body.openingQuantities, product.openingQuantities);
  body.images = safeParse(body.images, product.images);

  // merge images if new uploads provided
  const uploadedImages = mapUploadedImages(req);
  if (uploadedImages.length) {
    body.images = (body.images || []).concat(uploadedImages);
  }

  Object.assign(product, body);
  await product.save();

  res.status(200).json(new ApiResponse(200, product, 'Product updated'));
});

// DELETE product
exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.status(200).json(new ApiResponse(200, null, 'Product deleted'));
});

// GET product by id
exports.getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id)
    .populate('companyId', 'namePrint')
    .populate('clientId', 'name email')
    .populate('stockGroup', 'name')
    .populate('stockCategory', 'name')
    .populate('unit', 'name symbol')
    .populate('alternateUnit', 'name symbol')
    .populate('defaultGodown', 'name code');

  if (!product) throw new ApiError(404, 'Product not found');
  res.status(200).json(new ApiResponse(200, product));
});

// LIST / SEARCH products
exports.listProducts = asyncHandler(async (req, res) => {
  const { companyId, clientId, stockGroup, stockCategory, q, page = 1, limit = 25 } = req.query;
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (clientId) filter.clientId = clientId;
  if (stockGroup) filter.stockGroup = stockGroup;
  if (stockCategory) filter.stockCategory = stockCategory;
  if (q) filter.$or = [
    { name: new RegExp(q, 'i') },
    { code: new RegExp(q, 'i') },
    { partNo: new RegExp(q, 'i') }
  ];

  const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('stockGroup', 'name')
      .populate('stockCategory', 'name')
      .populate('unit', 'name symbol')
      .skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    Product.countDocuments(filter)
  ]);

  res.status(200).json(new ApiResponse(200, { items, total, page: Number(page), limit: Number(limit) }));
});
