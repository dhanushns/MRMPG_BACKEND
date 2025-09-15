import * as cron from 'node-cron';
import { calculatePreviousMonthStats } from './expenseStatsCalculator';

/**
 * Expense Stats Scheduler
 * Runs calculations automatically using cron jobs
 */
class ExpenseStatsScheduler {
  private monthlyStatsJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Initialize the scheduler with all cron jobs
   */
  public init(): void {
    try {
      // Schedule monthly stats calculation for 1st day of each month at 12:00 AM
      this.scheduleMonthlyStatsCalculation();
      
      this.isRunning = true;
    } catch (error) {
      console.error('Failed to initialize Expense Stats Scheduler:', error);
    }
  }

  /**
   * Schedule monthly expense stats calculation
   * Runs on 1st day of each month at 12:00 AM (00:00)
   * Cron expression: '0 0 1 * *' (minute hour day-of-month month day-of-week)
   */
  private scheduleMonthlyStatsCalculation(): void {
    try {
      this.monthlyStatsJob = cron.schedule('0 0 1 * *', async () => {
        console.log('Starting monthly expense stats calculation...');
        
        try {
          const startTime = new Date();
          
          // Calculate stats for the previous completed month
          const results = await calculatePreviousMonthStats();
          
          const endTime = new Date();
          const duration = endTime.getTime() - startTime.getTime();
          
          console.log(`Monthly expense stats completed - Processed ${results.length} PG types in ${duration}ms`);
          
        } catch (error) {
          console.error('Error in scheduled monthly expense stats calculation:', error);
          
          // Log detailed error for debugging
          if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
        }
      }, {
        timezone: 'Asia/Kolkata' // Indian Standard Time
      });
      
    } catch (error) {
      console.error('Failed to schedule monthly stats calculation:', error);
      throw error;
    }
  }

  /**
   * Start the scheduler (activate all cron jobs)
   */
  public start(): void {
    try {
      if (!this.isRunning) {
        this.init();
      }

      if (this.monthlyStatsJob) {
        this.monthlyStatsJob.start();
        console.log('Monthly expense stats calculation job started');
      }

    } catch (error) {
      console.error('Failed to start Expense Stats Scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop the scheduler (deactivate all cron jobs)
   */
  public stop(): void {
    try {
      console.log('Stopping Expense Stats Scheduler');

      if (this.monthlyStatsJob) {
        this.monthlyStatsJob.stop();
        console.log('Monthly expense stats calculation job stopped');
      }

      this.isRunning = false;
      console.log('Expense Stats Scheduler stopped');
    } catch (error) {
      console.error('Error stopping Expense Stats Scheduler:', error);
    }
  }

  /**
   * Manually trigger monthly stats calculation (for testing or immediate execution)
   */
  public async triggerMonthlyCalculation(): Promise<void> {
    try {
      console.log('Manually triggering monthly expense stats calculation');
      
      const startTime = new Date();
      const results = await calculatePreviousMonthStats();
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      console.log(`Manual calculation completed - ${results.length} PG types processed in ${duration}ms`);
      
    } catch (error) {
      console.error('Error in manual expense stats calculation:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    isRunning: boolean;
    monthlyJobRunning: boolean;
    nextMonthlyRun: string | null;
  } {
    return {
      isRunning: this.isRunning,
      monthlyJobRunning: this.monthlyStatsJob !== null,
      nextMonthlyRun: this.getNextRunTime()
    };
  }

  /**
   * Get next scheduled run time
   */
  private getNextRunTime(): string | null {
    try {
      // Calculate next 1st day of the month at 12:00 AM
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
      return nextMonth.toISOString();
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return null;
    }
  }

  /**
   * Destroy the scheduler and clean up resources
   */
  public destroy(): void {
    try {
      console.log(' Destroying Expense Stats Scheduler...');
      
      this.stop();
      
      if (this.monthlyStatsJob) {
        this.monthlyStatsJob.destroy();
        this.monthlyStatsJob = null;
      }
      
      console.log('Expense Stats Scheduler destroyed');
    } catch (error) {
      console.error('Error destroying Expense Stats Scheduler:', error);
    }
  }
}

// Create and export singleton instance
export const expenseStatsScheduler = new ExpenseStatsScheduler();

// Export the class for testing purposes
export { ExpenseStatsScheduler };

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down expense stats scheduler');
  expenseStatsScheduler.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down expense stats scheduler');
  expenseStatsScheduler.destroy();
  process.exit(0);
});