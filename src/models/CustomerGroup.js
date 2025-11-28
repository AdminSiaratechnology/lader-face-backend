const mongoose = require("mongoose");

const CustomerGroupSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    groupName: {
      type: String,
      required: true,
      trim: true,
    },

    groupCode: {
      type: String, 
    },

    status: {
      type: String,
      enum: ["active", "inactive","delete"],
      default: "active",
    },
    parentGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerGroup",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);



CustomerGroupSchema.pre("validate", async function (next) {
  try {
 
    if (this.groupCode) return next();

    const CustomerGroup =
      mongoose.models.CustomerGroup ||
      mongoose.model("CustomerGroup");

    const lastGroup = await CustomerGroup.findOne({
      clientId: this.clientId,
      companyId: this.companyId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .select("groupCode");

    let newCode = "000000000001";

    if (lastGroup && lastGroup.groupCode) {
      const lastNum = parseInt(lastGroup.groupCode, 10);
      const nextNum = (lastNum + 1).toString().padStart(12, "0");
      newCode = nextNum;
    }

    this.groupCode = newCode;

    next();
  } catch (err) {
    console.error("Error generating groupCode:", err);
    next(err);
  }
});


CustomerGroupSchema.index({ clientId: 1 });
CustomerGroupSchema.index({ companyId: 1 });
CustomerGroupSchema.index({ groupCode: 1 });
CustomerGroupSchema.index({ groupName: 1 });

module.exports = mongoose.model("CustomerGroup", CustomerGroupSchema);
