import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';
import { ApiResponse } from '../types/response';
import { PgType, EntryType, PaymentMethod } from '@prisma/client';
import path from 'path';

export const addExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entryType, amount, date, partyName, paymentType, remarks, pgId } = req.body;
    const adminId = req.admin!.id;

    // Handle file uploads for bills (up to 3 files)
    let attachedBill1, attachedBill2, attachedBill3;
    
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      
      // Save file paths - simplified handling
      if (files[0]) attachedBill1 = files[0].path || files[0].filename;
      if (files[1]) attachedBill2 = files[1].path || files[1].filename;
      if (files[2]) attachedBill3 = files[2].path || files[2].filename;
    }

    const expense = await prisma.expense.create({
      data: {
        entryType: entryType as EntryType,
        amount: parseFloat(amount),
        date: new Date(date),
        partyName,
        paymentType: paymentType as PaymentMethod,
        remarks: remarks || null,
        attachedBill1,
        attachedBill2,
        attachedBill3,
        createdBy: adminId,
        pgId,
      },
      include: {
        admin: {
          select: { id: true, name: true, email: true }
        },
        pg: {
          select: { id: true, name: true, type: true, location: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      data: expense
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add expense',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getExpenses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      pgId, 
      entryType, 
      startDate, 
      endDate,
      paymentType,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageSize;

    // Build filter conditions
    const whereConditions: any = {};

    if (pgId) {
      whereConditions.pgId = pgId as string;
    }

    if (entryType) {
      whereConditions.entryType = entryType as EntryType;
    }

    if (paymentType) {
      whereConditions.paymentType = paymentType as PaymentMethod;
    }

    if (startDate || endDate) {
      whereConditions.date = {};
      if (startDate) {
        whereConditions.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereConditions.date.lte = new Date(endDate as string);
      }
    }

    // Get total count for pagination
    const totalExpenses = await prisma.expense.count({
      where: whereConditions
    });

    // Get expenses with pagination and sorting
    const expenses = await prisma.expense.findMany({
      where: whereConditions,
      include: {
        admin: {
          select: { id: true, name: true, email: true }
        },
        pg: {
          select: { id: true, name: true, type: true, location: true }
        }
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc'
      },
      skip,
      take: pageSize
    });

    const totalPages = Math.ceil(totalExpenses / pageSize);

    res.status(200).json({
      success: true,
      message: 'Expenses retrieved successfully',
      data: {
        expenses,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalExpenses,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1
        }
      }
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expenses',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getExpenseById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        admin: {
          select: { id: true, name: true, email: true }
        },
        pg: {
          select: { id: true, name: true, type: true, location: true }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      } as ApiResponse<null>);
    }

    res.status(200).json({
      success: true,
      message: 'Expense retrieved successfully',
      data: expense
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expense',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const updateExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { entryType, amount, date, partyName, paymentType, remarks } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      } as ApiResponse<null>);
    }

    // Handle file uploads for bills (up to 3 files)
    let updateData: any = {
      entryType: entryType as EntryType,
      amount: parseFloat(amount),
      date: new Date(date),
      partyName,
      paymentType: paymentType as PaymentMethod,
      remarks: remarks || null,
    };

    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      
      if (files[0]) updateData.attachedBill1 = files[0].path || files[0].filename;
      if (files[1]) updateData.attachedBill2 = files[1].path || files[1].filename;
      if (files[2]) updateData.attachedBill3 = files[2].path || files[2].filename;
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        admin: {
          select: { id: true, name: true, email: true }
        },
        pg: {
          select: { id: true, name: true, type: true, location: true }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: updatedExpense
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const deleteExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      } as ApiResponse<null>);
    }

    await prisma.expense.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getExpenseStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { month, year } = req.query;

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      } as ApiResponse<null>);
    }

    // Get admin details to know their pgType
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      } as ApiResponse<null>);
    }

    // Use current month/year if not provided
    const now = new Date();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : now.getFullYear();

    // Get expense stats for the requested month/year and pgType
    const expenseStats = await prisma.expenseStats.findUnique({
      where: {
        pgType_month_year: {
          pgType: admin.pgType,
          month: targetMonth,
          year: targetYear,
        },
      },
    });

    // If no stats found, return zero stats
    if (!expenseStats) {
      return res.status(404).json({
        success: false,
        message: `No expense statistics found for ${getMonthName(targetMonth)} ${targetYear}`,
      } as ApiResponse<null>);
    }

    // Helper function to format currency
    const formatCurrency = (amount: number): string => {
      return `₹${amount.toLocaleString("en-IN")}`;
    };

    // Helper function to format numbers
    const formatNumber = (num: number): string => {
      return num.toLocaleString("en-IN");
    };

    // Helper function to get month name
    function getMonthName(monthNum: number): string {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return monthNames[monthNum - 1];
    }

    // Format expense stats as cards
    const cards = [
      {
        title: "Total Cash In",
        value: formatCurrency(expenseStats.totalCashInAmount),
        trend: expenseStats.cashInPercentChange >= 0 ? "up" : "down",
        percentage: Math.abs(Math.round(expenseStats.cashInPercentChange)),
        icon: "trendingUp",
        color: "success",
        subtitle: `${formatNumber(expenseStats.totalCashInCount)} transactions`,
        paymentBreakdown: {
          online: formatCurrency(expenseStats.cashInOnline),
          cash: formatCurrency(expenseStats.cashInCash),
        },
      },
      {
        title: "Total Cash Out",
        value: formatCurrency(expenseStats.totalCashOutAmount),
        trend: expenseStats.cashOutPercentChange >= 0 ? "up" : "down",
        percentage: Math.abs(Math.round(expenseStats.cashOutPercentChange)),
        icon: "trendingDown",
        color: "error",
        subtitle: `${formatNumber(expenseStats.totalCashOutCount)} transactions`,
        paymentBreakdown: {
          online: formatCurrency(expenseStats.cashOutOnline),
          cash: formatCurrency(expenseStats.cashOutCash),
        },
      },
      {
        title: "Net Amount",
        value: formatCurrency(expenseStats.netAmount),
        trend: expenseStats.netPercentChange >= 0 ? "up" : "down",
        percentage: Math.abs(Math.round(expenseStats.netPercentChange)),
        icon: expenseStats.netAmount >= 0 ? "cash" : "minusCircle",
        color: expenseStats.netAmount >= 0 ? "primary" : "warning",
        subtitle: expenseStats.netAmount >= 0 ? "Profit this month" : "Loss this month",
      },
    ];

    const responseData = {
      cards,
      period: {
        month: targetMonth,
        year: targetYear,
        monthName: getMonthName(targetMonth),
      },
      pgType: admin.pgType,
      lastUpdated: expenseStats.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: 'Expense statistics retrieved successfully',
      data: responseData
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting expense stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expense statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};