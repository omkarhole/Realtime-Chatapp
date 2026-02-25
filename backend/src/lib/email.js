import SibApiV3Sdk from "sib-api-v3-sdk";

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
        console.error("Email API Error:", error.message);
        throw error;
    }
};
