const StockItem = require("../models/stockItem.mode.js");
const User = require("../models/User.js");
const  asyncHandler =require("../utils/asyncHandler.js");
const  ApiResponse = require("../utils/apiResponse.js");
const  ApiError = require("../utils/apiError.js");
const Product = require("../models/Product.js");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");

// ✅ Create or Bulk Insert Stock Items

module.exports.createStockItems = asyncHandler(async (req, res) => {
  console.log("Creating stock items...", req.body);
  const { StockItems } = req.body;
  console.log("Received StockItems:", StockItems, req.body);

  if (!StockItems || !Array.isArray(StockItems)) {
    throw new ApiError(400, "StockItems must be a valid array");
  }
  const clientId = req.user.clientAgent;
  if (!clientId) throw new ApiError(404, "User not found");
  

  // --- 🔍 Step 1: Filter only those items that exist in Product collection ---
  const validItems = [];

  for (const item of StockItems) {
    if (!item.ItemCode) continue;


    console.log(`Checking existence of item code: ${item.ItemCode} for company: ${item.companyId}`);
    const existingProduct = await Product.findOne({
      code: item.ItemCode,
      companyId: item.companyId ,
    }).lean();
    console.log("Existing Product:", existingProduct);

    if (existingProduct) {
      validItems.push(item);
    } else {
      console.log(
        `❌ Skipping item '${item.ItemCode}' - not found in Product collection for this company`
      );
    }
  }

  if (validItems.length === 0) {
    throw new ApiError(400, "No valid stock items found to insert");
  }

  // --- 💰 Step 2: Prepare items before inserting ---
  const preparedItems = validItems.map((item) => {
   

    return {
      ...item,
      
      companyId: item.companyId || companyId,
      clientId: item.clientId || clientId,
      status: item.status || "active",
    };
  });

  // --- 🧾 Step 3: Insert all valid items ---
  const createdItems = await StockItem.insertMany(preparedItems, { ordered: false });

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        createdItems,
        `${createdItems.length} stock items created successfully`
      )
    );
});

// ✅ Get All Active & Non-Deleted Items
module.exports.getAllClientStockItems = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) throw new ApiError(404, "User not found");

  const stockItems = await StockItem.find({
    clientId: req.user.clientAgent
    // isDeleted: false,
  }).sort({ createdAt: -1 });
  console.log("Fetched stock items:", stockItems, req.user.clientAgent);

  res
    .status(200)
    .json(new ApiResponse(200, stockItems, "Active stock items fetched"));
});

// ✅ Get Item by Code
module.exports.getStockItemByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const item = await StockItem.findOne({
    ItemCode: code,
    isDeleted: false,
  });

  if (!item) throw new ApiError(404, "Stock item not found");

  res.status(200).json(new ApiResponse(200, item, "Stock item fetched"));
});

// ✅ Update Stock Item
module.exports.updateStockItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clientId = req.user.clientAgent;

  if (!clientId) throw new ApiError(404, "User not found");

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid Stock Item ID format");
  }

  console.log("Updating stock item...", id, req.body);

  const stockItem = await StockItem.findById(id);
  console.log("Found stock item:", stockItem);

  if (!stockItem) throw new ApiError(404, "Stock item not found");

  // Match client ownership
  if (stockItem.clientId.toString().toLowerCase() !== clientId.toLowerCase()) {
    throw new ApiError(403, "You are not authorized to update this stock item");
  }

  // Update
  const updatedItem = await StockItem.findOneAndUpdate(
    // { _id: id, status: { $ne: "deleted" } },
    { _id: id },
    req.body,
    { new: true, runValidators: true }
  );

  if (!updatedItem) throw new ApiError(404, "Stock item not found or deleted");

  res
    .status(200)
    .json(new ApiResponse(200, updatedItem, "Stock item updated successfully"));
});


// ✅ Change Status (Active/Inactive)
module.exports.changeStockItemStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["active", "inactive"].includes(status)) {
    throw new ApiError(400, "Invalid status value");
  }

  const updatedItem = await StockItem.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { status },
    { new: true }
  );

  if (!updatedItem) throw new ApiError(404, "Stock item not found");

  res
    .status(200)
    .json(new ApiResponse(200, updatedItem, `Stock item marked as ${status}`));
});

