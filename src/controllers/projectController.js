const Project = require("../models/Project");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const generateProjectCode = async () => {
  const last = await Project.findOne().sort({ sequence: -1 });
  const nextSeq = last ? last.sequence + 1 : 1;
  const code = `PRJ-${String(nextSeq).padStart(4, "0")}`;
  return { nextSeq, code };
};

exports.createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) throw new ApiError(400, "Project name is required");

  const { nextSeq, code } = await generateProjectCode();

  const project = await Project.create({
    name,
    description: description || "",
    code,
    sequence: nextSeq,
  });

  res
    .status(201)
    .json(new ApiResponse(201, project, "Project created successfully"));
});

exports.getAllProjects = asyncHandler(async (req, res) => {
  let {
    page = 1,
    limit = 20,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);

  const query = {
    status: { $ne: "delete" }, // ⬅️ Exclude soft-deleted projects
  };

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const total = await Project.countDocuments(query);

  const projects = await Project.find(query)
    .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.status(200).json(
    new ApiResponse(200, {
      projects,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit,
      },
    })
  );
});

exports.getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) throw new ApiError(404, "Project not found");

  res
    .status(200)
    .json(new ApiResponse(200, project, "Project fetched successfully"));
});

exports.updateProject = asyncHandler(async (req, res) => {
  const { code, sequence, ...allowedUpdates } = req.body;

  // ❌ Prevent updating restricted fields
  if (code || sequence) {
    throw new ApiError(400, "Code and sequence cannot be updated");
  }

  // Optional: Validate status if provided
  if (allowedUpdates.status) {
    const validStatuses = ["active", "inactive", "delete"];
    if (!validStatuses.includes(allowedUpdates.status)) {
      throw new ApiError(400, "Invalid project status");
    }
  }

  const updated = await Project.findByIdAndUpdate(
    req.params.id,
    allowedUpdates,
    { new: true }
  );

  if (!updated) throw new ApiError(404, "Project not found");

  res
    .status(200)
    .json(new ApiResponse(200, updated, "Project updated successfully"));
});

exports.deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) throw new ApiError(404, "Project not found");

  project.status = "delete";
  await project.save();

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully"));
});
