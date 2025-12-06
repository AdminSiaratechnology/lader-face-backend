const mongoose = require("mongoose");

const TemplateLedgerSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      required: true,
    },
    condition: {
      type: String,
      enum: ["autoCalculated", "flatRate", "percentage"],
      required: true,
    },
    amount: { type: Number, default: 0 },
    serialNo: { type: Number } 
  },
  { _id: false }
);

const BillTemplateSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    ledgers: {
      type: [TemplateLedgerSchema],
      default: [],
    },

    applicableFrom: { type: Date, required: true },
    applicableTo: { type: Date },

    layout: {
      headerTitle: { type: String, default: "INVOICE" },
      footerNote: { type: String, default: "" },
      termsAndConditions: { type: String, default: "" },
      showSignature: { type: Boolean, default: true },
      signatureLabel: { type: String, default: "Authorized Signatory" },
      // showEndOfListNote: { type: Boolean, default: false },
      // endOfListNote: { type: String, default: "" },

      printFormat: {
        type: String,
        enum: ["A4", "A5", "80mm"],
        default: "A4",
      },

      orientation: {
        type: String,
        enum: ["portrait", "landscape"],
        default: "portrait",
      },

      margin: {
        top: { type: Number, default: 10 },
        bottom: { type: Number, default: 10 },
        left: { type: Number, default: 10 },
        right: { type: Number, default: 10 },
      },
    },

    isDefault: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

BillTemplateSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      {
        companyId: this.companyId,  
        _id: { $ne: this._id },
        isDefault: true,
      },
      { isDefault: false }
    ).exec();
  }
  next();
});
BillTemplateSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  // Only run if user is setting this template as default
  if (update.isDefault === true) {
    const docToUpdate = await this.model.findOne(this.getQuery());

    await this.model.updateMany(
      {
        companyId: docToUpdate.companyId,
        _id: { $ne: docToUpdate._id },
      },
      { isDefault: false }
    );
  }

  next();
});

module.exports = mongoose.model("BillTemplate", BillTemplateSchema);
