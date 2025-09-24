import { logger } from './logger';
import { config } from '../config/environment';

export interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  source: string;
}

export interface AlertingConfig {
  enableConsoleAlerts: boolean;
  enableWebhookAlerts: boolean;
  webhookUrl?: string;
  criticalErrorThreshold: number;
  errorRateThreshold: number;
  memoryThreshold: number;
}

/**
 * Alerting service for critical system events
 */
export class AlertingService {
  private config: AlertingConfig;
  private errorCount = 0;
  private lastErrorReset = Date.now();
  private readonly errorResetInterval = 5 * 60 * 1000; // 5 minutes

  constructor(alertConfig?: Partial<AlertingConfig>) {
    this.config = {
      enableConsoleAlerts: true,
      enableWebhookAlerts: false,
      criticalErrorThreshold: 5,
      errorRateThreshold: 10, // errors per 5 minutes
      memoryThreshold: 90, // percentage
      ...alertConfig,
    };

    // Set webhook URL from environment if available
    if (process.env['ALERT_WEBHOOK_URL']) {
      this.config.webhookUrl = process.env['ALERT_WEBHOOK_URL'];
      this.config.enableWebhookAlerts = true;
    }
  }

  /**
   * Send an alert
   */
  async sendAlert(alert: Omit<Alert, 'timestamp'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      timestamp: new Date().toISOString(),
    };

    // Always log the alert
    this.logAlert(fullAlert);

    // Send to external systems if configured
    if (this.config.enableWebhookAlerts && this.config.webhookUrl) {
      await this.sendWebhookAlert(fullAlert);
    }

    // Track error count for rate limiting
    if (alert.level === 'error' || alert.level === 'critical') {
      this.errorCount++;
    }
  }

  /**
   * Send critical error alert
   */
  async sendCriticalError(title: string, error: Error, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title,
      message: error.message,
      source: 'scraper-service',
      metadata: {
        stack: error.stack,
        ...metadata,
      },
    });
  }

  /**
   * Send error alert
   */
  async sendError(title: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      level: 'error',
      title,
      message,
      source: 'scraper-service',
      metadata: metadata || {},
    });
  }

  /**
   * Send warning alert
   */
  async sendWarning(title: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      level: 'warning',
      title,
      message,
      source: 'scraper-service',
      metadata: metadata || {},
    });
  }

  /**
   * Send info alert
   */
  async sendInfo(title: string, message: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      level: 'info',
      title,
      message,
      source: 'scraper-service',
      metadata: metadata || {},
    });
  }

  /**
   * Check system health and send alerts if needed
   */
  async checkSystemHealth(): Promise<void> {
    try {
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
      const usedMemory = memoryUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      if (memoryPercentage > this.config.memoryThreshold) {
        await this.sendWarning(
          'High Memory Usage',
          `Memory usage is at ${memoryPercentage.toFixed(2)}%`,
          {
            memoryUsage: {
              used: usedMemory,
              total: totalMemory,
              percentage: memoryPercentage,
            },
          }
        );
      }

      // Check error rate
      const now = Date.now();
      if (now - this.lastErrorReset > this.errorResetInterval) {
        if (this.errorCount > this.config.errorRateThreshold) {
          await this.sendWarning(
            'High Error Rate',
            `${this.errorCount} errors in the last ${this.errorResetInterval / 60000} minutes`,
            {
              errorCount: this.errorCount,
              timeWindow: this.errorResetInterval,
            }
          );
        }
        
        // Reset error count
        this.errorCount = 0;
        this.lastErrorReset = now;
      }

    } catch (error) {
      logger.error('Failed to check system health for alerting', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log alert to console/file
   */
  private logAlert(alert: Alert): void {
    const logData = {
      alert: alert.title,
      level: alert.level,
      message: alert.message,
      source: alert.source,
      timestamp: alert.timestamp,
      ...alert.metadata,
    };

    switch (alert.level) {
      case 'critical':
      case 'error':
        logger.error(`ALERT: ${alert.title}`, logData);
        break;
      case 'warning':
        logger.warn(`ALERT: ${alert.title}`, logData);
        break;
      case 'info':
        logger.info(`ALERT: ${alert.title}`, logData);
        break;
    }
  }

  /**
   * Send alert to webhook
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) {
      return;
    }

    try {
      const payload = {
        text: `🚨 ${alert.level.toUpperCase()}: ${alert.title}`,
        attachments: [
          {
            color: this.getAlertColor(alert.level),
            fields: [
              {
                title: 'Message',
                value: alert.message,
                short: false,
              },
              {
                title: 'Source',
                value: alert.source,
                short: true,
              },
              {
                title: 'Timestamp',
                value: alert.timestamp,
                short: true,
              },
            ],
          },
        ],
      };

      // Add metadata fields if present
      if (alert.metadata) {
        const metadataFields = Object.entries(alert.metadata).map(([key, value]) => ({
          title: key,
          value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
          short: true,
        }));
        payload.attachments?.[0]?.fields?.push(...metadataFields);
      }

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      logger.debug('Alert sent to webhook', {
        level: alert.level,
        title: alert.title,
        webhookUrl: this.config.webhookUrl,
      });

    } catch (error) {
      logger.error('Failed to send webhook alert', {
        error: error instanceof Error ? error.message : String(error),
        alert: alert.title,
        level: alert.level,
      });
    }
  }

  /**
   * Get color for alert level
   */
  private getAlertColor(level: Alert['level']): string {
    switch (level) {
      case 'critical':
        return '#ff0000'; // Red
      case 'error':
        return '#ff6600'; // Orange
      case 'warning':
        return '#ffcc00'; // Yellow
      case 'info':
        return '#0066cc'; // Blue
      default:
        return '#808080'; // Gray
    }
  }

  /**
   * Get current error rate
   */
  getErrorRate(): number {
    const timeElapsed = Date.now() - this.lastErrorReset;
    const timeWindow = Math.min(timeElapsed, this.errorResetInterval);
    return timeWindow > 0 ? (this.errorCount / timeWindow) * this.errorResetInterval : 0;
  }

  /**
   * Reset error tracking
   */
  resetErrorTracking(): void {
    this.errorCount = 0;
    this.lastErrorReset = Date.now();
  }
}

// Global alerting service instance
export const alertingService = new AlertingService({
  enableConsoleAlerts: true,
  enableWebhookAlerts: config.NODE_ENV === 'production',
  criticalErrorThreshold: 5,
  errorRateThreshold: 10,
  memoryThreshold: 85,
});

// Enhanced logging functions with alerting
export const logCriticalError = async (title: string, error: Error, metadata?: Record<string, any>) => {
  logger.error(title, { error: error.message, stack: error.stack, ...metadata });
  await alertingService.sendCriticalError(title, error, metadata);
};

export const logHighSeverityError = async (title: string, message: string, metadata?: Record<string, any>) => {
  logger.error(title, { message, ...metadata });
  await alertingService.sendError(title, message, metadata);
};

export const logSystemWarning = async (title: string, message: string, metadata?: Record<string, any>) => {
  logger.warn(title, { message, ...metadata });
  await alertingService.sendWarning(title, message, metadata);
};

// System health monitoring
export const startHealthMonitoring = () => {
  // Check system health every 5 minutes
  setInterval(async () => {
    await alertingService.checkSystemHealth();
  }, 5 * 60 * 1000);

  logger.info('Health monitoring started');
};