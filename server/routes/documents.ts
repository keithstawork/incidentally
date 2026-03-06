import type { Express, RequestHandler } from "express";
import multer from "multer";
import { storage } from "../storage";
import { fileStorage, buildDocumentStorageKey } from "../lib/file-storage";
import { parseId } from "../lib/route-helpers";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

export function registerDocumentRoutes(app: Express, auth: RequestHandler): void {
  // List documents for a claim
  app.get("/api/claims/:id/documents", auth, async (req, res) => {
    try {
      const claimId = parseId(req, res);
      if (claimId === null) return;
      const claim = await storage.getClaim(claimId);
      if (!claim) return res.status(404).json({ message: "Claim not found" });
      const list = await storage.getClaimDocuments(claimId);
      res.json(list);
    } catch (error) {
      console.error("Error listing documents:", error);
      res.status(500).json({ message: "Failed to list documents" });
    }
  });

  // Upload a document
  app.post(
    "/api/claims/:id/documents",
    auth,
    upload.single("file"),
    async (req, res) => {
      try {
        const claimId = parseId(req, res);
        if (claimId === null) return;
        const claim = await storage.getClaim(claimId);
        if (!claim) return res.status(404).json({ message: "Claim not found" });

        const file = req.file;
        if (!file || !file.buffer) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const category = (req.body?.category as string) || "other";
        const notes = (req.body?.notes as string) || null;
        const uploadedBy = (req as { user?: { id: string } }).user?.id ?? null;

        const validCategory = [
          "medical",
          "legal",
          "adjuster",
          "insurance",
          "internal",
          "photo",
          "other",
        ].includes(category)
          ? category
          : "other";

        const doc = await storage.createDocument({
          claimId,
          filename: file.originalname || "document",
          mimeType: file.mimetype || null,
          sizeBytes: file.size,
          category: validCategory as "medical" | "legal" | "adjuster" | "insurance" | "internal" | "photo" | "other",
          source: "upload",
          storagePath: "pending",
          uploadedBy: uploadedBy ?? undefined,
          notes: notes ?? undefined,
        });

        const key = buildDocumentStorageKey(claimId, doc.id, file.originalname || "document");
        await fileStorage.upload(key, file.buffer, file.mimetype || "application/octet-stream");
        await storage.updateDocument(doc.id, { storagePath: key });

        const updated = await storage.getDocumentByIdAndClaimId(doc.id, claimId);
        res.status(201).json(updated ?? doc);
      } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Failed to upload document" });
      }
    },
  );

  // Download (redirect to presigned URL or local URL)
  app.get("/api/claims/:id/documents/:docId/download", auth, async (req, res) => {
    try {
      const claimId = parseId(req, res);
      if (claimId === null) return;
      const docIdParam = typeof req.params.docId === "string" ? req.params.docId : String(req.params.docId ?? "");
      const docId = parseInt(docIdParam, 10);
      if (isNaN(docId) || docId <= 0) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      const claim = await storage.getClaim(claimId);
      if (!claim) return res.status(404).json({ message: "Claim not found" });

      const doc = await storage.getDocumentByIdAndClaimId(docId, claimId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const url = await fileStorage.getUrl(doc.storagePath);
      res.redirect(302, url);
    } catch (error) {
      console.error("Error getting document download URL:", error);
      res.status(500).json({ message: "Failed to get document" });
    }
  });

  // Delete document (soft delete + remove from storage)
  app.delete("/api/claims/:id/documents/:docId", auth, async (req, res) => {
    try {
      const claimId = parseId(req, res);
      if (claimId === null) return;
      const docIdParam = typeof req.params.docId === "string" ? req.params.docId : String(req.params.docId ?? "");
      const docId = parseInt(docIdParam, 10);
      if (isNaN(docId) || docId <= 0) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      const doc = await storage.getDocumentByIdAndClaimId(docId, claimId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      await storage.updateDocument(docId, { deletedAt: new Date() });
      try {
        await fileStorage.delete(doc.storagePath);
      } catch (e) {
        console.warn("Failed to delete file from storage:", e);
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });
}
