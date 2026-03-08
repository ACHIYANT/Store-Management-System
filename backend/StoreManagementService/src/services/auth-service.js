const jwt = require('jsonwebtoken');
const db = require('../models'); // Assuming Sequelize or any ORM is used to fetch users

// Fetch user by ID (assuming you have a User model in your database)
const getUserById = async (userId) => {
  try {
    const user = await db.User.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    throw new Error('Error fetching user');
  }
};

module.exports = { getUserById };

