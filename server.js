require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");
const { google } = require("googleapis");

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(bodyParser.json());

// CORS middleware (adjust allowed origin as needed)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

// Configure OAuth2 client for Gmail API
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI,
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

async function sendEmail({ referrerName, referrerEmail, refereeName, course }) {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const emailLines = [
      `From: "Accredian Team" <${process.env.GMAIL_USER}>`,
      `To: ${referrerEmail}`,
      "Subject: Referral Confirmation",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      `Hello ${referrerName},`,
      "",
      `Thank you for referring ${refereeName} for the course: ${course}. We will get in touch soon.`,
      "",
      "Best Regards,",
      "Accredian Team",
    ];

    const message = emailLines.join("\n");
    // Base64 encode the message
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });
    console.log("Email sent:", response.data);
  } catch (error) {
    console.error("Error sending email via Gmail API:", error);
  }
}

app.post("/api/referrals", async (req, res) => {
  const { referrerName, referrerEmail, refereeName, refereeEmail, course } =
    req.body;

  // Basic validation
  if (
    !referrerName ||
    !referrerEmail ||
    !refereeName ||
    !refereeEmail ||
    !course
  ) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Save referral data to PostgreSQL using Prisma
    const referral = await prisma.referral.create({
      data: { referrerName, referrerEmail, refereeName, refereeEmail, course },
    });

    // Send referral email using Gmail API
    await sendEmail({ referrerName, referrerEmail, refereeName, course });

    res
      .status(200)
      .json({ message: "Referral submitted successfully!", referral });
  } catch (error) {
    console.error("Error processing referral:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
