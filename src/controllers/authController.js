const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const mongoose = require("mongoose");
const { createAuditLog } = require("../utils/createAuditLog");
const { generate6DigitUniqueId } = require("../utils/generate6DigitUniqueId");
const Customer = require("../models/Customer");
const sendEmail = require("../utils/sendEmail");
const OTP = require("../models/OTP");
const generateOTPTemplate = require("../utils/pdfTemplates/generateOTPTemplate");

// 🔐 Token Generator
const signToken = (userId, clientID, role, deviceId) => {
  return jwt.sign(
    { id: userId, clientID, role, deviceId },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ✅ REGISTER USER
// exports.register = asyncHandler(async (req, res) => {
//   const adminId = req?.user?.id;
//   const {
//     name,
//     email,
//     password,
//     role,
//     city,
//     country,
//     state,
//     area,
//     limit,
//     pincode,
//     region,
//     multiplePhones,
//   } = req.body;
//   let clientID = req.body.clientID || req.user.clientID;
//   // Backend - parse each projects entry
//   let projects = req.body.projects || [];

//   // If it's a single JSON string
//   if (typeof projects === "string") {
//     projects = [projects];
//   }

//   if (Array.isArray(projects)) {
//     projects = projects
//       .map((p) => {
//         if (typeof p === "string") {
//           try {
//             return JSON.parse(p);
//           } catch (e) {
//             return null;
//           }
//         }
//         return p;
//       })
//       .filter(Boolean);
//   }

//   // Now projects will be properly formatted array of objects
//   let access = structuredClone(req.body.access);
//   if (!name || !email || !password || !role) {
//     throw new ApiError(400, "Missing required fields");
//   }

//   const exists = await User.findOne({ email: email.toLowerCase() });
//   if (exists) throw new ApiError(409, "Email already in use");

//   const creatorInfo = await User.findById(adminId);
//   if (creatorInfo.role === "SuperAdmin" || creatorInfo.role === "Partner") {
//     req.body.projects = projects;
//   }

//   if (creatorInfo.role !== "SuperAdmin") {
//     if (creatorInfo.role === "Admin") {
//       // Admin can only create users under their assigned client
//       if (!clientID)
//         throw new ApiError(
//           400,
//           "Client ID is required for Admin-created users"
//         );

//       const client = await User.findById(clientID);
//       if (!client) throw new ApiError(404, "Client not found");

//       if (client.limit <= 0) {
//         throw new ApiError(400, "Client limit exceeded");
//       }
//     }
//   }

//   const hash = await bcrypt.hash(password, 10);
//   const uploadedDocs = req.files?.documents || [];
//   const uploadedUrls = uploadedDocs.map((file) => file.location);

//   // Final documents array (uploaded OR body OR fallback)
//   const finalDocuments =
//     uploadedUrls.length > 0
//       ? uploadedUrls
//       : Array.isArray(req.body.documents)
//       ? req.body.documents
//       : [];

//   const user = await User.create({
//     ...req.body,
//     email: email.toLowerCase(),
//     password: hash,
//     clientID: clientID || creatorInfo?.clientID,
//     createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
//     parent: creatorInfo?._id || null,
//     city,
//     country,
//     state,
//     area,
//     limit,
//     pincode,
//     region,
//     access: access,
//     documents: finalDocuments,
//     multiplePhones,
//     auditLogs: [
//       {
//         action: "create",
//         performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
//         timestamp: new Date(),
//         details: "User created",
//       },
//     ],
//   });
//   if (role === "Client") {
//     const assignedLimit = limit || 0;

//     // Only check/deduct if creator is Partner
//     if (creatorInfo.role === "Partner") {
//       const partnerRemainingLimit = creatorInfo.limit || 0;

//       if (assignedLimit > partnerRemainingLimit) {
//         throw new ApiError(
//           400,
//           `Partner limit exceeded. You have ${partnerRemainingLimit} remaining.`
//         );
//       }

//       // Deduct assigned limit from Partner
//       await User.updateOne(
//         { _id: creatorInfo._id },
//         {
//           $inc: { limit: -assignedLimit },
//         }
//       );
//     }

//     // Assign initial limit to the Client regardless of creator role
//     if (assignedLimit > 0) {
//       await User.updateOne(
//         { _id: user._id },
//         {
//           $push: {
//             limitHistory: {
//               performedBy: adminId
//                 ? new mongoose.Types.ObjectId(adminId)
//                 : null,
//               initialLimit: assignedLimit,
//               previousLimit: 0,
//               newLimit: assignedLimit,
//               action: "assigned",
//               reason:
//                 creatorInfo.role === "Partner"
//                   ? "Initial limit assigned by Partner"
//                   : "Initial limit assigned by SuperAdmin",
//               timestamp: new Date(),
//             },
//           },
//         }
//       );
//     }
//     // If client is being created, attach project list given
//     user.projects = projects;
//     user.clientID = user._id;
//     console.log(user, "userclientid");
//     await user.save();
//   }
//   if (role === "Admin") {
//     const client = await User.findById(clientID).select("projects");

//     user.projects = client?.projects || [];
//     await user.save();

//     // Deduct 1 license from Client
//     await User.updateOne({ _id: user.clientID }, { $inc: { limit: -1 } });
//   }

//   if (role === "Partner" && limit) {
//     await User.updateOne(
//       { _id: user._id },
//       {
//         $push: {
//           limitHistory: {
//             performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
//             initialLimit: limit,
//             previousLimit: 0,
//             newLimit: limit,
//             action: "assigned",
//             reason: "Initial limit assigned on creation",
//             timestamp: new Date(),
//           },
//         },
//       }
//     );
//   }
//   if (role === "Sub Partner" && limit) {
//     await User.updateOne(
//       { _id: user._id },
//       {
//         $push: {
//           limitHistory: {
//             performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
//             initialLimit: limit,
//             previousLimit: 0,
//             newLimit: limit,
//             action: "assigned",
//             reason: "Initial limit assigned on creation",
//             timestamp: new Date(),
//           },
//         },
//       }
//     );
//   }

//   if (role === "Customer" && Array.isArray(access) && access.length > 0) {
//     console.log("Auto-creating customers for access:", access);
//     for (const acc of access) {
//       const companyId = acc.company;

//       if (!companyId) continue;

//       const code = await generateUniqueId(Customer, "code");

//       const customer = await Customer.create({
//         company: companyId,
//         clientId: creatorInfo?.clientID || adminId,

//         // Required fields
//         customerName: name,
//         contactPerson: name,
//         emailAddress: email.toLowerCase(),
//         customerType: "company",
//         code,

//         createdBy: adminId,
//         auditLogs: [
//           {
//             action: "create",
//             performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
//             timestamp: new Date(),
//             details: "Customer auto-created from user registration",
//           },
//         ],
//       });
//       // Customer inherits creator's projects (client projects)
//       user.projects = creatorInfo.projects || [];
//       await user.save();

//       // ✅ Debug log
//       console.log(
//         `✅ Auto-Created Customer --> ID: ${
//           customer._id
//         }, Company: ${companyId}, Code: ${code}, Email: ${email.toLowerCase()}`
//       );
//     }
//   }
//   const code = await generate6DigitUniqueId(User, "code");
//   await User.updateOne(
//     { _id: user._id },
//     {
//       $set: {
//         code,
//       },
//     }
//   );
//   // After all role-based updates (Client, Admin deduction, Partner limit history, Customer auto-creation)
//   // BEFORE generating code

//   // 📩 Send email to Admin user with credentials
//   if (role === "Admin") {
//     const emailSubject = "Your Admin Account Credentials";
//     const emailText = `
// Hello ${name},

// Your admin account has been created successfully.

// Login Credentials:
// Email: ${email}
// Password: ${password}

// Please log in to continue working.

// Regards,
// Team
// `;

//     const emailHtml = `
//   <p>Hello <strong>${name}</strong>,</p>
//   <p>Your admin account has been successfully created.</p>
//   <p><strong>Login Credentials:</strong></p>
//   <ul>
//     <li><strong>Email:</strong> ${email}</li>
//     <li><strong>Password:</strong> ${password}</li>
//   </ul>
//   <p>Please change your password after first login.</p>
//   <br/>
//   <p>Regards,<br/>Team</p>
//   `;

//     const emailStatus = await sendEmail({
//       to: email,
//       subject: emailSubject,
//       text: emailText,
//       html: emailHtml,
//     });

//     if (!emailStatus.success) {
//       console.error(
//         "⚠️ Failed to send admin credentials email:",
//         emailStatus.error
//       );
//     }
//   }

//   const userResponse = user.toObject();
//   delete userResponse.password;
//   let ipAddress =
//     req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

//   // convert ::1 → 127.0.0.1
//   if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
//     ipAddress = "127.0.0.1";
//   }
//   await createAuditLog({
//     module: "User",
//     action: "create",
//     performedBy: req.user.id,
//     referenceId: user._id,
//     clientId: req.user.clientID,
//     details: "User created successfully",
//     ipAddress,
//   });
//   res
//     .status(201)
//     .json(new ApiResponse(201, userResponse, "User registered successfully"));
// });

exports.register = asyncHandler(async (req, res) => {
  const adminId = req?.user?.id;

  // Extract important fields safely
  const {
    name,
    email,
    password,
    role,
    city,
    country,
    state,
    area,
    limit,
    pincode,
    region,
    multiplePhones,
    isDemo,
    maxDemoDays,
    demoPeriod,
  } = req.body;

  let clientID = req.body.clientID || req.user.clientID;

  if (!name || !email || !password || !role) {
    throw new ApiError(400, "Missing required fields");
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "Email already in use");

  const creatorInfo = await User.findById(adminId);

  let projects = req.body.projects || [];
  if (typeof projects === "string") projects = [projects];
  if (Array.isArray(projects)) {
    projects = projects
      .map((p) => {
        try {
          return typeof p === "string" ? JSON.parse(p) : p;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  let access = req.body.access ? structuredClone(req.body.access) : [];

  if (creatorInfo.role === "SuperAdmin" || creatorInfo.role === "Partner") {
    req.body.projects = projects;
  }

  if (creatorInfo.role === "Admin") {
    if (!clientID)
      throw new ApiError(400, "Client ID is required for Admin-created users");

    const client = await User.findById(clientID);
    if (!client) throw new ApiError(404, "Client not found");

    if (client.limit <= 0) {
      throw new ApiError(400, "Client limit exceeded");
    }
  }

  if (
    (creatorInfo.role === "Partner" || creatorInfo.role === "Sub Partner") &&
    limit
  ) {
    const partnerAvailableLimit = creatorInfo.limit || 0;

    if (limit > partnerAvailableLimit) {
      throw new ApiError(
        400,
        `Assigned limit ${limit} cannot exceed creator's available limit (${partnerAvailableLimit}). User creation blocked.`
      );
    }
  }

  const hash = await bcrypt.hash(password, 10);

  const uploadedDocs = req.files?.documents || [];
  const uploadedUrls = uploadedDocs.map((file) => file.location);

  const finalDocuments =
    uploadedUrls.length > 0
      ? uploadedUrls
      : Array.isArray(req.body.documents)
      ? req.body.documents
      : [];

  const user = await User.create({
    ...req.body,
    name,
    email: email.toLowerCase(),
    password: hash,
    clientID: clientID || creatorInfo?.clientID,
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    parent: creatorInfo?._id || null,
    city,
    country,
    state,
    area,
    limit: role === "Client" ? 0 : limit,
    pincode,
    region,
    access,
    documents: finalDocuments,
    multiplePhones,
    auditLogs: [
      {
        action: "create",
        performedBy: adminId || null,
        timestamp: new Date(),
        details: "User created",
      },
    ],
  });

  if (role === "Client") {
    if (user.isDemo === true) {
      user.demoExpiry = new Date(
        Date.now() + user.demoPeriod * 24 * 60 * 60 * 1000
      );

      user.demoHistory.push({
        action: "created",
        performedBy: req.user.id,
        timestamp: new Date(),
      });

      await user.save();
    }

    const totalLimit = Number(limit) || 0;
    const reservedForSelf = totalLimit > 0 ? 1 : 0;
    const usableLimit = Math.max(totalLimit - reservedForSelf, 0);

    if (
      (creatorInfo.role === "Partner" || creatorInfo.role === "SubPartner") &&
      !user.isDemo
    ) {
      const partnerRemainingLimit = creatorInfo.limit || 0;

      if (usableLimit > partnerRemainingLimit) {
        throw new ApiError(
          400,
          `Partner limit exceeded. Available: ${partnerRemainingLimit}`
        );
      }

      await User.updateOne(
        { _id: creatorInfo._id },
        {
          $inc: { limit: -totalLimit },
          $push: {
            limitHistory: {
              performedBy: adminId,
              previousLimit: partnerRemainingLimit,
              newLimit: partnerRemainingLimit - totalLimit,
              deductedLimit: totalLimit,
              action: "deducted",
              reason: `Assigned ${totalLimit} limit to Client ${user.name}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }
    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          limitHistory: {
            performedBy: adminId,
            initialLimit: totalLimit,
            previousLimit: 0,
            newLimit: usableLimit,
            action: "assigned",
            reason: "Initial limit assigned (1 reserved for client itself)",
            timestamp: new Date(),
          },
        },
        $set: {
          limit: usableLimit,
        },
      }
    );
    user.clientID = user._id;
    user.projects = projects;
    await user.save();
  }

  if (role === "Admin") {
    const client = await User.findById(clientID).select("projects");

    user.projects = client?.projects || [];
    await user.save();
  }

  // PARTNER / SUB PARTNER ROLE
  if ((role === "Partner" || role === "Sub Partner") && limit) {
    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          limitHistory: {
            performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
            initialLimit: limit,
            previousLimit: 0,
            newLimit: limit,
            action: "assigned",
            reason: "Initial limit assigned on creation",
            timestamp: new Date(),
          },
        },
      }
    );
  }
  if (role === "SubPartner" && limit) {
    const assignedLimit = limit || 0;

    if (creatorInfo.role === "Partner") {
      const partnerRemainingLimit = creatorInfo.limit || 0;

      if (assignedLimit > partnerRemainingLimit) {
        throw new ApiError(
          400,
          `Partner limit exceeded. You have ${partnerRemainingLimit} remaining.`
        );
      }

      await User.updateOne(
        { _id: creatorInfo._id },
        {
          $inc: { limit: -assignedLimit },
          $push: {
            limitHistory: {
              performedBy: adminId,
              previousLimit: partnerRemainingLimit,
              newLimit: partnerRemainingLimit - assignedLimit,
              action: "deducted",
              deductedLimit: assignedLimit,
              reason: `Assigned ${assignedLimit} limit to Sub Partner ${user.name}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          limitHistory: {
            performedBy: adminId,
            initialLimit: limit,
            previousLimit: 0,
            newLimit: limit,
            action: "assigned",
            reason: "Initial limit assigned on creation",
            timestamp: new Date(),
          },
        },
      }
    );
  }

  // CUSTOMER ROLE — Auto-create customers for each company in access
  if (role === "Customer" && Array.isArray(access) && access.length > 0) {
    for (const acc of access) {
      if (!acc.company) continue;

      await Customer.create({
        company: acc.company,
        companyId: acc.company,
        clientId: creatorInfo?.clientID || adminId,
        customerName: name,
        name: name,
        contactPerson: name,
        emailAddress: email.toLowerCase(),
        customerType: "company",
        createdBy: adminId,
        createdFromUser: true
      });
      console.log(
        "🚀 ~ file: authController.js ~ line 400 ~ acc.company ~ acc.company",
        acc.company
      );
      user.projects = creatorInfo.projects || [];
      await user.save();
    }
  }

  const code = await generate6DigitUniqueId(User, "code");
  await User.updateOne({ _id: user._id }, { $set: { code } });
  const LIMIT_CONSUMING_ROLES = ["Admin", "Customer", "Salesman"];
  if (LIMIT_CONSUMING_ROLES.includes(role)) {
    const mappedClientId = user.clientID;

    const client = await User.findById(mappedClientId).select("limit");

    if (!client || client.limit <= 0) {
      throw new ApiError(400, "Client limit exceeded");
    }

    await User.updateOne(
      { _id: mappedClientId },
      {
        $inc: { limit: -1 },
      }
    );
  }

  // ================================
  // 1️⃣1️⃣ AUDIT LOG
  // ================================
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  if (ipAddress === "::1") ipAddress = "127.0.0.1";

  await createAuditLog({
    module: "User",
    action: "create",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User created successfully",
    ipAddress,
  });

  // ================================
  // 1️⃣2️⃣ RESPONSE
  // ================================
  const userResponse = user.toObject();
  delete userResponse.password;

  res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});

// ✅ REGISTER USER
exports.registerInside = asyncHandler(async (req, res) => {
  const adminId = req?.user?.id;
  const { name, email, password, role } = req.body;
  let access = structuredClone(req.body.access);
  console.log(access, "access");

  if (!name || !email || !password || !role) {
    throw new ApiError(400, "Missing required fields");
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "Email already in use");

  const creatorInfo = await User.findById(adminId);
  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    ...req.body,
    email: email.toLowerCase(),
    password: hash,
    clientID: null,
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    parent: creatorInfo?._id || null,
    lastLogin: new Date(),
    access: structuredClone(req.body.access),
    auditLogs: [
      {
        action: "create",
        performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
        timestamp: new Date(),
        details: "User created",
      },
    ],
  });

  const userResponse = user.toObject();
  delete userResponse.password;
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }

  console.log(ipAddress, "ipaddress");
  await createAuditLog({
    module: "User",
    action: "create",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});

// ✅ UPDATE USER
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body, clientID: req.user.clientID };
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  // Email uniqueness check
  if (updateData.email && updateData.email !== user.email) {
    const exists = await User.findOne({
      email: updateData.email.toLowerCase(),
    });
    if (exists) throw new ApiError(409, "Email already in use");
    updateData.email = updateData.email.toLowerCase();
  }

  // Password hashing if updated
  if (updateData.password && updateData.password.trim()) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  } else {
    delete updateData.password;
  }

  // Store old data before update
  const oldData = user.toObject();
  if (
    updateData.status === "active" &&
    user.blocked === true &&
    updateData.blocked !== false
  ) {
    throw new ApiError(
      400,
      "Please unblock the user before activating the account"
    );
  }

  if (user.blocked === true && updateData.blocked === false) {
    const authUser = await User.findById(req.user.id);
    const clientUser = await User.findById(user.clientID).select("limit");
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }
    if (!clientUser || clientUser.limit <= 0) {
      throw new ApiError(
        403,
        "Insufficient limit to unblock and activate this user"
      );
    }
  }
const oldAccessCompanies = Array.isArray(user.access)
    ? user.access.map((acc) => acc?.company?.toString()).filter(Boolean)
    : [];
console.log(oldAccessCompanies, "oldAccessCompanies")
  Object.entries(updateData).forEach(([key, value]) => {
    if (["createdBy", "createdAt", "_id", "password"].includes(key)) return;
    if (key === "clientID") return;

    if (["parent", "company"].includes(key)) {
      if (value && mongoose.Types.ObjectId.isValid(value)) {
        user[key] = new mongoose.Types.ObjectId(value);
      } else {
        // If empty or invalid, explicitly set to null
        user[key] = null;
      }
    } else {
      user[key] = value;
    }
  });
  // Safely get uploaded documents
  const uploadedDocs = req.files?.documents || []; // this will be an array
  const uploadedUrls = uploadedDocs.map(
    (file) => file.location || file.path || file.originalname
  );

  // Merge new uploaded files with existing documents
  user.documents = [...(user.documents || []), ...uploadedUrls];
  // Track changed fields for audit logs
  const changes = {};
  for (const key in updateData) {
    if (["createdBy", "createdAt", "_id"].includes(key)) continue;
    if (String(oldData?.[key]) !== String(updateData?.[key])) {
      changes[key] = { from: oldData?.[key], to: updateData?.[key] };
    }
  }
  // Ensure projects is always an array
  let projects = req.body.projects || [];

  // If single project sent as string/object, wrap in array
  if (!Array.isArray(projects)) {
    projects = [projects];
  }

  // Parse stringified projects (from FormData)
  projects = projects
    .map((p) => {
      if (typeof p === "string") {
        try {
          return JSON.parse(p);
        } catch (e) {
          return null;
        }
      }
      return p;
    })
    .filter(Boolean); // remove nulls

  // Assign to user.projects if there are valid entries
  if (projects.length > 0) {
    user.projects = projects.map((proj) => ({
      projectId: proj.projectId,
      projectCode: proj.projectCode,
    }));
  }

  // Add audit log entry
  user.auditLogs.push({
    action: "update",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "User updated",
    changes,
  });

  await user.save();
  
  let newAccess = updateData.access || [];

  if (!Array.isArray(newAccess)) {
    newAccess = [newAccess];
  }

  const newAccessCompanies = newAccess
    .map((acc) => acc?.company?.toString())
    .filter(Boolean);
    console.log(newAccessCompanies, "newAccessCompanies")
  const newlyAddedCompanies = newAccessCompanies.filter(
    (companyId) => !oldAccessCompanies.includes(companyId)
  );
  console.log(newlyAddedCompanies, "newlyAddedCompanies")
  if (
    (updateData.role === "Customer" || user.role === "Customer") &&
    newlyAddedCompanies.length > 0
  ) {
    for (const companyId of newlyAddedCompanies) {
      console.log(companyId, "aaaaaaaaaaaaaaa")
      if (!mongoose.Types.ObjectId.isValid(companyId)) continue;

      const exists = await Customer.findOne({
        company: companyId,
        emailAddress: user.email.toLowerCase(),
        clientId: req.user.clientID,
      });

      if (exists) continue;

      await Customer.create({
        company: new mongoose.Types.ObjectId(companyId),
        companyId: new mongoose.Types.ObjectId(companyId),
        clientId: req.user.clientID,
        customerName: user.name,
        name: user.name,
        contactPerson: user.name,
        emailAddress: user.email.toLowerCase(),
        customerType: "company",
        createdBy: req.user.id,
        createdFromUser: true
      });

      console.log("✅ Customer entry created for company:", companyId);
    }
  }

  const userResponse = user.toObject();
  console.log(userResponse);
  delete userResponse.password;
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "User",
    action: "update",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User updated successfully",
    changes,
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, userResponse, "User updated successfully"));
});

