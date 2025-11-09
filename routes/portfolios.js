const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validations = require('../middleware/validation');

// @route   GET /api/portfolios/:username
// @desc    Get portfolio by username
// @access  Public
router.get('/:username', validations.usernameParam, async (req, res) => {
  try {
    const { username } = req.params;

    const result = await query(
      `SELECT 
        p.id, p.summary, p.experience, p.education, p.created_at, p.updated_at,
        u.id as user_id, u.name, u.username, u.bio, u.avatar_url, u.cover_image_url,
        array_agg(DISTINCT us.skill) FILTER (WHERE us.skill IS NOT NULL) as skills,
        json_build_object(
          'github', MAX(CASE WHEN sl.platform = 'github' THEN sl.url END),
          'linkedin', MAX(CASE WHEN sl.platform = 'linkedin' THEN sl.url END),
          'twitter', MAX(CASE WHEN sl.platform = 'twitter' THEN sl.url END),
          'website', MAX(CASE WHEN sl.platform = 'website' THEN sl.url END)
        ) as socials,
        COALESCE(
          json_agg(
            json_build_object(
              'id', proj.id,
              'title', proj.title,
              'description', proj.description,
              'image_url', proj.image_url,
              'demo_url', proj.demo_url,
              'github_url', proj.github_url,
              'created_at', proj.created_at
            )
          ) FILTER (WHERE proj.is_featured = true),
          '[]'
        ) as featured_projects
       FROM portfolios p
       INNER JOIN users u ON p.user_id = u.id
       LEFT JOIN user_skills us ON u.id = us.user_id
       LEFT JOIN social_links sl ON u.id = sl.user_id
       LEFT JOIN projects proj ON u.id = proj.user_id
       WHERE u.username = $1
       GROUP BY p.id, u.id`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    const portfolio = result.rows[0];

    res.json({
      success: true,
      data: {
        id: portfolio.id,
        summary: portfolio.summary,
        experience: portfolio.experience,
        education: portfolio.education,
        skills: portfolio.skills || [],
        socials: portfolio.socials,
        featured_projects: portfolio.featured_projects,
        user: {
          id: portfolio.user_id,
          name: portfolio.name,
          username: portfolio.username,
          bio: portfolio.bio,
          avatar_url: portfolio.avatar_url,
          cover_image_url: portfolio.cover_image_url
        },
        created_at: portfolio.created_at,
        updated_at: portfolio.updated_at
      }
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio',
      error: error.message
    });
  }
});

// @route   GET /api/portfolios/me
// @desc    Get current user's portfolio
// @access  Private
router.get('/me/details', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.summary, p.experience, p.education, p.created_at, p.updated_at,
        u.id as user_id, u.name, u.username, u.bio, u.avatar_url, u.cover_image_url,
        array_agg(DISTINCT us.skill) FILTER (WHERE us.skill IS NOT NULL) as skills,
        json_build_object(
          'github', MAX(CASE WHEN sl.platform = 'github' THEN sl.url END),
          'linkedin', MAX(CASE WHEN sl.platform = 'linkedin' THEN sl.url END),
          'twitter', MAX(CASE WHEN sl.platform = 'twitter' THEN sl.url END),
          'website', MAX(CASE WHEN sl.platform = 'website' THEN sl.url END)
        ) as socials,
        COALESCE(
          json_agg(
            json_build_object(
              'id', proj.id,
              'title', proj.title,
              'description', proj.description,
              'image_url', proj.image_url,
              'demo_url', proj.demo_url,
              'github_url', proj.github_url,
              'is_featured', proj.is_featured,
              'created_at', proj.created_at
            )
          ) FILTER (WHERE proj.id IS NOT NULL),
          '[]'
        ) as projects
       FROM portfolios p
       INNER JOIN users u ON p.user_id = u.id
       LEFT JOIN user_skills us ON u.id = us.user_id
       LEFT JOIN social_links sl ON u.id = sl.user_id
       LEFT JOIN projects proj ON u.id = proj.user_id
       WHERE u.id = $1
       GROUP BY p.id, u.id`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      });
    }

    const portfolio = result.rows[0];

    res.json({
      success: true,
      data: {
        id: portfolio.id,
        summary: portfolio.summary,
        experience: portfolio.experience,
        education: portfolio.education,
        skills: portfolio.skills || [],
        socials: portfolio.socials,
        projects: portfolio.projects,
        user: {
          id: portfolio.user_id,
          name: portfolio.name,
          username: portfolio.username,
          bio: portfolio.bio,
          avatar_url: portfolio.avatar_url,
          cover_image_url: portfolio.cover_image_url
        },
        created_at: portfolio.created_at,
        updated_at: portfolio.updated_at
      }
    });
  } catch (error) {
    console.error('Get my portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio',
      error: error.message
    });
  }
});

// @route   PUT /api/portfolios
// @desc    Update user's portfolio
// @access  Private
router.put('/', authenticate, validations.updatePortfolio, async (req, res) => {
  try {
    const { summary, experience, education, skills, featured_projects } = req.body;

    await transaction(async (client) => {
      // Update portfolio
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (summary !== undefined) {
        updates.push(`summary = $${paramCount}`);
        values.push(summary);
        paramCount++;
      }
      if (experience !== undefined) {
        updates.push(`experience = $${paramCount}`);
        values.push(experience);
        paramCount++;
      }
      if (education !== undefined) {
        updates.push(`education = $${paramCount}`);
        values.push(education);
        paramCount++;
      }

      if (updates.length > 0) {
        values.push(req.user.id);
        await client.query(
          `UPDATE portfolios SET ${updates.join(', ')} WHERE user_id = $${paramCount}`,
          values
        );
      }

      // Update skills if provided
      if (skills !== undefined && Array.isArray(skills)) {
        await client.query('DELETE FROM user_skills WHERE user_id = $1', [req.user.id]);
        
        if (skills.length > 0) {
          const skillValues = skills.map((skill, index) => 
            `($1, $${index + 2})`
          ).join(', ');
          
          await client.query(
            `INSERT INTO user_skills (user_id, skill) VALUES ${skillValues}`,
            [req.user.id, ...skills]
          );
        }
      }

      // Update featured projects if provided
      if (featured_projects !== undefined && Array.isArray(featured_projects)) {
        // First, unfeature all projects
        await client.query(
          'UPDATE projects SET is_featured = false WHERE user_id = $1',
          [req.user.id]
        );

        // Then feature the selected ones
        if (featured_projects.length > 0) {
          const projectIds = featured_projects.map((_, index) => `$${index + 2}`).join(', ');
          await client.query(
            `UPDATE projects SET is_featured = true 
             WHERE user_id = $1 AND id IN (${projectIds})`,
            [req.user.id, ...featured_projects]
          );
        }
      }
    });

    // Fetch updated portfolio
    const result = await query(
      `SELECT p.id, p.summary, p.experience, p.education, p.updated_at,
              array_agg(DISTINCT us.skill) FILTER (WHERE us.skill IS NOT NULL) as skills
       FROM portfolios p
       LEFT JOIN user_skills us ON p.user_id = us.user_id
       WHERE p.user_id = $1
       GROUP BY p.id`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Portfolio updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating portfolio',
      error: error.message
    });
  }
});

// @route   POST /api/portfolios/featured/:projectId
// @desc    Toggle featured status of a project
// @access  Private
router.post('/featured/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check if project belongs to user
    const checkResult = await query(
      'SELECT id, is_featured FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or does not belong to you'
      });
    }

    const currentStatus = checkResult.rows[0].is_featured;

    // Toggle featured status
    const result = await query(
      'UPDATE projects SET is_featured = $1 WHERE id = $2 RETURNING is_featured',
      [!currentStatus, projectId]
    );

    res.json({
      success: true,
      message: `Project ${!currentStatus ? 'featured' : 'unfeatured'} successfully`,
      data: {
        project_id: projectId,
        is_featured: result.rows[0].is_featured
      }
    });
  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating featured status',
      error: error.message
    });
  }
});

module.exports = router;