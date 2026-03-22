import SibApiV3Sdk from "sib-api-v3-sdk";
import logger from "./logger.js";

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export const sendEmail = async ({ to, subject, text }) => {
    // Read at call-time so dotenv.config() has already run
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

    try {
        const response = await emailApi.sendTransacEmail({
            sender: {
                email: process.env.SENDER_EMAIL,
                name: "Chatty"
            },
            to: [{ email: to }],
            subject,
            textContent: text
        });
        return response;
    } catch (error) {
        logger.error("Email API request failed", {
            context: "email.send",
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
};