// ✅ DELETE USER (soft delete)
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  user.status = "delete";

  // Log delete action
  user.auditLogs.push({
    action: "delete",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "User marked as deleted",
  });

  await user.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "User",
    action: "delete",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User marked as deleted",
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, { id: user._id }, "User deleted successfully"));
});

// ✅ LOGIN USER
// exports.login = asyncHandler(async (req, res) => {
//   const { email, password, deviceId } = req.body;

//   if (!email || !password)
//     throw new ApiError(400, "Email and password are required");
//   if (!deviceId) {
//     throw new ApiError(400, "Device ID is required");
//   }
//   const user = await User.findOne({ email: email.toLowerCase() })
//     .populate({
//       path: "access.company",
//       select: "namePrint logo nameStreet code",
//     })
//     .populate({
//       path: "createdBy",
//       select: "email name",
//     });

//   if (!user) throw new ApiError(401, "Invalid credentials");

//   const isMatch = await bcrypt.compare(password, user.password);
//   if (!isMatch) throw new ApiError(401, "Invalid credentials");

//   const token = signToken(user._id, user.clientID, user.role, deviceId);

//   const safeUser = user.toObject();
//   delete safeUser.password;
//   delete safeUser.__v;
//   delete safeUser.loginHistory;
//   delete safeUser.auditLogs;
//   safeUser.access = [...(user.access || [])];

