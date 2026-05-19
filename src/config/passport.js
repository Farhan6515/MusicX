const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || false);
  } catch (error) {
    done(error, null);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'missing-client-id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing-client-secret',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const primaryEmail = profile.emails?.[0]?.value || '';
    const avatar = profile.photos?.[0]?.value || '';

    const user = await User.findOneAndUpdate(
      { googleId: profile.id },
      {
        googleId: profile.id,
        displayName: profile.displayName || primaryEmail.split('@')[0] || 'MusicX Listener',
        email: primaryEmail,
        avatar,
        provider: 'google',
        lastLoginAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));
