const mongoose = require("mongoose");
const CustomerGroup = require("../models/CustomerGroup");
const Unit = require("../models/Unit");
const Company = require("../models/Company");
exports.createDefaultMastersForClient = async ({
  clientId,
  companyId,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const exists = await CustomerGroup.findOne({ clientId, companyId }).session(session);
    if (exists) {
      await session.commitTransaction();
      session.endSession();
      return;
    }
    await CustomerGroup.insertMany(
      [
        { groupName: "User", clientId, companyId },
        { groupName: "Counter", clientId, companyId },
        { groupName: "Sundry Debtors", clientId, companyId },
      ],
      { session }
    );
const company = await Company.findOne({ _id: companyId })
const decimal = company?.defaultDecimalPlaces 
    await Unit.insertMany(
      [
        { name: "Numbers", symbol: "NOS", type: "simple", status: "active", clientId, companyId,decimalPlaces:decimal },
        { name: "Pieces", symbol: "PCS", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Each", symbol: "EA", type: "simple", status: "active", clientId, companyId,decimalPlaces:decimal   },
        { name: "Set", symbol: "SET", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Pair", symbol: "PAIR", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Dozen", symbol: "DOZ", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Box", symbol: "BOX", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Packet", symbol: "PKT", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Bag", symbol: "BAG", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Bottle", symbol: "BTL", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Can", symbol: "CAN", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Carton", symbol: "CTN", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },

        { name: "Milligram", symbol: "MG", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Gram", symbol: "GM", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Kilogram", symbol: "KG", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Quintal", symbol: "QTL", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Tonne", symbol: "TON", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Pounds", symbol: "LBS", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Millimeter", symbol: "MM", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Centimeter", symbol: "CM", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Meter", symbol: "MTR", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Feet", symbol: "FT", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },
        { name: "Inch", symbol: "IN", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal   },

        {
          name: "Square Feet",
          symbol: "SQFT",
          type: "simple",
          status: "active",
          clientId, companyId, decimalPlaces:decimal 
        },
        {
          name: "Square Meter",
          symbol: "SQM",
          type: "simple",
          status: "active",
          clientId, companyId, decimalPlaces:decimal 
        },
        {
          name: "Square Inch",
          symbol: "SQIN",
          type: "simple",
          status: "active",
          clientId, companyId, decimalPlaces:decimal 
        },
        { name: "Acre", symbol: "ACRE", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },

        { name: "Milliliter", symbol: "ML", type: "simple", status: "active" , clientId, companyId, decimalPlaces:decimal },
        { name: "Litre", symbol: "LTR", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Kiloliter", symbol: "KL", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },

        {
          name: "Cubic Feet",
          symbol: "CUFT",
          type: "simple",
          status: "active",
          clientId, companyId, decimalPlaces:decimal 
        },
        {
          name: "Cubic Meter",
          symbol: "CUM",
          type: "simple",
          status: "active",
          clientId, companyId, decimalPlaces:decimal 
        },
        { name: "Hour", symbol: "HOUR", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Day", symbol: "DAY", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Week", symbol: "WEEK", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Month", symbol: "MONTH", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Year", symbol: "YEAR", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Job", symbol: "JOB", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal },
        { name: "Roll", symbol: "ROLL", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
        { name: "Lot", symbol: "LOT", type: "simple", status: "active", clientId, companyId, decimalPlaces:decimal  },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
