import cloudinary from "./cloudinary.js";

/**
 * Upload an image to Cloudinary
 * @param {string} base64Image - Base64 encoded image string
 * @returns {Promise<string|null>} - Returns the secure URL or null if no image
 */
export const uploadImage = async (base64Image) => {
    if (!base64Image) return null;
    const response = await cloudinary.uploader.upload(base64Image);
    return response.secure_url;
};

/**
 * Upload a PDF to Cloudinary
 * @param {string} base64Pdf - Base64 encoded PDF string
 * @returns {Promise<string|null>} - Returns the secure URL or null if no PDF
 */
export const uploadPdf = async (base64Pdf) => {
    if (!base64Pdf) return null;
    const response = await cloudinary.uploader.upload(base64Pdf, { resource_type: "raw" });
    return response.secure_url;
};

/**
 * Upload an audio file to Cloudinary
 * @param {string} base64Audio - Base64 encoded audio string
 * @returns {Promise<string|null>} - Returns the secure URL or null if no audio
 */
export const uploadAudio = async (base64Audio) => {
    if (!base64Audio) return null;
    const response = await cloudinary.uploader.upload(base64Audio, { resource_type: "video" });
    return response.secure_url;
};

/**
 * Upload an avatar image to Cloudinary (with folder option for group avatars)
 * @param {string} base64Avatar - Base64 encoded avatar string
 * @param {string} folder - Optional folder name (default: "group_avatars")
 * @returns {Promise<string|null>} - Returns the secure URL or null if no avatar
 */
export const uploadAvatar = async (base64Avatar, folder = "group_avatars") => {
    if (!base64Avatar) return null;
    const response = await cloudinary.uploader.upload(base64Avatar, { folder });
    return response.secure_url;
};

/**
 * Upload a profile picture to Cloudinary
 * @param {string} base64ProfilePic - Base64 encoded profile picture string
 * @returns {Promise<string|null>} - Returns the secure URL or null if no profile pic
 */
export const uploadProfilePic = async (base64ProfilePic) => {
    if (!base64ProfilePic) return null;
    const response = await cloudinary.uploader.upload(base64ProfilePic);
    return response.secure_url;
};
