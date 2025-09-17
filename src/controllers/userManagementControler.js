const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getAllClientUsersWithCompany = asyncHandler(async (req, res) => {
  let clientId = req.user.id; // Logged in user ID
  const result = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(clientId)
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'clientAgent',
        as: 'users'
      }
    },
    {
      $lookup: {
        from: 'companies',
        localField: 'clientAgent', // 🔹 changed from clientAgent
        foreignField: 'client',
        as: 'companies'
      }
    },
    {
      $project: { password: 0 }
    }
    
  ], {
    maxTimeMS: 60000,
    allowDiskUse: true
  });

  res.status(200).json(new ApiResponse(200, result, "Fetched successfully"));
});
exports.getAllClientUsers = asyncHandler(async (req, res) => {
  let clientId = req.user.id; // Logged in user ID
  const result = await User.aggregate(
    [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(clientId)
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'clientAgent',
        as: 'users'
      }
    },
    // {
    //   $lookup: {
    //     from: 'companies',
    //     localField: 'clientAgent', // 🔹 changed from clientAgent
    //     foreignField: 'client',
    //     as: 'companies'
    //   }
    // },
    // {
    //   $project: { password: 0 }
    // },
    {
      $lookup: {
        as: 'users',
        from: 'users',
        foreignField: 'clientAgent',
        localField: 'clientAgent'
      }}
    
  ], {
    maxTimeMS: 60000,
    allowDiskUse: true
  });

  res.status(200).json(new ApiResponse(200, result, "Fetched successfully"));
});
