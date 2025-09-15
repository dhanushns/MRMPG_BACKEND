import { Request, Response } from "express";
import prisma from "../config/prisma";
import { ApiResponse } from "../types/response";
import { AuthenticatedMemberRequest } from "./userController";

// Upload payment
export const uploadPayment = async (req: AuthenticatedMemberRequest, res: Response): Promise<void> => {
  try {
    const memberId = req.member?.id;
    const { 
      amount, 
      paymentMethod, 
      month, 
      year,
      rentBillScreenshot,
      electricityBillScreenshot 
    } = req.body;

    if (!memberId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      } as ApiResponse<null>);
      return;
    }

    // Find member with PG and room details
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        pg: true,
        room: true,
      },
    });

    if (!member) {
      res.status(404).json({
        success: false,
        message: 'Member not found',
      } as ApiResponse<null>);
      return;
    }

    if (!member.isActive) {
      res.status(403).json({
        success: false,
        message: 'Member account is inactive',
      } as ApiResponse<null>);
      return;
    }

    if (!member.pgId || !member.pg) {
      res.status(400).json({
        success: false,
        message: 'Member is not assigned to any PG',
      } as ApiResponse<null>);
      return;
    }

    // Check if payment already exists for this month/year
    const existingPayment = await prisma.payment.findFirst({
      where: {
        memberId: memberId,
        month: month,
        year: year,
      },
      orderBy: {
        attemptNumber: 'desc',
      },
    });

    // Determine attempt number
    let attemptNumber = 1;
    if (existingPayment) {
      if (existingPayment.paymentStatus === 'PENDING' && existingPayment.approvalStatus === 'PENDING') {
        // Update existing payment
        const updatedPayment = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: amount,
            paymentMethod: paymentMethod,
            rentBillScreenshot: paymentMethod === 'ONLINE' ? rentBillScreenshot : null,
            electricityBillScreenshot: paymentMethod === 'ONLINE' ? electricityBillScreenshot : null,
            paidDate: new Date(),
            updatedAt: new Date(),
          },
        });

        res.status(200).json({
          success: true,
          message: 'Payment updated successfully',
          data: {
            paymentId: updatedPayment.id,
            amount: updatedPayment.amount,
            paymentMethod: updatedPayment.paymentMethod,
            month: updatedPayment.month,
            year: updatedPayment.year,
            attemptNumber: updatedPayment.attemptNumber,
            status: 'Updated - Pending Approval',
          },
        } as ApiResponse<any>);
        return;
      } else {
        // Create new attempt
        attemptNumber = existingPayment.attemptNumber + 1;
      }
    }

    // Use existing payment's due dates if available, otherwise calculate new ones
    let dueDate: Date;
    let overdueDate: Date;
    
    if (existingPayment) {
      // Use the same due dates from existing payment for this month/year
      dueDate = existingPayment.dueDate;
      overdueDate = existingPayment.overdueDate;
    } else {
      // Calculate due dates based on member's joining date
      const joiningDate = member.dateOfJoining;
      const joiningDay = joiningDate.getDate();
      
      // Due date is on the same day as joining date in the payment month
      dueDate = new Date(year, month - 1, joiningDay);
      
      if (dueDate.getMonth() !== month - 1) {
        dueDate = new Date(year, month, 0); // Last day of the payment month
      }
      
      // Overdue date is 7 days after due date
      overdueDate = new Date(dueDate);
      overdueDate.setDate(dueDate.getDate() + 7);
    }

    // Create new payment record
    const payment = await prisma.payment.create({
      data: {
        memberId: memberId,
        pgId: member.pgId,
        month: month,
        year: year,
        amount: amount,
        dueDate: dueDate,
        overdueDate: overdueDate,
        rentBillScreenshot: paymentMethod === 'ONLINE' ? rentBillScreenshot : null,
        electricityBillScreenshot: paymentMethod === 'ONLINE' ? electricityBillScreenshot : null,
        paidDate: new Date(),
        paymentMethod: paymentMethod,
        attemptNumber: attemptNumber,
        paymentStatus: 'PAID',
        approvalStatus: 'PENDING',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Payment uploaded successfully and is pending approval',
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        month: payment.month,
        year: payment.year,
        attemptNumber: payment.attemptNumber,
        status: 'Paid - Pending Approval',
        paidDate: payment.paidDate,
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error('Upload payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    } as ApiResponse<null>);
  }
};

// Get member payments history
export const getMemberPayments = async (req: AuthenticatedMemberRequest, res: Response): Promise<void> => {
  try {
    const memberId = req.member?.id;
    const { page = 1, limit = 10 } = req.query;

    if (!memberId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      } as ApiResponse<null>);
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: { memberId: memberId },
        include: {
          pg: {
            select: {
              name: true,
              location: true,
            },
          },
        },
        orderBy: [
          { year: 'desc' },
          { month: 'desc' },
          { attemptNumber: 'desc' },
        ],
        skip: skip,
        take: Number(limit),
      }),
      prisma.payment.count({
        where: { memberId: memberId },
      }),
    ]);

    const paymentsWithStatus = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      month: payment.month,
      year: payment.year,
      attemptNumber: payment.attemptNumber,
      paymentStatus: payment.paymentStatus,
      approvalStatus: payment.approvalStatus,
      paidDate: payment.paidDate,
      dueDate: payment.dueDate,
      overdueDate: payment.overdueDate,
      rejectedReason: payment.rejectedReason,
      approvedAt: payment.approvedAt,
      pg: payment.pg,
      createdAt: payment.createdAt,
    }));

    res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: {
        payments: paymentsWithStatus,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalCount,
          hasMore: skip + payments.length < totalCount,
        },
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error('Get member payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    } as ApiResponse<null>);
  }
};

