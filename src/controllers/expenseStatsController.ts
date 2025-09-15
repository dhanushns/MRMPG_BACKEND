import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { ApiResponse } from '../types/response';
import { 
  calculatePreviousMonthStats, 
  recalculateMonthStats,
  getExpenseStatsSummary 
} from '../utils/expenseStatsCalculator';
import { expenseStatsScheduler } from '../utils/expenseStatsScheduler';
import { PgType } from '@prisma/client';

export const triggerExpenseStatsCalculation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month, year } = req.body;

    let results;
    if (month && year) {
      // Calculate for specific month
      results = await recalculateMonthStats(parseInt(month), parseInt(year));
    } else {
      // Calculate for previous month
      results = await calculatePreviousMonthStats();
    }

    res.status(200).json({
      success: true,
      message: 'Expense stats calculation completed successfully',
      data: {
        processedRecords: results.length,
        results
      }
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error triggering expense stats calculation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate expense stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getSchedulerStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = expenseStatsScheduler.getStatus();

    res.status(200).json({
      success: true,
      message: 'Scheduler status retrieved successfully',
      data: status
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getExpenseStatsSummaryByPgType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pgType, year } = req.query;

    if (!pgType || !year) {
      return res.status(400).json({
        success: false,
        message: 'pgType and year are required'
      } as ApiResponse<null>);
    }

    const summary = await getExpenseStatsSummary(pgType as PgType, parseInt(year as string));

    res.status(200).json({
      success: true,
      message: 'Expense stats summary retrieved successfully',
      data: summary
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting expense stats summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get expense stats summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};