//   // Update last login + log it
//   const now = new Date();

//   user.currentDeviceId = deviceId;
//   user.currentToken = token;
//   user.lastLogin = now;
//   user.loginHistory.push(now);
//   user.auditLogs.push({
//     action: "login",
//     performedBy: new mongoose.Types.ObjectId(user._id),
//     timestamp: new Date(),
//     details: "User logged in",
//   });

//   await user.save();
//   // Fetch stats based on role
//   let stats = {};

//   if (user.role === "SuperAdmin") {
//     // 1️⃣ Count partners
//     const totalPartners = await User.countDocuments({
//       role: "Partner",
//       status: { $ne: "delete" },
//     });

//     // 2️⃣ Clients created by ANY superadmin
//     const clients = await User.find({
//       role: "Client",
//       createdBy: user._id, // superadmin created
//       status: { $ne: "delete" },
//     }).select("_id");

//     const clientIDs = clients.map((c) => c._id);

//     // 3️⃣ Users under superadmin's clients
//     const totalUsers = await User.countDocuments({
//       clientID: { $in: clientIDs },
//       status: { $ne: "delete" },
//     });
//     const allClients = await User.find({
//       role: "Client",
//       status: { $ne: "delete" },
//     }).select("_id");

//     const allClientIDs = allClients.map((c) => c._id);

