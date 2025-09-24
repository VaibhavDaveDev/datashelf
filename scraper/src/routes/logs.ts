import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface LogQuery {
  level?: 'error' | 'warn' | 'info' | 'debug';
  component?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  search?: string;
}

/**
 * Search and retrieve logs
 */
router.get('/', async (req, res) => {
  try {
    const query: LogQuery = {};
    
    const levelParam = req.query['level'] as string;
    if (levelParam && ['error', 'warn', 'info', 'debug'].includes(levelParam)) {
      query.level = levelParam as 'error' | 'warn' | 'info' | 'debug';
    }
    if (req.query['component']) {
      query.component = req.query['component'] as string;
    }
    if (req.query['startTime']) {
      query.startTime = req.query['startTime'] as string;
    }
    if (req.query['endTime']) {
      query.endTime = req.query['endTime'] as string;
    }
    query.limit = parseInt(req.query['limit'] as string) || 100;
    if (req.query['search']) {
      query.search = req.query['search'] as string;
    }

    // In production, logs would be stored in files or external log aggregation service
    // For now, return recent in-memory logs with filtering
    const logs = await getFilteredLogs(query);

    res.status(200).json({
      logs,
      total: logs.length,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve logs', { error });
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Get log statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const timeRange = req.query['range'] as string || '1h';
    
    // Mock log statistics - in production this would query actual log storage
    const stats = {
      timeRange,
      timestamp: new Date().toISOString(),
      counts: {
        total: 0,
        error: 0,
        warn: 0,
        info: 0,
        debug: 0,
      },
      components: {
        scraper: 0,
        crawler: 0,
        queue: 0,
        database: 0,
        storage: 0,
      },
      topErrors: [],
      recentActivity: [],
    };

    res.status(200).json(stats);
  } catch (error) {
    logger.error('Failed to get log statistics', { error });
    res.status(500).json({
      error: 'Failed to get log statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Stream logs in real-time (Server-Sent Events)
 */
router.get('/stream', (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const level = req.query['level'] as string;
  const component = req.query['component'] as string;

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
    filters: { level, component },
  })}\n\n`);

  // In a full implementation, this would hook into the logging system
  // to stream real-time logs. For now, send periodic heartbeats
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    })}\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    res.end();
  });
});

/**
 * Export logs (for backup/analysis)
 */
router.get('/export', async (req, res) => {
  try {
    const format = req.query['format'] as string || 'json';
    const startTime = req.query['startTime'] as string;
    const endTime = req.query['endTime'] as string;

    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Supported formats: json, csv',
      });
    }

    const logs = await getFilteredLogs({
      startTime,
      endTime,
      limit: 10000, // Large limit for export
    });

    const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json({
        exportedAt: new Date().toISOString(),
        totalLogs: logs.length,
        filters: { startTime, endTime },
        logs,
      });
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Convert logs to CSV
      const csvHeader = 'timestamp,level,component,message,metadata\n';
      const csvRows = logs.map(log => 
        `"${log.timestamp}","${log.level}","${log.component || ''}","${log.message}","${JSON.stringify(log.metadata || {})}"`
      ).join('\n');
      
      return res.send(csvHeader + csvRows);
    }
    
    // Should not reach here, but add return for TypeScript
    return res.status(400).json({ error: 'Invalid format' });
  } catch (error) {
    logger.error('Failed to export logs', { error });
    return res.status(500).json({
      error: 'Failed to export logs',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Helper function to get filtered logs
 * In production, this would query a log storage system
 */
async function getFilteredLogs(query: LogQuery): Promise<any[]> {
  // Mock implementation - in production this would:
  // 1. Query log files or log aggregation service (ELK, Splunk, etc.)
  // 2. Apply filters for level, component, time range, search terms
  // 3. Return paginated results
  
  const mockLogs = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'scraper',
      message: 'Scraping job completed successfully',
      metadata: {
        jobId: 'job-123',
        duration: 5000,
        itemsScraped: 25,
      },
    },
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'warn',
      component: 'queue',
      message: 'Queue processing delayed',
      metadata: {
        queueSize: 150,
        delay: 2000,
      },
    },
    {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      level: 'error',
      component: 'database',
      message: 'Connection timeout',
      metadata: {
        timeout: 30000,
        retryAttempt: 2,
      },
    },
  ];

  // Apply filters
  let filteredLogs = mockLogs;

  if (query.level) {
    filteredLogs = filteredLogs.filter(log => log.level === query.level);
  }

  if (query.component) {
    filteredLogs = filteredLogs.filter(log => log.component === query.component);
  }

  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.message.toLowerCase().includes(searchTerm) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchTerm)
    );
  }

  if (query.startTime) {
    const startTime = new Date(query.startTime);
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startTime);
  }

  if (query.endTime) {
    const endTime = new Date(query.endTime);
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= endTime);
  }

  // Apply limit
  if (query.limit) {
    filteredLogs = filteredLogs.slice(0, query.limit);
  }

  return filteredLogs;
}

export { router as logsRoutes };