import mongoose from 'mongoose';
const { Schema, Types } = mongoose;
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

/* ---------- One-time code (email verification / password reset) ---------- */
const codeSchema = new Schema({ hash: String, expires: Date, attempts: { type: Number, default: 0 }, sentAt: Date }, { _id: false });

/* ---------- User ---------- */
const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    /* Brambo ID: public, unique, searchable handle shown on the profile. */
    bid: { type: String, unique: true, sparse: true },
    bio: { type: String, default: '', maxlength: 160 },
    avatarVer: { type: Number, default: 0 },
    bannerVer: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    emailVerified: { type: Boolean, default: false },
    /* One-time codes are stored as HMAC hashes, never in clear text. */
    emailCode: { type: codeSchema, select: false },
    resetCode: { type: codeSchema, select: false },
    loginCount: { type: Number, default: 0 },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);
userSchema.index({ usernameLower: 1, _id: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1 });
export const User = model('User', userSchema);

/* ---------- Profile images (kept out of the user document) ---------- */
const mediaSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['avatar', 'banner'], required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true }
  },
  { timestamps: true }
);
mediaSchema.index({ user: 1, kind: 1 }, { unique: true });
export const Media = model('Media', mediaSchema);

/* ---------- Follow graph ---------- */
const followSchema = new Schema(
  {
    follower: { type: Types.ObjectId, ref: 'User', required: true },
    following: { type: Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, createdAt: -1 });
followSchema.index({ follower: 1, createdAt: -1 });
export const Follow = model('Follow', followSchema);

/* ---------- Series snapshot embedded in user content ---------- */
const snap = {
  tvId: { type: Number, required: true },
  name: { type: String, required: true, maxlength: 200 },
  posterPath: { type: String, default: '' },
  backdropPath: { type: String, default: '' },
  seasons: { type: Number, default: 0 }
};

/* ---------- Lists: watchlist | later | favourites ---------- */
const listSchema = new Schema(
  { user: { type: Types.ObjectId, ref: 'User', required: true }, list: { type: String, enum: ['watchlist', 'later', 'favourites'], required: true }, ...snap },
  { timestamps: { createdAt: true, updatedAt: false } }
);
listSchema.index({ user: 1, list: 1, tvId: 1 }, { unique: true });
listSchema.index({ user: 1, list: 1, createdAt: -1 });
export const ListItem = model('ListItem', listSchema);

/* ---------- Diary: one entry per season watched ---------- */
const diarySchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    ...snap,
    season: { type: Number, required: true, min: 1, max: 200 },
    episodeCount: { type: Number, required: true, min: 1, max: 1000 },
    runtime: { type: Number, default: 45, min: 1, max: 600 },
    watchedOn: { type: Date, required: true },
    rating: { type: Number, min: 1, max: 10 },
    note: { type: String, default: '', maxlength: 500 },
    rewatch: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
diarySchema.index({ user: 1, watchedOn: -1, createdAt: -1 });
diarySchema.index({ user: 1, tvId: 1, season: 1 });
diarySchema.index({ user: 1, createdAt: -1 });
diarySchema.index({ createdAt: -1 });
export const DiaryEntry = model('DiaryEntry', diarySchema);

/* ---------- Series reviews ---------- */
const reviewSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    ...snap,
    rating: { type: Number, required: true, min: 1, max: 10 },
    text: { type: String, required: true, maxlength: 1000 }
  },
  { timestamps: true }
);
reviewSchema.index({ user: 1, tvId: 1 }, { unique: true });
reviewSchema.index({ tvId: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
export const Review = model('Review', reviewSchema);

/* ---------- Episode ratings (1-10, shown as 0.5-5 popcorn) ---------- */
const ratingSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    tvId: { type: Number, required: true },
    season: { type: Number, required: true, min: 0, max: 200 },
    episode: { type: Number, required: true, min: 1, max: 2000 },
    rating: { type: Number, required: true, min: 1, max: 10 }
  },
  { timestamps: true }
);
ratingSchema.index({ user: 1, tvId: 1, season: 1, episode: 1 }, { unique: true });
ratingSchema.index({ tvId: 1, season: 1, episode: 1 });
ratingSchema.index({ createdAt: -1 });
export const EpisodeRating = model('EpisodeRating', ratingSchema);

/* ---------- Overall series rating (1-10, shown as 0.5-5 popcorn) ---------- */
const seriesRatingSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    tvId: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 10 }
  },
  { timestamps: true }
);
seriesRatingSchema.index({ user: 1, tvId: 1 }, { unique: true });
seriesRatingSchema.index({ tvId: 1 });
seriesRatingSchema.index({ createdAt: -1 });
seriesRatingSchema.index({ user: 1, createdAt: -1 });
export const SeriesRating = model('SeriesRating', seriesRatingSchema);

export const oid = (v) => (Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);
