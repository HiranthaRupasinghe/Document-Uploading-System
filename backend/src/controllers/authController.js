const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

// Username validation: strictly lowercase letters only, no spaces, numbers, or uppercase
const validateUsername = (username) => {
  const usernameRegex = /^[a-z]+$/;
  return usernameRegex.test(username);
};

// Password validation: exactly 8 to 12 chars, >=1 uppercase, >=1 digit, >=1 special symbol
const validatePassword = (password) => {
  if (password.length < 8 || password.length > 12) {
    return false;
  }
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUppercase && hasDigit && hasSpecial;
};

const signup = async (req, res) => {
  const { name, username, password, securityQuestion, securityAnswer } = req.body;

  if (!name || !username || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'Name, username, password, security question, and answer are required.' });
  }

  if (!validateUsername(username)) {
    return res.status(400).json({
      message: 'Username must contain strictly lowercase letters only (no numbers, spaces, or uppercase letters).'
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      message: 'Password must be exactly between 8 and 12 characters long, containing at least one uppercase letter, one number, and one special character.'
    });
  }

  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);
    const result = await dbRun(
      'INSERT INTO users (name, username, password, security_question, security_answer) VALUES (?, ?, ?, ?, ?)',
      [name, username, hashedPassword, securityQuestion, hashedAnswer]
    );

    const token = jwt.sign({ id: result.lastID, username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully.',
      token,
      user: { id: result.lastID, username, name }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error during signup.' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username, name: user.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
};

const forgotPassword = async (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;

  if (!username || !newPassword || !securityAnswer) {
    return res.status(400).json({ message: 'Username, security answer, and new password are required.' });
  }

  if (!validatePassword(newPassword)) {
    return res.status(400).json({
      message: 'New password must be exactly between 8 and 12 characters long, containing at least one uppercase letter, one number, and one special character.'
    });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.security_answer) {
      return res.status(400).json({ message: 'No security question configured for this user.' });
    }

    const isAnswerMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.security_answer);
    if (!isAnswerMatch) {
      return res.status(400).json({ message: 'Incorrect security answer.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    res.json({ message: 'Password has been successfully updated.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error during password reset.' });
  }
};

const getSecurityQuestion = async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const user = await dbGet('SELECT security_question FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ securityQuestion: user.security_question || 'No security question configured.' });
  } catch (error) {
    console.error('Get security question error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

const verifySecurityAnswer = async (req, res) => {
  const { username, securityAnswer } = req.body;

  if (!username || !securityAnswer) {
    return res.status(400).json({ message: 'Username and security answer are required.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.security_answer) {
      return res.status(400).json({ message: 'No security question configured for this user.' });
    }

    const isAnswerMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.security_answer);
    if (!isAnswerMatch) {
      return res.status(400).json({ message: 'Incorrect security answer.' });
    }

    res.json({ success: true, message: 'Security answer verified.' });
  } catch (error) {
    console.error('Verify security answer error:', error);
    res.status(500).json({ message: 'Internal server error during verification.' });
  }
};

const updateProfile = async (req, res) => {
  const { name, username, securityQuestion, securityAnswer, oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!name || !username || !securityQuestion) {
    return res.status(400).json({ message: 'Name, username, and security question are required.' });
  }

  if (!validateUsername(username)) {
    return res.status(400).json({
      message: 'Username must contain strictly lowercase letters only (no numbers, spaces, or uppercase letters).'
    });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const existingUser = await dbGet('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND id != ?', [username, userId]);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    let hashedNewPassword = null;
    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect old password.' });
      }

      if (!validatePassword(newPassword)) {
        return res.status(400).json({
          message: 'Password must be exactly between 8 and 12 characters long, containing at least one uppercase letter, one number, and one special character.'
        });
      }

      hashedNewPassword = await bcrypt.hash(newPassword, 10);
    }

    if (securityAnswer && securityAnswer.trim()) {
      const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);
      if (hashedNewPassword) {
        await dbRun(
          'UPDATE users SET name = ?, username = ?, security_question = ?, security_answer = ?, password = ? WHERE id = ?',
          [name, username, securityQuestion, hashedAnswer, hashedNewPassword, userId]
        );
      } else {
        await dbRun(
          'UPDATE users SET name = ?, username = ?, security_question = ?, security_answer = ? WHERE id = ?',
          [name, username, securityQuestion, hashedAnswer, userId]
        );
      }
    } else {
      if (hashedNewPassword) {
        await dbRun(
          'UPDATE users SET name = ?, username = ?, security_question = ?, password = ? WHERE id = ?',
          [name, username, securityQuestion, hashedNewPassword, userId]
        );
      } else {
        await dbRun(
          'UPDATE users SET name = ?, username = ?, security_question = ? WHERE id = ?',
          [name, username, securityQuestion, userId]
        );
      }
    }

    res.json({
      message: 'Profile updated successfully.',
      user: { id: userId, username, name }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error during profile update.' });
  }
};

module.exports = {
  signup,
  login,
  forgotPassword,
  getSecurityQuestion,
  verifySecurityAnswer,
  updateProfile
};
