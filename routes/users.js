const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const validations = require('../middleware/validation');

// @route   GET /api/users
// @desc    Get all users (for discovery/search)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, limit = 20, offset = 0 } = req.query;

    let queryText = `
      SELECT u.id, u.name, u.username, u.bio, u.avatar_url,
             array_agg(DISTINCT us.skill) FILTER (WHERE us.skill IS NOT NULL) as skills,
             COUNT(DISTINCT p.id) as project_count
      FROM users u
      LEFT JOIN user_skills us ON u.id = us.user_id
      LEFT JOIN projects p ON u.id = p.user_id
    `;

    const params = [];
    
    if (search) {
      queryText += ` WHERE u.name ILIKE $1 OR u.username ILIKE $1 OR u.bio ILIKE $1`;
      params.push(`%${search}%`);
    }

    queryText += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// @route   GET /api/users/:username
// @desc    Get user by username
// @access  Public
router.get('/:username', validations.usernameParam, async (req, res) => {
  try {
    const { username } = req.params;

    const result = await query(
      `SELECT u.id, u.name, u.username, u.email, u.bio, u.avatar_url, u.cover_image_url,
              u.created_at,
              array_agg(DISTINCT us.skill) FILTER (WHERE us.skill IS NOT NULL) as skills,
              json_build_object(
                'github', MAX(CASE WHEN sl.platform = 'github' THEN sl.url END),
                'linkedin', MAX(CASE WHEN sl.platform = 'linkedin' THEN sl.url END),
                'twitter', MAX(CASE WHEN sl.platform = 'twitter' THEN sl.url END),
                'website', MAX(CASE WHEN sl.platform = 'website' THEN sl.url END)
              ) as socials,
              COUNT(DISTINCT p.id) as project_count
       FROM users u
       LEFT JOIN user_skills us ON u.id = us.user_id
       LEFT JOIN social_links sl ON u.id = sl.user_id
       LEFT JOIN projects p ON u.id = p.user_id
       WHERE u.username = $1
       GROUP BY u.id`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, validations.updateProfile, async (req, res) => {
  try {
    const { name, bio, avatar_url, cover_image_url, email } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url);
      paramCount++;
    }
    if (cover_image_url !== undefined) {
      updates.push(`cover_image_url = $${paramCount}`);
      values.push(cover_image_url);
      paramCount++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(req.user.id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING id, name, username, email, bio, avatar_url, cover_image_url`,
      values
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// @route   PUT /api/users/skills
// @desc    Update user skills
// @access  Private
router.put('/skills', authenticate, async (req, res) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: 'Skills must be an array'
      });
    }

    await transaction(async (client) => {
      // Delete existing skills
      await client.query('DELETE FROM user_skills WHERE user_id = $1', [req.user.id]);

      // Insert new skills
      if (skills.length > 0) {
        const values = skills.map((skill, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        await client.query(
          `INSERT INTO user_skills (user_id, skill) VALUES ${values}`,
          [req.user.id, ...skills]
        );
      }
    });

    res.json({
      success: true,
      message: 'Skills updated successfully',
      data: { skills }
    });
  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating skills',
      error: error.message
    });
  }
});

// @route   PUT /api/users/socials
// @desc    Update user social links
// @access  Private
router.put('/socials', authenticate, async (req, res) => {
  try {
    const { github, linkedin, twitter, website } = req.body;

    await transaction(async (client) => {
      // Delete existing social links
      await client.query('DELETE FROM social_links WHERE user_id = $1', [req.user.id]);

      // Insert new social links
      const socials = [];
      if (github) socials.push({ platform: 'github', url: github });
      if (linkedin) socials.push({ platform: 'linkedin', url: linkedin });
      if (twitter) socials.push({ platform: 'twitter', url: twitter });
      if (website) socials.push({ platform: 'website', url: website });

      for (const social of socials) {
        await client.query(
          'INSERT INTO social_links (user_id, platform, url) VALUES ($1, $2, $3)',
          [req.user.id, social.platform, social.url]
        );
      }
    });

    res.json({
      success: true,
      message: 'Social links updated successfully',
      data: { github, linkedin, twitter, website }
    });
  } catch (error) {
    console.error('Update socials error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating social links',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.user.id]);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account',
      error: error.message
    });
  }
});

module.exports = router;