//     // 3️⃣ Users under superadmin's clients
//     const allTotalUsers = await User.countDocuments({
//       clientID: { $in: allClientIDs },
//       status: { $ne: "delete" },
//     });

//     stats = {
//       totalPartners,
//       totalClients: clientIDs.length,
//       totalUsers,
//       totalAllClients: allClientIDs.length,
//       totalAllUsers: allTotalUsers,
//     };
//   }

//   // PARTNER STATS
//   else if (user.role === "Partner") {
//     // 1️⃣ Clients created by this partner
//     const clients = await User.find({
//       parent: user._id,
//       role: "Client",
//       status: { $ne: "delete" },
//     }).select("_id");

//     const clientIDs = clients.map((c) => c._id);

//     // 2️⃣ Users under this partner's clients
//     const totalUsers = await User.countDocuments({
//       clientID: { $in: clientIDs },
//       status: { $ne: "delete" },
//     });

//     stats = {
//       totalClients: clientIDs.length,
//       totalUsers,
//     };
//   }

//   res
//     .status(200)
//     .json(
//       new ApiResponse(200, { token, user: safeUser, stats }, "Login successful")
//     );
// });
// ==========================================
// 1. CLIENT PORTAL LOGIN
// Allowed: Admin, Client, Salesman, Customer
// ==========================================
exports.loginClientPortal = asyncHandler(async (req, res) => {
  const { email, password, deviceId } = req.body;
  console.log(email, "email");

  // 1. Basic Validation
  if (!email || !password)
    throw new ApiError(400, "Email and password are required");
  if (!deviceId) {
    throw new ApiError(400, "Device ID is required");
  }

  // 2. Find User
  const user = await User.findOne({ email: email.toLowerCase() })
    .populate({
      path: "access.company",
      select: "namePrint logo nameStreet code",
    })
    .populate({
      path: "createdBy",
      select: "email name",
    });

  if (!user) throw new ApiError(401, "Invalid credentials");
  if (user.status === "inactive" || user.status === "blocked") {
    throw new ApiError(
      403,
      `Your account is ${user.status}. Please contact support.`
    );
  }
  if (user.clientID) {
    const client = await User.findById(user.clientID).select("status name");
    if (client && client.status !== "active") {
      throw new ApiError(
        403,
        `Your client "${client.name}" is ${client.status}. Please contact them to access the portal.`
      );
    }
  }
  // 3. 🛡️ ROLE GUARD: Portal 1 Specific
  const allowedRoles = ["Admin", "Client", "Salesman", "Customer"];
  if (!allowedRoles.includes(user.role)) {
    throw new ApiError(
      403,
      "Access Denied: This account belongs to the Management Portal."
    );
  }

  // 4. Verify Password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");
  const newDeviceId =
    req?.headers["auth-source"] == "Api" ? user.currentDeviceId : deviceId;
  console.log(req?.headers["auth-source"], "fhjefvghergh", newDeviceId);

  // 5. Generate Token
  const token = signToken(user._id, user.clientID, user.role, newDeviceId);
  const newToken =
    req?.headers["auth-source"] == "Api" ? user.currentToken : token;
  // Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36

  // 6. Update Login History & Audit Logs
  const now = new Date();
  user.currentDeviceId = newDeviceId;
  user.currentToken = newToken;
  user.lastLogin = now;
  user.loginHistory.push(now);
  user.auditLogs.push({
    action: "login",
    performedBy: new mongoose.Types.ObjectId(user._id),
    timestamp: new Date(),
    details: "User logged in to Client Portal",
  });

  await user.save();

  // 7. Sanitize User Object
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.__v;
  delete safeUser.loginHistory;
  delete safeUser.auditLogs;
  safeUser.access = [...(user.access || [])];
  const clientUser = await User.findById(user.clientID).select("limit");

  if (clientUser) {
    safeUser.clientLimit = clientUser.limit; // ✅ added inside user
  }
  // Note: Client portal usually doesn't need the complex stats object,
  // but if you have specific stats for them, add here.
  const stats = {};

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { token, user: safeUser, stats },
        "Client Portal Login successful"
      )
    );
});

