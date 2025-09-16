import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';
import { ApiResponse } from '../types/response';
import { PgType, Gender, PaymentMethod } from '@prisma/client';

export const createStaff = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phoneNo, gender, salary, pgId } = req.body;
    const adminId = req.admin!.id;

    // Check if phone number already exists
    const existingStaff = await prisma.staff.findUnique({
      where: { phoneNo }
    });

    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Staff with this phone number already exists'
      } as ApiResponse<null>);
    }

    // Verify PG exists
    const pg = await prisma.pG.findUnique({
      where: { id: pgId }
    });

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: 'PG not found'
      } as ApiResponse<null>);
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        phoneNo,
        gender: gender as Gender,
        salary: parseFloat(salary),
        pgId,
        assignedBy: adminId
      },
      include: {
        pg: {
          select: { id: true, name: true, type: true, location: true }
        },
        admin: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Staff created and assigned successfully',
      data: staff
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create staff',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const updateStaffSalary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newSalary, month, year, paymentType, remarks } = req.body;
    const adminId = req.admin!.id;

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      } as ApiResponse<null>);
    }

    // Check if payment already exists for this month/year
    const existingPayment = await prisma.staffPayment.findUnique({
      where: {
        staffId_month_year: {
          staffId: id,
          month: parseInt(month),
          year: parseInt(year)
        }
      }
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: `Payment for ${month}/${year} already exists for this staff`
      } as ApiResponse<null>);
    }

    // Update staff salary and create payment record
    const [updatedStaff, paymentRecord] = await prisma.$transaction([
      prisma.staff.update({
        where: { id },
        data: { salary: parseFloat(newSalary) }
      }),
      prisma.staffPayment.create({
        data: {
          staffId: id,
          amount: parseFloat(newSalary),
          month: parseInt(month),
          year: parseInt(year),
          paymentDate: new Date(),
          paymentType: paymentType as PaymentMethod,
          remarks: remarks || null,
          paidBy: adminId
        }
      })
    ]);

    res.status(200).json({
      success: true,
      message: 'Staff salary updated and payment recorded successfully',
      data: {
        staff: updatedStaff,
        payment: paymentRecord
      }
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error updating staff salary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff salary',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const deleteStaff = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      } as ApiResponse<null>);
    }

    // Soft delete - set isActive to false
    await prisma.staff.update({
      where: { id },
      data: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: 'Staff deleted successfully'
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getStaffById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        pg: {
          select: { id: true, name: true, type: true, location: true }
        },
        admin: {
          select: { id: true, name: true, email: true }
        },
        paymentHistory: {
          orderBy: { paymentDate: 'desc' },
          take: 5, // Latest 5 payments
          include: {
            admin: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      } as ApiResponse<null>);
    }

    res.status(200).json({
      success: true,
      message: 'Staff retrieved successfully',
      data: staff
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getAllPaymentHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      month, 
      year, 
      paymentType,
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageSize;

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse<null>);
    }

    // Get admin's PG type to filter staff payments
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { pgType: true }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      } as ApiResponse<null>);
    }

    // Build filter conditions
    const whereConditions: any = {
      staff: {
        pg: {
          type: admin.pgType
        },
        isActive: true
      }
    };

    if (month) {
      whereConditions.month = parseInt(month as string);
    }

    if (year) {
      whereConditions.year = parseInt(year as string);
    }

    if (paymentType) {
      whereConditions.paymentType = paymentType as PaymentMethod;
    }

    // Get total count for pagination
    const totalPayments = await prisma.staffPayment.count({
      where: whereConditions
    });

    // Get payments with pagination and sorting
    const payments = await prisma.staffPayment.findMany({
      where: whereConditions,
      include: {
        staff: {
          select: { id: true, name: true, phoneNo: true, gender: true }
        },
        admin: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc'
      },
      skip,
      take: pageSize
    });

    // Flatten the payment data structure
    const flattenedPayments = payments.map(payment => ({
      id: payment.id,
      staffId: payment.staffId,
      amount: payment.amount,
      month: payment.month,
      year: payment.year,
      paymentDate: payment.paymentDate,
      paymentType: payment.paymentType,
      remarks: payment.remarks,
      paidBy: payment.paidBy,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      // Flattened staff fields
      staffName: payment.staff.name,
      staffPhoneNo: payment.staff.phoneNo,
      staffGender: payment.staff.gender,
      // Flattened admin fields
      adminId: payment.admin.id,
      adminName: payment.admin.name,
      adminEmail: payment.admin.email
    }));

    const totalPages = Math.ceil(totalPayments / pageSize);

    res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: flattenedPayments,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: totalPayments,
        totalPages
      }
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment history',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

