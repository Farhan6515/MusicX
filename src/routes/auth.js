const express = require('express');
const passport = require('passport');
const User = require('../models/User');

const router = express.Router();

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/?auth=failed'
}), (req, res) => {
  res.redirect('/?auth=success');
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ user: null });

  res.json({
    user: {
      id: req.user.id,
      name: req.user.displayName,
      email: req.user.email,
      avatar: req.user.avatar,
      provider: req.user.provider
    }
  });
});

router.post('/avatar', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    const { avatar } = req.body;
    if (!avatar || !String(avatar).startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }
    const user = await User.findById(req.user.id);
    user.avatar = avatar;
    await user.save();
    res.json({ avatar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy(() => {
      res.clearCookie('musicx.sid');
      res.json({ ok: true });
    });
  });
});

module.exports = router;
