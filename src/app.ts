import express from "express";
import { authStub } from "./middleware/auth";
import { findResources } from "./data/resources";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(authStub);

  // GET /resources
  // Caller #1 of the shared findResources path.
  // Returns ALL resources — no filtering, no pagination, no input validation.
  // (See CHALLENGE.md, task 1.)
  app.get("/resources", async (req, res, next) => {
    try {
      const { type, status, page, limit } = req.query;
      if (page && (isNaN(Number(page)) || Number(page) < 1)) {
        return res.status(400).json({ error: "Invalid page value" });
      }
      if (limit && (isNaN(Number(limit)) || Number(limit) < 1)) {
        return res.status(400).json({ error: "Invalid limit value" });
      }
      if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      const resources = await findResources({
        viewerId: req.userId,
        offset,
        limit: limitNum,
        type: type as string,
        status: status as string,
      });
      res.json({
        data: resources,
        pagination: {
          page: Number(pageNum),
          limit: Number(limitNum),
          offset,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /resources/recent
  // Caller #2 of the shared findResources path.
  app.get("/resources/recent", async (_req, res, next) => {
    try {
      const resources = await findResources({
        limit: 10,
        orderBy: "created_at desc",
      });
      res.json(resources);
    } catch (err) {
      next(err);
    }
  });

  // GET /users/:userId/resources
  // Caller #3 of the shared findResources path.
  app.get("/users/:userId/resources", async (req, res, next) => {
    try {
      const ownerId = Number(req.params.userId);
      const resources = await findResources({ ownerId });
      res.json(resources);
    } catch (err) {
      next(err);
    }
  });

  return app;
}