// ==========================================
// 2. MANAGEMENT PORTAL LOGIN
// Allowed: SuperAdmin, Partner, Sub Partner
// ==========================================
exports.loginManagementPortal = asyncHandler(async (req, res) => {
  const { email, password, deviceId } = req.body;

  // 1. Basic Validation
  if (!email || !password)
    throw new ApiError(400, "Email and password are required");
  if (!deviceId) {
    throw new ApiError(400, "Device ID is required");
  }

  // 2. Find User
  const user = await User.findOne({ email: email.toLowerCase() })
    .populate({
      path: "access.company",
      select: "namePrint logo nameStreet code",
    })
    .populate({
      path: "createdBy",
      select: "email name",
    });

  if (!user) throw new ApiError(401, "Invalid credentials");

  // 3. 🛡️ ROLE GUARD: Portal 2 Specific
  const allowedRoles = ["SuperAdmin", "Partner", "SubPartner"];
  if (!allowedRoles.includes(user.role)) {
    throw new ApiError(
      403,
      "Access Denied: This account belongs to the Client Portal."
    );
  }

  // 4. Verify Password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  // 5. Generate Token
  const token = signToken(user._id, user.clientID, user.role, deviceId);

  // 6. Update Login History & Audit Logs
  const now = new Date();
  user.currentDeviceId = deviceId;
  user.currentToken = token;
  user.lastLogin = now;
  user.loginHistory.push(now);
  user.auditLogs.push({
    action: "login",
    performedBy: new mongoose.Types.ObjectId(user._id),
    timestamp: new Date(),
    details: "User logged in to Management Portal",
  });

  await user.save();

  // 7. Sanitize User Object
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.__v;
  delete safeUser.loginHistory;
  delete safeUser.auditLogs;
  safeUser.access = [...(user.access || [])];

  // 8. CALCULATE STATS (Only needed for Management Portal)
  let stats = {};

  if (user.role === "SuperAdmin") {
    const totalPartners = await User.countDocuments({
      role: "Partner",
      status: { $ne: "delete" },
    });

    const clients = await User.find({
      role: "Client",
      createdBy: user._id,
      status: { $ne: "delete" },
    }).select("_id");

    const clientIDs = clients.map((c) => c._id);

    const totalUsers = await User.countDocuments({
      clientID: { $in: clientIDs },
      status: { $ne: "delete" },
    });

    const allClients = await User.find({
      role: "Client",
      status: { $ne: "delete" },
    }).select("_id");

    const allClientIDs = allClients.map((c) => c._id);

    const allTotalUsers = await User.countDocuments({
      clientID: { $in: allClientIDs },
      status: { $ne: "delete" },
    });

    stats = {
      totalPartners,
      totalClients: clientIDs.length,
      totalUsers,
      totalAllClients: allClientIDs.length,
      totalAllUsers: allTotalUsers,
    };
  } else if (user.role === "Partner") {
    const clients = await User.find({
      parent: user._id,
      role: "Client",
      status: { $ne: "delete" },
    }).select("_id");

    const clientIDs = clients.map((c) => c._id);

    const totalUsers = await User.countDocuments({
      clientID: { $in: clientIDs },
      status: { $ne: "delete" },
    });

    stats = {
      totalClients: clientIDs.length,
      totalUsers,
    };
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { token, user: safeUser, stats },
        "Management Portal Login successful"
      )
    );
});
exports.logout = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  user.currentToken = null;
  user.currentDeviceId = null;

  user.auditLogs.push({
    action: "logout",
    performedBy: new mongoose.Types.ObjectId(id),
    timestamp: new Date(),
    details: "User logged out",
  });
  await user.save();

  res
    .status(200)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const WINDOW = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

