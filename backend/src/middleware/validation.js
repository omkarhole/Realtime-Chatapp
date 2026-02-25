import Joi from "joi";

export const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({ message: errors });
  }
  next();
};

// Auth schemas
export const signupSchema = Joi.object({
  fullName: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const updateProfileSchema = Joi.object({
  profilePic: Joi.string().required()
});

// Group schemas
export const createGroupSchema = Joi.object({
  name: Joi.string().min(1).trim().required(),
  members: Joi.array().items(Joi.string()).min(1).required(),
  avatar: Joi.string().allow("")
});

export const addMemberSchema = Joi.object({
  userId: Joi.string().required()
});

export const updateGroupSchema = Joi.object({
  name: Joi.string().min(1).trim(),
  avatar: Joi.string().allow("")
});

// Message schemas
export const sendMessageSchema = Joi.object({
  text: Joi.string().allow(""),
  image: Joi.string().allow(""),
  pdf: Joi.string().allow(""),
  audio: Joi.string().allow(""),
  audioDuration: Joi.number(),
  replyTo: Joi.string().allow(null)
});

export const sendGroupMessageSchema = Joi.object({
  text: Joi.string().allow(""),
  image: Joi.string().allow(""),
  pdf: Joi.string().allow(""),
  audio: Joi.string().allow(""),
  audioDuration: Joi.number(),
  replyTo: Joi.string().allow(null)
});

export const addReactionSchema = Joi.object({
  emoji: Joi.string().required()
});

export const searchMessagesSchema = Joi.object({
  q: Joi.string().required()
});
