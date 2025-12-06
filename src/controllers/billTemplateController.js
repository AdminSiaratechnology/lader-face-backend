const BillTemplate = require("../models/BillTemplate.js");
const User = require("../models/User.js");
const { generate6DigitUniqueId } = require("../utils/generate6DigitUniqueId");

exports.createTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;

    const user = await User.findById(userId).lean();
    if (!user) throw new ApiError(404, "User not found");

    const client = user.clientID;

    if (data.ledgers && data.ledgers.length > 0) {
      data.ledgers = data.ledgers.map((ledger, index) => ({
        ...ledger,
        serialNo: index + 1,
      }));
    }

    if (data.status === "active") {
      await BillTemplate.updateMany(
        { companyId: data.companyId, status: "active" },
        { status: "inactive" }
      );
    }
    const code = await generate6DigitUniqueId(BillTemplate, "code");

    const template = await BillTemplate.create({
      clientId: client,
      ...data,
      createdBy: userId,
      code: code,
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const {
      search = "",
      sortBy = "templateName",
      sortOrder = "asc",
      page = 1,
      limit = 10,
    status = "",
    } = req.query;

    const perPage = parseInt(limit, 10);
    const currentPage = Math.max(parseInt(page, 10), 1);
    const skip = (currentPage - 1) * perPage;
    const filter = {};
  if (status && status !== "") {
    filter.status = status;
  }
    if (search && search.trim() !== "") {
      filter.$or = [
        { templateName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "ledgers.ledgerName": { $regex: search, $options: "i" } },
      ];
    }
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortOptions = { [sortBy]: sortDirection };

    const [templates, total] = await Promise.all([
      BillTemplate.find(filter)
        .populate("clientId", "name email")
        .populate("companyId", "companyName")
        .populate({
          path: "ledgers.ledgerId",
          select: "ledgerName code type",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(perPage),

      BillTemplate.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: {
        templates,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      message: templates.length
        ? "Templates fetched successfully"
        : "No templates found",
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getTemplatesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
      status="",
    } = req.query;

    const perPage = parseInt(limit, 10);
    const currentPage = Math.max(parseInt(page, 10), 1);
    const skip = (currentPage - 1) * perPage;
    const filter = { companyId: companyId };
  if (status && status !== "") {
    filter.status = status;
  }
    if (search && search.trim() !== "") {
      filter.$or = [
        { templateName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "ledgers.ledgerName": { $regex: search, $options: "i" } },
      ];
    }
    const sortDirection = sortOrder === "desc" ? -1 : 1;
    const sortOptions = { [sortBy]: sortDirection };
    const [templates, total] = await Promise.all([
      BillTemplate.find(filter)
        .populate("clientId", "name email")
        .populate("companyId", "companyName")
        .populate({
          path: "ledgers.ledgerId",
          select: "ledgerName code type",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(perPage),

      BillTemplate.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: {
        templates,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      message: templates.length
        ? "Templates fetched successfully"
        : "No templates found",
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const template = await BillTemplate.findById(req.params.id);

    if (!template) return res.status(404).json({ error: "Template not found" });

    res.json(template);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const data = req.body;

    await BillTemplate.updateMany(
      { companyId: data.companyId, status: "active", _id: { $ne: id } },
      { status: "inactive" }
    );

    const updatedTemplate = await BillTemplate.findByIdAndUpdate(
      id,
      { ...data, updatedBy: userId },
      { new: true, runValidators: true }
    );

    if (!updatedTemplate)
      return res.status(404).json({ error: "Template not found" });

    res.json(updatedTemplate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const deletedTemplate = await BillTemplate.findByIdAndUpdate(
      req.params.id,
      { status: "delete" },
      { new: true }
    );

    if (!deletedTemplate)
      return res.status(404).json({ error: "Template not found" });

    res.json({
      message: "Template deactivated successfully",
      template: deletedTemplate,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getActiveTemplate = async (req, res) => {
  try {
    const { companyId } = req.query;

    const template = await BillTemplate.findOne({
      companyId,
      status: "active",
    });

    if (!template)
      return res.status(404).json({ error: "No active template found" });

    res.json(template);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
