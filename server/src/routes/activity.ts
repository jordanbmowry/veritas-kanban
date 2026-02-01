import { Router, type Router as RouterType } from 'express';
import { activityService } from '../services/activity-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { sendPaginated } from '../middleware/response-envelope.js';

const router: RouterType = Router();

// GET /api/activity - Get recent activities
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 0;
    const activities = await activityService.getActivities(limit);

    // If pagination is requested, use the sendPaginated helper
    if (page > 0) {
      const start = (page - 1) * limit;
      const paged = activities.slice(start, start + limit);
      sendPaginated(res, paged, { page, limit, total: activities.length });
    } else {
      res.json(activities);
    }
  })
);

// DELETE /api/activity - Clear all activities
router.delete(
  '/',
  asyncHandler(async (_req, res) => {
    await activityService.clearActivities();
    res.status(204).send();
  })
);

export default router;