// ✅ Soft Delete Stock Item
module.exports.softDeleteStockItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedItem = await StockItem.findByIdAndUpdate(
    id,
    { isDeleted: true, status: "inactive" },
    { new: true }
  );

  if (!deletedItem) throw new ApiError(404, "Stock item not found");

  res
    .status(200)
    .json(new ApiResponse(200, deletedItem, "Stock item soft deleted successfully"));
});
exports.generateStockItemsDocumentationPDF = asyncHandler(async (req, res) => {
  const apiDocs = {
    baseUrl: "http://localhost:8000/api",
    authentication: {
      type: "Bearer Token (JWT)",
      header: "Authorization: Bearer <your_token>",
    },
    apis: [
      {
        title: "Create Stock Items (Bulk Insert)",
        endpoint: "POST /stock-items/create",
        requestType: "application/json",
        description:
          "Create multiple stock items at once. Only items matching existing product ItemCodes will be inserted.",
        body: {
          StockItems: [
            {
              companyId: "COMP001",
              clientId: "CLNT001",
              ItemName: "Apple iPhone 14",
              ItemCode: "IPH14-BLK-128",
              Group: "Mobiles",
              Category: "Electronics",
              MRP: 79999,
              Price: 74999,
              Discount: 5000,
              TotalQty: 150,
              SyncDate: "2025-10-06T10:00:00Z",
              Status: "active",
              GodownDetails: [
                { GodownName: "Main Warehouse", BatchName: "BATCH001", Qty: 50 },
                { GodownName: "Showroom", BatchName: "BATCH001", Qty: 25 },
              ],
            },
          ],
        },
        response: {
          statusCode: 201,
          message: "3 stock items created successfully",
          data: [
            {
              _id: "6718f056c26f4b75a4fd3e3a",
              ItemName: "Apple iPhone 14",
              ItemCode: "IPH14-BLK-128",
              companyId: "COMP001",
              clientId: "CLNT001",
              Status: "active",
            },
          ],
        },
      },
      {
        title: "Get All Client Stock Items",
        endpoint: "GET /stock-items/all",
        requestType: "application/json",
        description:
          "Fetches all active and non-deleted stock items for the logged-in client.",
        response: {
          statusCode: 200,
          data: [
            {
              _id: "6718f056c26f4b75a4fd3e3a",
              ItemName: "Apple iPhone 14",
              TotalQty: 150,
              Status: "active",
            },
          ],
        },
      },
      {
        title: "Get Stock Item by Code",
        endpoint: "GET /stock-items/:code",
        requestType: "application/json",
        description: "Fetch a single stock item using its ItemCode.",
        response: {
          statusCode: 200,
          data: {
            ItemCode: "IPH14-BLK-128",
            ItemName: "Apple iPhone 14",
            Price: 74999,
            MRP: 79999,
          },
        },
      },
      {
        title: "Update Stock Item",
        endpoint: "PUT /stock-items/update/:id",
        requestType: "application/json",
        description: "Update any details of a stock item by its MongoDB _id.",
        body: {
          ItemName: "Apple iPhone 14 Pro",
          Price: 78999,
          Discount: 10000,
          Status: "active",
        },
        response: {
          statusCode: 200,
          message: "Stock item updated successfully",
        },
      },
      {
        title: "Change Stock Item Status",
        endpoint: "PATCH /stock-items/status/:id",
        requestType: "application/json",
        description: "Change stock item status to active or inactive.",
        body: {
          status: "inactive",
        },
        response: {
          statusCode: 200,
          message: "Stock item marked as inactive",
        },
      },
      {
        title: "Soft Delete Stock Item",
        endpoint: "DELETE /stock-items/delete/:id",
        requestType: "application/json",
        description:
          "Soft deletes the stock item by marking status as inactive and isDeleted as true.",
        response: {
          statusCode: 200,
          message: "Stock item soft deleted successfully",
        },
      },
    ],
  };

  const html = `
    <html>
      <head>
        <title>Stock Items API Documentation</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 30px; color: #222; }
          h1, h2 { color: #2a5d84; }
          h1 { text-align: center; border-bottom: 2px solid #2a5d84; padding-bottom: 10px; }
          .endpoint {
            background: #f9f9f9;
            border: 1px solid #ccc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          pre {
            background: #1e1e1e;
            color: #00ff90;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          code { font-family: monospace; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>Stock Items API Documentation</h1>

        <h2>Base URL</h2>
        <pre><code>${apiDocs.baseUrl}</code></pre>

        <h2>Authentication</h2>
        <pre><code>${JSON.stringify(apiDocs.authentication, null, 2)}</code></pre>

        <h2>Endpoints</h2>
        ${apiDocs.apis
          .map(
            (api) => `
            <div class="endpoint">
              <h3>${api.title}</h3>
              <strong>Endpoint:</strong>
              <pre><code>${api.endpoint}</code></pre>
              <strong>Request Type:</strong>
              <pre><code>${api.requestType}</code></pre>
              ${
                api.description
                  ? `<p><strong>Description:</strong> ${api.description}</p>`
                  : ""
              }
              ${
                api.body
                  ? `<strong>Request Body:</strong><pre><code>${JSON.stringify(
                      api.body,
                      null,
                      2
                    )}</code></pre>`
                  : ""
              }
              <strong>Response:</strong>
              <pre><code>${JSON.stringify(api.response, null, 2)}</code></pre>
            </div>
          `
          )
          .join("")}

        <hr>
        <p style="text-align:center; color:#777; font-size:12px;">
          Generated on ${new Date().toLocaleString()}
        </p>
      </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "10mm", right: "10mm" },
  });

  await browser.close();

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="Stock_Items_API_Documentation.pdf"',
  });

  res.send(pdfBuffer);
});
