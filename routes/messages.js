const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validations = require('../middleware/validation');

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (other_user_id)
        CASE 
          WHEN m.sender_id = $1 THEN m.recipient_id 
          ELSE m.sender_id 
        END as other_user_id,
        u.name as other_user_name,
        u.username as other_user_username,
        u.avatar_url as other_user_avatar,
        m.message as last_message,
        m.created_at as last_message_time,
        m.is_read,
        m.sender_id = $1 as sent_by_me
       FROM messages m
       INNER JOIN users u ON (
         CASE 
           WHEN m.sender_id = $1 THEN m.recipient_id 
           ELSE m.sender_id 
         END = u.id
       )
       WHERE m.sender_id = $1 OR m.recipient_id = $1
       ORDER BY other_user_id, m.created_at DESC`,
      [req.user.id]
    );

    const conversations = result.rows.map(row => ({
      user: {
        id: row.other_user_id,
        name: row.other_user_name,
        username: row.other_user_username,
        avatar_url: row.other_user_avatar
      },
      last_message: {
        text: row.last_message,
        time: row.last_message_time,
        is_read: row.is_read,
        sent_by_me: row.sent_by_me
      }
    }));

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
});

// @route   GET /api/messages/:userId
// @desc    Get messages with a specific user
// @access  Private
router.get('/:userId', authenticate, validations.uuidParam, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Check if other user exists
    const userCheck = await query(
      'SELECT id, name, username, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get messages
    const result = await query(
      `SELECT m.id, m.message, m.is_read, m.created_at,
              m.sender_id, m.recipient_id,
              s.name as sender_name, s.username as sender_username, s.avatar_url as sender_avatar
       FROM messages m
       INNER JOIN users s ON m.sender_id = s.id
       WHERE (m.sender_id = $1 AND m.recipient_id = $2)
          OR (m.sender_id = $2 AND m.recipient_id = $1)
       ORDER BY m.created_at ASC
       LIMIT $3 OFFSET $4`,
      [req.user.id, userId, parseInt(limit), parseInt(offset)]
    );

    // Mark messages as read
    await query(
      `UPDATE messages SET is_read = true 
       WHERE recipient_id = $1 AND sender_id = $2 AND is_read = false`,
      [req.user.id, userId]
    );

    const messages = result.rows.map(row => ({
      id: row.id,
      message: row.message,
      is_read: row.is_read,
      created_at: row.created_at,
      sent_by_me: row.sender_id === req.user.id,
      sender: {
        id: row.sender_id,
        name: row.sender_name,
        username: row.sender_username,
        avatar_url: row.sender_avatar
      }
    }));

    res.json({
      success: true,
      data: {
        other_user: userCheck.rows[0],
        messages: messages
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: messages.length
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
});

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', authenticate, validations.sendMessage, async (req, res) => {
  try {
    const { recipient_id, message } = req.body;

    // Check if recipient exists
    const recipientCheck = await query(
      'SELECT id FROM users WHERE id = $1',
      [recipient_id]
    );

    if (recipientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Can't send message to yourself
    if (recipient_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself'
      });
    }

    // Insert message
    const result = await query(
      `INSERT INTO messages (sender_id, recipient_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, recipient_id, message, is_read, created_at`,
      [req.user.id, recipient_id, message]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
});

// @route   GET /api/messages/unread/count
// @desc    Get unread message count
// @access  Private
router.get('/unread/count', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as unread_count FROM messages WHERE recipient_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        unread_count: parseInt(result.rows[0].unread_count)
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
});

// @route   PUT /api/messages/:messageId/read
// @desc    Mark a message as read
// @access  Private
router.put('/:messageId/read', authenticate, validations.uuidParam, async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await query(
      `UPDATE messages SET is_read = true 
       WHERE id = $1 AND recipient_id = $2
       RETURNING id, is_read`,
      [messageId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Message marked as read',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking message as read',
      error: error.message
    });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', authenticate, validations.uuidParam, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Can only delete messages you sent
    const result = await query(
      'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING id',
      [messageId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized to delete'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting message',
      error: error.message
    });
  }
});

module.exports = router;