// Get specific payment details by month and year
export const getPaymentDetails = async (req: AuthenticatedMemberRequest, res: Response): Promise<void> => {
  try {
    const memberId = req.member?.id;
    const { month, year } = req.params;

    if (!memberId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      } as ApiResponse<null>);
      return;
    }

    // Find the latest payment attempt for the specified month and year
    const payment = await prisma.payment.findFirst({
      where: {
        memberId: memberId,
        month: parseInt(month),
        year: parseInt(year),
      },
      include: {
        pg: {
          select: {
            name: true,
            location: true,
          },
        },
        member: {
          select: {
            name: true,
            memberId: true,
            room: {
              select: {
                roomNo: true,
                rent: true,
              },
            },
          },
        },
      },
      orderBy: {
        attemptNumber: 'desc', // Get the latest attempt
      },
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        message: `No payment found for ${month}/${year}`,
      } as ApiResponse<null>);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Payment details retrieved successfully',
      data: payment,
    } as ApiResponse<any>);

  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    } as ApiResponse<null>);
  }
};

// Get member payment status by year
export const getMemberPaymentsByYear = async (req: AuthenticatedMemberRequest, res: Response): Promise<void> => {
  try {
    const memberId = req.member?.id;
    const { year } = req.params;

    if (!memberId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      } as ApiResponse<null>);
      return;
    }

    // Find member to get joining date
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        dateOfJoining: true,
        isActive: true,
      },
    });

    if (!member) {
      res.status(404).json({
        success: false,
        message: 'Member not found',
      } as ApiResponse<null>);
      return;
    }

    const requestedYear = parseInt(year);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12

    const joiningDate = member.dateOfJoining;
    const joiningYear = joiningDate.getFullYear();
    const joiningMonth = joiningDate.getMonth() + 1; // 1-12

    // Determine start and end months for the requested year
    let startMonth = 1;
    let endMonth = 12;

    // If requested year is the joining year, start from joining month
    if (requestedYear === joiningYear) {
      startMonth = joiningMonth;
    }

    // If requested year is the current year, end at current month
    if (requestedYear === currentYear) {
      endMonth = currentMonth;
    }

    // If requested year is before joining year or after current year, return empty
    if (requestedYear < joiningYear || requestedYear > currentYear) {
      res.status(200).json({
        success: true,
        message: 'No payment data available for the requested year',
        data: {
          year: requestedYear,
          months: [],
        },
      } as ApiResponse<any>);
      return;
    }

    // Get all payments for the member in the requested year
    const payments = await prisma.payment.findMany({
      where: {
        memberId: memberId,
        year: requestedYear,
        month: {
          gte: startMonth,
          lte: endMonth,
        },
      },
      select: {
        month: true,
        paymentStatus: true,
        approvalStatus: true,
        attemptNumber: true,
      },
      orderBy: [
        { month: 'asc' },
        { attemptNumber: 'desc' },
      ],
    });

    // Group payments by month and get only the latest attempt for each month
    const latestPaymentsByMonth = new Map<number, any>();
    payments.forEach(payment => {
      if (!latestPaymentsByMonth.has(payment.month) || 
          latestPaymentsByMonth.get(payment.month).attemptNumber < payment.attemptNumber) {
        latestPaymentsByMonth.set(payment.month, payment);
      }
    });

    // Month names array
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Create response for each month
    const monthsData = [];
    for (let month = startMonth; month <= endMonth; month++) {
      // Get the latest payment attempt for this month
      const monthPayment = latestPaymentsByMonth.get(month);
      
      let status = 'No Payment'; // Default status
      
      if (monthPayment) {
        // Determine final status based on payment and approval status
        if (monthPayment.approvalStatus === 'APPROVED') {
          status = 'Approved';
        } else if (monthPayment.approvalStatus === 'REJECTED') {
          status = 'Rejected';
        } else if (monthPayment.paymentStatus === 'PAID' && monthPayment.approvalStatus === 'PENDING') {
          status = 'Pending';
        } else if (monthPayment.paymentStatus === 'PENDING') {
          status = 'Pending';
        }
      }

      monthsData.push({
        month: `${monthNames[month - 1]} ${requestedYear}`,
        status: status,
        monthNumber: month,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        year: requestedYear,
        joiningMonth: joiningMonth,
        joiningYear: joiningYear,
        months: monthsData,
      },
    } as ApiResponse<any>);

  } catch (error) {
    console.error('Get member payments by year error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    } as ApiResponse<null>);
  }
};