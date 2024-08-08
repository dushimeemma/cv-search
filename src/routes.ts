import { Router } from "express";
import { google } from "googleapis";
import { authenticate } from "./gmail";
import { searchEmails } from "./search-email";
import { getAttachments } from "./get-attachment";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const auth = await authenticate();
    const query = req.query.q as string;
    const emails = await searchEmails(auth, query);

    const emailDetails = await Promise.all(
      emails.map(async (email) => {
        const attachments = await getAttachments(auth, email.id!);
        const sender =
          email.payload?.headers?.find((header) => header.name === "From")
            ?.value || "";
        const [name, emailAddress] = sender.split("<");

        return {
          id: email.id,
          snippet: email.snippet,
          name: name.trim(),
          email: emailAddress?.replace(">", "").trim(),
          attachments: attachments.map((att) => ({
            mimeType: att.mimeType,
            filename: att.filename,
            downloadUrl: `${req.protocol}://${req.get("host")}/api/download/${
              email.id
            }/${att.attachmentId}/${encodeURIComponent(att.filename || "")}`,
          })),
        };
      })
    );

    res.json(emailDetails);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get(
  "/download/:messageId/:attachmentId/:filename?",
  async (req, res) => {
    try {
      const auth = await authenticate();
      const { messageId, attachmentId, filename } = req.params;

      const gmail = google.gmail({ version: "v1", auth });
      const attachment = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

      if (!attachment.data.data) {
        return res.status(404).send("Attachment not found");
      }

      const buffer = Buffer.from(attachment.data.data, "base64");

      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const safeFilename = filename || `${timestamp}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFilename}"`
      );
      res.send(buffer);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

export default router;