exports.sendResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const PORTAL_ROLE_MAP = {
      "client-portal": ["Admin", "Client", "Salesman", "Customer"],
      "management-portal": ["SuperAdmin", "Partner", "SubPartner"],
    };

    const portal = req.headers["auth-source"] || "client-portal";
    console.log(portal, "portaltype");
    console.log(email, "email");
    const user = await User.findOne({ email });
    if (user.status === "inactive") {
      throw new ApiError(403, "Account Inactive. Please contact support.");
    }
    if (user.status === "delete") {
      throw new ApiError(403, "Account Not Found. Please contact support.");
    }

    console.log(user, "userrole");
    console.log(!user, "user");
    if (!user) {
      console.log(`Attempted OTP request for non-existent email: ${email}`);
      return res.status(200).json({
        message: "If the email is registered, an OTP has been sent.",
        attemptsLeft: MAX_ATTEMPTS,
        window: WINDOW / 1000,
      });
    }
    const allowedRoles = PORTAL_ROLE_MAP[portal];

    if (!allowedRoles) {
      throw new ApiError(400, "Invalid auth-source");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ApiError(
        403,
        `Access Denied: This account does not belong to the ${portal}.`
      );
    }
    // if(portal==="client-portal"){
    //   const allowedRoles = ["Admin", "Client", "Salesman", "Customer"];
    //   if (!allowedRoles.includes(user.role)) {
    //     throw new ApiError(
    //       403,
    //       "Access Denied: This account belongs to the Management Portal."
    //     );
    //   }
    // }else if(portal==="management-portal"){

    //   const allowedRoles = ["SuperAdmin", "Partner", "SubPartner"];
    //   if (!allowedRoles.includes(user.role)) {
    //     throw new ApiError(
    //       403,
    //       "Access Denied: This account belongs to the Client Portal."
    //     );
    //   }}

    const now = Date.now();
    let otpRecord = await OTP.findOne({ email });
    let attemptsLeft = MAX_ATTEMPTS;

    if (otpRecord) {
      if (now - otpRecord.firstRequestAt < WINDOW) {
        // Still within the 5-minute window
        if (otpRecord.attempts >= MAX_ATTEMPTS) {
          attemptsLeft = 0;
          return res.status(429).json({
            message: `Too many OTP requests (${MAX_ATTEMPTS} attempts). Try again after 5 minutes.`,
            attemptsLeft: 0,
          });
        }

        // Increase counter and overwrite OTP
        otpRecord.attempts += 1;
        attemptsLeft = MAX_ATTEMPTS - otpRecord.attempts;
      } else {
        // Window expired, reset counter
        otpRecord.attempts = 1;
        otpRecord.firstRequestAt = now;
        attemptsLeft = MAX_ATTEMPTS - 1;
      }

      // Generate New OTP and Expiration
      otpRecord.otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpRecord.expiresAt = now + WINDOW;
      otpRecord.isVerified = false; // Reset verification status
      await otpRecord.save();
    }

    // --- Create New OTP Record ---
    else {
      otpRecord = await OTP.create({
        email,
        otp: Math.floor(100000 + Math.random() * 900000).toString(),
        expiresAt: now + WINDOW,
        attempts: 1,
        firstRequestAt: now,
        isVerified: false,
      });
      attemptsLeft = MAX_ATTEMPTS - 1;
    }

    // --- Send Email ---
    await sendEmail({
      to: email,
      subject: "Your Password Reset Verification Code",
      html: generateOTPTemplate(otpRecord.otp, WINDOW / 60000), // Send time in minutes
    });

    return res.json({
      message: "OTP sent successfully.",
      attemptsLeft,
      window: WINDOW / 1000, // Return window in seconds
    });
  } catch (err) {
    console.log("Error sending OTP:", err);
    res.status(500).json({
      message: err?.message || "An error occurred while sending OTP.",
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const now = Date.now();

    const record = await OTP.findOne({ email });

    if (!record) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    // 1. Check for expiration
    if (now > record.expiresAt) {
      // Optional: Delete expired record
      await OTP.deleteOne({ _id: record._id });
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new code." });
    }

    // 2. Check for matching OTP value
    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // 3. Mark as verified and save
    record.isVerified = true;
    await record.save();

    // Note: The OTP record is not deleted here; it's needed for the resetPassword step.
    // It is deleted after the password is successfully reset.

    return res.json({
      message: "OTP verified successfully. Proceed to set new password.",
    });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({ message: "An error occurred during verification." });
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

const ALLOWED_CHAIN = {
  SuperAdmin: ["Partner", "Client"],
  Partner: ["SubPartner", "Client"],
  SubPartner: ["Client"],
  Client: [],
  ClientAdmin: [],
};

function isValidParentChild(parentRole, childRole) {
  return ALLOWED_CHAIN[parentRole]?.includes(childRole);
}

function buildUserTree(users, clientUserCounts) {
  const map = new Map();

  users.forEach((u) => {
    map.set(u._id.toString(), { ...u, children: [] });
  });

  const roots = [];

  users.forEach((u) => {
    const id = u._id.toString();
    const node = map.get(id);
    if (u.role === "Client") {
      node.totalUsers = clientUserCounts[id] || 0;
      node.children = [];
    }

    if (u.parent && map.has(u.parent.toString())) {
      const parentNode = map.get(u.parent.toString());

      if (isValidParentChild(parentNode.role, u.role)) {
        parentNode.children.push(node);
      }
    } else {
      if (u.role === "SuperAdmin") {
        roots.push(node);
      }
    }
  });

  return roots;
}

exports.getUserHierarchy = async (req, res) => {
  try {
    const users = await User.find(
      {},
      "_id name email role status parent clientID partnerType"
    ).lean();

    const superAdmins = users.filter((u) => u.role === "SuperAdmin");

    const clientUserCounts = {};
    users.forEach((u) => {
      if (u.clientID) {
        const cid = u.clientID.toString();
        clientUserCounts[cid] = (clientUserCounts[cid] || 0) + 1;
      }
    });
    const globalCounts = users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    const final = superAdmins.map((sa) => {
      const queue = [sa];
      const related = new Map();
      related.set(sa._id.toString(), sa);

      while (queue.length) {
        const current = queue.shift();
        const currentId = current._id.toString();

        const children = users.filter(
          (u) => u.parent?.toString() === currentId
        );

        children.forEach((child) => {
          if (isValidParentChild(current.role, child.role)) {
            const cid = child._id.toString();
            if (!related.has(cid)) {
              related.set(cid, child);
              queue.push(child);
            }
          }
        });
      }
      const roleCounts = {};
      [...related.values()].forEach((u) => {
        roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
      });

      const hierarchy = buildUserTree([...related.values()], clientUserCounts);

      return {
        superAdmin: sa.name,
        superAdminId: sa._id,
        counts: roleCounts,
        hierarchy,
      };
    });

    res.status(200).json({
      success: true,
      count: final.length,
      data: final,
      globalCounts,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.convertDemoToLive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit } = req.body;
  const performedBy = req.user.id;
  const role = req.user.role;
  const performerInfo = await User.findById(performedBy);
  if (!["SuperAdmin", "Partner", "SubPartner"].includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized",
    });
  }
  const user = await User.findById(id);
  if (!user || !user.isDemo) {
    throw new ApiError(400, "Invalid demo client");
  }

  // demo → live basic flags
  user.isDemo = false;
  user.demoExpiry = null;
  user.demoPeriod = 0;
  user.maxDemoDays = undefined;

  // 🔑 STEP 1: reserve 1 limit for client itself
  const totalLimit = limit;
  const usableLimit = totalLimit - 1; // client khud

  // STEP 2: client ke users lao
  const clientUsers = await User.find({
    parent: user._id,
    role: { $ne: "Client" },
  });
  const totalUsersCount = clientUsers.length + 1;
  // Step 2: assign remaining limit to client
  const finalClientLimit = totalLimit - totalUsersCount;

  if (usableLimit < 0) {
    // extreme case: limit = 0
    // saare users block
    await User.updateMany(
      { parent: user._id },
      {
        $set: {
          blocked: true,
          status: "inactive",
        },
      }
    );
  } else if (clientUsers.length > usableLimit) {
    // limit kam hai → extra users block
    const usersToBlock = clientUsers.slice(usableLimit);

    const blockIds = usersToBlock.map((u) => u._id);

    await User.updateMany(
      { _id: { $in: blockIds } },
      {
        $set: {
          blocked: true,
          status: "inactive",
        },
      }
    );
  }

  // STEP 3: client limit set karo
  user.limit = finalClientLimit >= 0 ? finalClientLimit : 0;

  user.demoHistory.push({
    action: "converted",
    performedBy: req.user.id,
  });
  let limitOwner = null;

  if (["Partner", "SubPartner"].includes(performerInfo.role)) {
    limitOwner = performerInfo;
  }

  if (performerInfo.role === "SuperAdmin" && user.parent) {
    const parentUser = await User.findById(user.parent);

    if (parentUser && ["Partner", "SubPartner"].includes(parentUser.role)) {
      limitOwner = parentUser;
    }
  }

  if (limitOwner) {
    const availableLimit = limitOwner.limit || 0;

    if (limit > availableLimit) {
      throw new ApiError(
        400,
        `Limit exceeded. ${limitOwner.role} has only ${availableLimit} remaining.`
      );
    }

    await User.updateOne({ _id: limitOwner._id }, { $inc: { limit: -limit } });
  }

  if (typeof limit === "number") {
    const previousLimit = user.limit || 0;
    // user.limit = limit;

    user.limitHistory.push({
      performedBy,
      initialLimit: limit,
      // previousLimit,
      newLimit: user.limit,
      action: "assigned",
      remarks: "Limit assigned during demo to live conversion",
    });
  }

  user.auditLogs.push({
    action: "update",
    performedBy,
    description: "Demo client converted to live account",
    changes: {
      isDemo: { from: true, to: false },
      demoExpiry: { from: user.demoExpiry, to: null },
    },
  });
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "User",
    action: "update",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "demo to client updated successfully",
    changes: {
      isDemo: { from: true, to: false },
      demoExpiry: { from: user.demoExpiry, to: null },
    },
    ipAddress,
  });
  await user.save();

  res.json({
    success: true,
    message:
      "Demo client converted to live. Some users may be blocked due to insufficient limit.",
  });
});

