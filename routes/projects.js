const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const validations = require('../middleware/validation');

// @route   GET /api/projects
// @desc    Get all projects (feed)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      username, 
      search, 
      limit = 20, 
      offset = 0,
      sort = 'recent' // recent, popular
    } = req.query;

    let queryText = `
      SELECT p.id, p.title, p.description, p.image_url, p.demo_url, p.github_url,
             p.is_featured, p.created_at, p.updated_at,
             u.id as user_id, u.name as author_name, u.username as author_username,
             u.avatar_url as author_avatar
      FROM projects p
      INNER JOIN users u ON p.user_id = u.id
    `;

    const conditions = [];
    const params = [];
    let paramCount = 1;

    // Filter by username
    if (username) {
      conditions.push(`u.username = $${paramCount}`);
      params.push(username);
      paramCount++;
    }

    // Search in title and description
    if (search) {
      conditions.push(`(p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Sorting
    if (sort === 'recent') {
      queryText += ` ORDER BY p.created_at DESC`;
    }

    // Pagination
    queryText += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Format response
    const projects = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      image_url: row.image_url,
      demo_url: row.demo_url,
      github_url: row.github_url,
      is_featured: row.is_featured,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: row.user_id,
        name: row.author_name,
        username: row.author_username,
        avatar_url: row.author_avatar
      }
    }));

    res.json({
      success: true,
      data: projects,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: projects.length
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project by ID
// @access  Public
router.get('/:id', validations.uuidParam, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.id, p.title, p.description, p.image_url, p.demo_url, p.github_url,
              p.is_featured, p.created_at, p.updated_at,
              u.id as user_id, u.name as author_name, u.username as author_username,
              u.avatar_url as author_avatar, u.bio as author_bio
       FROM projects p
       INNER JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const row = result.rows[0];
    const project = {
      id: row.id,
      title: row.title,
      description: row.description,
      image_url: row.image_url,
      demo_url: row.demo_url,
      github_url: row.github_url,
      is_featured: row.is_featured,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: row.user_id,
        name: row.author_name,
        username: row.author_username,
        avatar_url: row.author_avatar,
        bio: row.author_bio
      }
    };

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project',
      error: error.message
    });
  }
});

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', authenticate, validations.createProject, async (req, res) => {
  try {
    const { title, description, image_url, demo_url, github_url } = req.body;

    const result = await query(
      `INSERT INTO projects (user_id, title, description, image_url, demo_url, github_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, title, description, image_url, demo_url, github_url, 
                 is_featured, created_at, updated_at`,
      [req.user.id, title, description, image_url || null, demo_url || null, github_url || null]
    );

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: error.message
    });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update a project
// @access  Private
router.put('/:id', authenticate, validations.updateProject, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, demo_url, github_url, is_featured } = req.body;

    // Check if project exists and belongs to user
    const checkResult = await query(
      'SELECT user_id FROM projects WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (checkResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this project'
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount}`);
      values.push(image_url);
      paramCount++;
    }
    if (demo_url !== undefined) {
      updates.push(`demo_url = $${paramCount}`);
      values.push(demo_url);
      paramCount++;
    }
    if (github_url !== undefined) {
      updates.push(`github_url = $${paramCount}`);
      values.push(github_url);
      paramCount++;
    }
    if (is_featured !== undefined) {
      updates.push(`is_featured = $${paramCount}`);
      values.push(is_featured);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    const result = await query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING id, user_id, title, description, image_url, demo_url, github_url,
                 is_featured, created_at, updated_at`,
      values
    );

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project',
      error: error.message
    });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete a project
// @access  Private
router.delete('/:id', authenticate, validations.uuidParam, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if project exists and belongs to user
    const checkResult = await query(
      'SELECT user_id FROM projects WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (checkResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this project'
      });
    }

    await query('DELETE FROM projects WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project',
      error: error.message
    });
  }
});

// @route   GET /api/projects/user/:username
// @desc    Get all projects by a specific user
// @access  Public
router.get('/user/:username', validations.usernameParam, async (req, res) => {
  try {
    const { username } = req.params;

    const result = await query(
      `SELECT p.id, p.title, p.description, p.image_url, p.demo_url, p.github_url,
              p.is_featured, p.created_at, p.updated_at
       FROM projects p
       INNER JOIN users u ON p.user_id = u.id
       WHERE u.username = $1
       ORDER BY p.created_at DESC`,
      [username]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user projects',
      error: error.message
    });
  }
});

module.exports = router;