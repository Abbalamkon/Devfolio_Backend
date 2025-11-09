const { body, param, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Validation rules for different routes
const validations = {
  // Auth validations
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    validate
  ],

  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
    validate
  ],

  // Project validations
  createProject: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required'),
    body('demo_url')
      .optional()
      .trim()
      .isURL().withMessage('Demo URL must be valid'),
    body('github_url')
      .optional()
      .trim()
      .isURL().withMessage('GitHub URL must be valid'),
    validate
  ],

  updateProject: [
    param('id')
      .isUUID().withMessage('Invalid project ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
    body('description')
      .optional()
      .trim(),
    body('demo_url')
      .optional()
      .trim()
      .isURL().withMessage('Demo URL must be valid'),
    body('github_url')
      .optional()
      .trim()
      .isURL().withMessage('GitHub URL must be valid'),
    validate
  ],

  // User profile validations
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('bio')
      .optional()
      .trim(),
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    validate
  ],

  // Portfolio validations
  updatePortfolio: [
    body('summary')
      .optional()
      .trim(),
    body('experience')
      .optional()
      .trim(),
    body('education')
      .optional()
      .trim(),
    body('skills')
      .optional()
      .isArray().withMessage('Skills must be an array'),
    body('featured_projects')
      .optional()
      .isArray().withMessage('Featured projects must be an array'),
    validate
  ],

  // Message validations
  sendMessage: [
    body('recipient_id')
      .notEmpty().withMessage('Recipient ID is required')
      .isUUID().withMessage('Invalid recipient ID'),
    body('message')
      .trim()
      .notEmpty().withMessage('Message cannot be empty')
      .isLength({ max: 5000 }).withMessage('Message must be less than 5000 characters'),
    validate
  ],

  // Username param validation
  usernameParam: [
    param('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Invalid username format'),
    validate
  ],

  // UUID param validation
  uuidParam: [
    param('id')
      .isUUID().withMessage('Invalid ID format'),
    validate
  ]
};

module.exports = validations;