exports.extendDemoClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { extendDays, remarks } = req.body;

  const performedBy = req.user.id;
  const role = req.user.role;

  if (!extendDays || extendDays <= 0) {
    return res.status(400).json({
      success: false,
      message: "Extend days must be greater than zero",
    });
  }

  if (!["SuperAdmin", "Partner", "SubPartner"].includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to extend demo",
    });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  /* ===============================
     Demo validation
  =============================== */
  if (!user.isDemo) {
    return res.status(400).json({
      success: false,
      message: "This user is not a demo account",
    });
  }

  if (!user.demoExpiry) {
    return res.status(400).json({
      success: false,
      message: "Demo expiry not set",
    });
  }

  // ❌ Block extension if demo expired
  if (new Date() > new Date(user.demoExpiry)) {
    return res.status(400).json({
      success: false,
      message: "Demo has expired and cannot be extended",
    });
  }

  /* ===============================
     Role-based demo cap
  =============================== */
  if (role !== "SuperAdmin") {
    const maxDays = req.user.maxDemoDays || 0;
    if (extendDays > maxDays) {
      return res.status(400).json({
        success: false,
        message: `You can extend demo by maximum ${maxDays} days`,
      });
    }
  }

  /* ===============================
     Extend demo
  =============================== */
  const oldExpiry = user.demoExpiry;

  user.demoExpiry = new Date(
    new Date(user.demoExpiry).getTime() + extendDays * 24 * 60 * 60 * 1000
  );

  user.demoPeriod = (user.demoPeriod || 0) + Number(extendDays);

  /* ===============================
     Demo History
  =============================== */
  user.demoHistory.push({
    action: "extended",
    performedBy,
    remarks: remarks || `Demo extended by ${extendDays} days`,
  });

  /* ===============================
     Audit Logs
  =============================== */
  user.auditLogs.push({
    action: "EXTEND_DEMO",
    performedBy,
    description: "Demo period extended",
    changes: {
      demoExpiry: {
        from: oldExpiry,
        to: user.demoExpiry,
      },
    },
  });
  await createAuditLog({
    module: "User",
    action: "update",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "demo to client updated successfully",
    changes: {
      demoExpiry: {
        from: oldExpiry,
        to: user.demoExpiry,
      },
    },
    ipAddress,
  });
  await user.save();

  res.status(200).json({
    success: true,
    message: "Demo extended successfully",
    data: {
      demoExpiry: user.demoExpiry,
      demoPeriod: user.demoPeriod,
    },
  });
});

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("-password -__v -loginHistory -auditLogs")
    .populate({
      path: "createdBy",
      select: "email name",
    });

  if (!user) throw new ApiError(404, "User not found");

  let clientLimit = null;

  if (user.clientID) {
    const client = await User.findById(user.clientID);
    if (client) {
      clientLimit = client.limit;
    }
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ...user.toObject(),
        clientLimit,
      },
      "Fetched current user successfully"
    )
  );
});