export const getStaffPaymentHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      month, 
      year, 
      paymentType,
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageSize;

    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      } as ApiResponse<null>);
    }

    // Build filter conditions
    const whereConditions: any = {
      staffId: id
    };

    if (month) {
      whereConditions.month = parseInt(month as string);
    }

    if (year) {
      whereConditions.year = parseInt(year as string);
    }

    if (paymentType) {
      whereConditions.paymentType = paymentType as PaymentMethod;
    }

    // Get total count for pagination
    const totalPayments = await prisma.staffPayment.count({
      where: whereConditions
    });

    // Get payments with pagination and sorting
    const payments = await prisma.staffPayment.findMany({
      where: whereConditions,
      include: {
        staff: {
          select: { id: true, name: true, phoneNo: true, gender: true }
        },
        admin: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        [sortBy as string]: sortOrder as 'asc' | 'desc'
      },
      skip,
      take: pageSize
    });

    // Flatten the payment data structure
    const flattenedPayments = payments.map(payment => ({
      id: payment.id,
      staffId: payment.staffId,
      amount: payment.amount,
      month: payment.month,
      year: payment.year,
      paymentDate: payment.paymentDate,
      paymentType: payment.paymentType,
      remarks: payment.remarks,
      paidBy: payment.paidBy,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      // Flattened staff fields
      staffName: payment.staff.name,
      staffPhoneNo: payment.staff.phoneNo,
      staffGender: payment.staff.gender,
      // Flattened admin fields
      adminId: payment.admin.id,
      adminName: payment.admin.name,
      adminEmail: payment.admin.email
    }));

    const totalPages = Math.ceil(totalPayments / pageSize);

    res.status(200).json({
      success: true,
      message: 'Staff payment history retrieved successfully',
      data: {
        staff: {
          id: staff.id,
          name: staff.name,
          isActive: staff.isActive
        },
        payments: flattenedPayments
      },
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: totalPayments,
        totalPages
      }
    } as ApiResponse<any>);
  } catch (error) {
    console.error('Error getting staff payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff payment history',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse<null>);
  }
};

// Get staff options for dropdown
export const getStaffOptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminPgType = req.admin?.pgType;

    if (!adminPgType) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      } as ApiResponse<null>);
    }

    // Get active staff for admin's PG type
    const staffOptions = await prisma.staff.findMany({
      where: {
        isActive: true,
        pg: {
          type: adminPgType
        }
      },
      select: {
        id: true,
        name: true,
        pg: {
          select: {
            name: true,
            location: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Format for dropdown options
    const formattedOptions = staffOptions.map(staff => ({
      value: staff.id,
      label: staff.name,
      pgName: staff.pg.name,
      pgLocation: staff.pg.location
    }));

    res.status(200).json({
      success: true,
      message: 'Staff options retrieved successfully',
      data: formattedOptions
    } as ApiResponse<any>);

  } catch (error: any) {
    console.error('Error getting staff options:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse<null>);
  }
};

// Bulk update staff salaries
export const bulkUpdateStaffSalary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { staffUpdates, month, year, paymentType } = req.body;
    const adminId = req.admin!.id;
    const adminPgType = req.admin!.pgType;

    const results = [];
    const errors = [];

    // Process each staff update
    for (const update of staffUpdates) {
      try {
        const { staffId, newSalary, remarks } = update;

        // Verify staff exists and belongs to admin's PG type
        const staff = await prisma.staff.findFirst({
          where: {
            id: staffId,
            isActive: true,
            pg: {
              type: adminPgType
            }
          },
          include: {
            pg: {
              select: { id: true, name: true, type: true }
            }
          }
        });

        if (!staff) {
          errors.push({
            staffId,
            error: 'Staff not found or unauthorized'
          });
          continue;
        }

        // Check if payment already exists for this month/year
        const existingPayment = await prisma.staffPayment.findUnique({
          where: {
            staffId_month_year: {
              staffId,
              month,
              year
            }
          }
        });

        if (existingPayment) {
          errors.push({
            staffId,
            staffName: staff.name,
            error: `Payment already exists for ${month}/${year}`
          });
          continue;
        }

        // Create payment record
        const payment = await prisma.staffPayment.create({
          data: {
            staffId,
            amount: newSalary,
            month,
            year,
            paymentDate: new Date(),
            paymentType: paymentType as PaymentMethod,
            remarks: remarks || `Salary payment for ${month}/${year}`,
            paidBy: adminId
          },
          include: {
            staff: {
              select: { id: true, name: true, phoneNo: true }
            }
          }
        });

        // Update staff salary
        await prisma.staff.update({
          where: { id: staffId },
          data: { salary: newSalary }
        });

        results.push({
          staffId,
          staffName: staff.name,
          previousSalary: staff.salary,
          newSalary,
          paymentId: payment.id,
          success: true
        });

      } catch (updateError: any) {
        errors.push({
          staffId: update.staffId,
          error: updateError.message || 'Failed to process update'
        });
      }
    }

    const response = {
      totalRequests: staffUpdates.length,
      successfulUpdates: results.length,
      failedUpdates: errors.length,
      results,
      errors
    };

    // Return appropriate status based on results
    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No staff salaries were updated',
        data: response
      } as ApiResponse<any>);
    } else if (errors.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All staff salaries updated successfully',
        data: response
      } as ApiResponse<any>);
    } else {
      return res.status(207).json({
        success: true,
        message: 'Bulk update completed with some errors',
        data: response
      } as ApiResponse<any>);
    }

  } catch (error: any) {
    console.error('Error in bulk staff salary update:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse<null>);
  }
};