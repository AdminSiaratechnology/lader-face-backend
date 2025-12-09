const { Schema, model, default: mongoose } = require("mongoose");

const bogoSchema = new Schema({
  template: String,
  buyQty: Number,
  getQty: Number,
  buyProducts: [String],
  freeProducts: [String],
  freeMode: { type: String, enum: ["same", "different"] },
}, { _id: false });

const couponSchema = new Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    name: { type: String, required: true },
    code: { type: String, unique: true, trim: true },
   enableCouponType: { type: Boolean, default: false },
couponType: { type: String, default: "" },

enableSchemeName: { type: Boolean, default: false },
schemeName: { type: String, default: "" },

    description: { type: String, default: "" },

    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    

    discountType: { type: String, enum: ["PERCENT", "FIXED"], default: null },
    discountValue: { type: Number, default: 0 },
    minPurchase: { type: Number, default: 0 },

    taxApply: { type: String, enum: ["before", "after"], default: "before" },

    maxTotal: { type: Schema.Types.Mixed, default: "" },
    maxPerCustomer: { type: Schema.Types.Mixed, default: "" },
    maxPerDay: { type: Schema.Types.Mixed, default: "" },

    allowStacking: { type: Boolean, default: false },
    autoApply: { type: Boolean, default: false },

    stockCategories: { type: [String], default: [] },
    customerGroups: { type: [String], default: [] },
    stockGroups: { type: [String], default: [] },
    stockItems: { type: [String], default: [] },

    bogoConfig: { type: bogoSchema, default: null },
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "delete"],
      default: "active",
    },
  },
  { timestamps: true }
);

const CouponModel = model("Coupon", couponSchema);

module.exports = { CouponModel };
