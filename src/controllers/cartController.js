const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const StockItem = require("../models/stockItem.mode");
const Product = require("../models/Product");
// 🛒 Add or Replace Item in Cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;
    const { companyId } = req.params;

    if (
      !companyId ||
      !clientId ||
      !userId ||
      !productId ||
      quantity === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // ✅ Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid productId format" });
    }

    // 🔎 Fetch product
    const stockItem = await Product.findById(productId);
    if (!stockItem) {
      return res
        .status(404)
        .json({ success: false, message: "Stock item not found" });
    }

    // 🧹 If quantity is 0 → remove item from cart
    if (quantity <= 0) {
      const deletedCart = await Cart.findOneAndDelete({
        companyId,
        clientId,
        userId,
        productId,
      });

      if (!deletedCart) {
        return res
          .status(404)
          .json({ success: false, message: "Cart item not found to remove" });
      }

      return res.status(200).json({
        success: true,
        message: "Item removed from cart successfully",
      });
    }

    // 🛒 Add or update cart item
    const cart = await Cart.findOneAndUpdate(
      { companyId, clientId, userId, productId },
      { productId, quantity },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Item added/updated in cart successfully",
      cart,
    });
  } catch (error) {
    console.error("❌ Error adding to cart:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.bulkAddToCart = async (req, res) => {
  try {
    const { items } = req.body;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;
    const { companyId } = req.params;

    if (!companyId || !clientId || !userId || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields or items should be array",
      });
    }

    let results = [];

    for (const item of items) {
      const { productId, quantity, batch } = item;

      if (!productId || quantity === undefined) {
        results.push({ productId, status: "failed", reason: "Missing fields" });
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        results.push({
          productId,
          status: "failed",
          reason: "Invalid productId",
        });
        continue;
      }

      const product = await Product.findById(productId);
      if (!product) {
        results.push({
          productId,
          status: "failed",
          reason: "Product not found",
        });
        continue;
      }

      // Remove item
      if (quantity <= 0) {
        await Cart.findOneAndDelete({
          companyId,
          clientId,
          userId,
          productId,
          ...(product.batch && {
            "batch.batchName": batch.batchName,
            "batch.godownName": batch.godownName,
          }),
        });

        results.push({ productId, status: "deleted" });
        continue;
      }

      // ✅ UNIQUE KEY INCLUDES BATCH
      const cart = await Cart.findOneAndUpdate(
        {
          companyId,
          clientId,
          userId,
          productId,
          ...(product.batch && {
            "batch.batchName": batch.batchName,
            "batch.godownName": batch.godownName,
          }),
        },
        {
          productId,
          quantity,
          ...(product.batch && { batch }),
        },
        { new: true, upsert: true }
      );

      results.push({ productId, status: "updated", cart });
    }

    return res.status(200).json({
      success: true,
      message: "Bulk cart update complete",
      results,
    });
  } catch (error) {
    console.error("❌ Bulk cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // --- Modern Password Validation ---
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters, and contain uppercase, lowercase, number, and special characters.",
      });
    }

    // Step 1: Check verified OTP
    const otpRecord = await OTP.findOne({ email, isVerified: true });

    if (!otpRecord) {
      return res.status(400).json({
        message:
          "OTP not verified or has expired. Please verify the code again.",
      });
    }

    // Step 2: Hash new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Step 3: Update user password
    await User.findOneAndUpdate({ email }, { password: hashed });

    // Step 4: Delete OTP record after successful use
    await OTP.deleteMany({ email });

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res
      .status(500)
      .json({ message: "An error occurred while resetting the password." });
  }
};

// 🧾 Get Cart with StockItem Details
exports.getCart = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    // 🧩 Check required fields
    if (!companyId || !clientId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 🔍 Find all active cart items for this user
    const carts = await Cart.find({
      companyId,
      clientId,
      userId,
    }).populate("productId");

    if (!carts.length) {
      return res.status(200).json({
        success: false,
        message: "Cart is empty",
        totalItems: 0,
        totalAmount: 0,
        cart: [],
      });
    }

    // 🧮 Prepare detailed cart response
    let totalAmount = 0;
    const cartDetails = carts.map((cart) => {
      const stock = cart.productId;

      const price = stock?.Price || 0;
      const discount = stock?.Discount || 0;
      const finalPrice = price * cart.quantity; // If you want discount, update here

      totalAmount += finalPrice;

      return {
        _id: cart._id,
        productId: stock?._id,
        itemName: stock?.ItemName || "Unnamed Product",
        quantity: cart.quantity,
        price,
        discount,
        finalPrice,
        product: stock,
      };
    });

    // 🧾 Return structured response
    return res.status(200).json({
      success: true,
      message: "All active cart items fetched successfully",
      totalItems: cartDetails.length,
      totalAmount,
      cart: cartDetails,
    });
  } catch (error) {
    console.error("❌ Error getting cart:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ✏️ Update Item Quantity
exports.updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;
    const { companyId } = req.params;

    if (!companyId || !clientId || !userId || !productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // 🔹 Update cart item
    const cart = await Cart.findOneAndUpdate(
      { companyId, clientId, userId, productId },
      { quantity },
      { new: true }
    ).populate("productId");

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // 🔹 Extract product details
    const stock = cart.productId;
    const price = stock?.Price || 0;
    const discount = stock?.Discount || 0;
    const finalPrice = price * cart.quantity;

    // 🔹 Prepare cart details (same as getCart)
    const cartDetails = {
      productId: stock._id,
      itemName: stock.ItemName,
      quantity: cart.quantity,
      price,
      discount,
      finalPrice,
    };

    return res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      cart: {
        ...cart.toObject(),
        cartDetails,
      },
    });
  } catch (error) {
    console.error("❌ Error updating cart:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ❌ Remove Cart Item
exports.removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    if (!id || !clientId || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const deleted = await Cart.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "No active cart found" });
    }

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    console.error("❌ Error removing cart item:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// 🧹 Clear Cart
exports.clearCart = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    // 🧩 Validate user and required fields
    if (!companyId || !clientId || !userId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields — companyId, clientId, or userId is missing",
      });
    }

    // 🗑️ Delete all cart items matching user + client + company
    const result = await Cart.deleteMany({
      companyId,
      clientId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(200).json({
        success: false,
        message: "No cart items found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} item(s) removed from cart successfully`,
    });
  } catch (error) {
    console.error("❌ Error clearing cart:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
