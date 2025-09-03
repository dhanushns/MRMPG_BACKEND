import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  ImageType,
  createImageUploadResult,
  deleteImage,
} from "../utils/imageUpload";
import { Gender, RentType, PgType } from "@prisma/client";
import { PersonalDataValidation, CreateMemberRequest, SubmitPaymentRequest } from "../types/request";

// Get PG location filter options for user registration
export const getPgLocationOptions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get pgType from query parameter (optional filter)
    const pgType = req.query.pgType as PgType;

    // Build where clause
    const whereClause: any = {};
    if (pgType && Object.values(PgType).includes(pgType)) {
      whereClause.type = pgType;
    }

    // Get all PGs with their locations
    const pgs = await prisma.pG.findMany({
      where: whereClause,
      select: {
        id: true,
        location: true,
        name: true,
        type: true,
      },
      orderBy: [
        { type: "asc" },
        { location: "asc" },
      ],
    });

    // Create options array with pgId as value and location as label
    const options = pgs
      .filter(pg => pg.location) // Filter out null/undefined locations
      .map(pg => ({
        value: pg.id,
        label: pg.location,
        pgName: pg.name, // Additional info for frontend
        pgType: pg.type, // Additional info for frontend
      }));

    res.status(200).json({
      success: true,
      message: "PG location options retrieved successfully",
      data: {
        options,
      },
    });
  } catch (error) {
    console.error("Error getting PG location options:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve PG location options",
    });
  }
};

// Get rooms based on PG ID
export const getRoomsByPgId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get pgId from query parameter (required)
    const pgId = req.query.pgId as string;

    if (!pgId) {
      res.status(400).json({
        success: false,
        message: "PG ID is required",
        error: "Please provide a valid PG ID to get rooms",
      });
      return;
    }

    // Verify PG exists
    const pg = await prisma.pG.findUnique({
      where: { id: pgId },
      select: {
        id: true,
        name: true,
        location: true,
        type: true,
      },
    });

    if (!pg) {
      res.status(404).json({
        success: false,
        message: "PG not found",
        error: "No PG found with the provided ID",
      });
      return;
    }

    // Get all rooms for the specified PG
    const rooms = await prisma.room.findMany({
      where: { pGId: pgId },
      select: {
        id: true,
        roomNo: true,
        capacity: true,
        rent: true,
        _count: {
          select: {
            members: true, // Count current members
          },
        },
      },
      orderBy: { roomNo: "asc" },
    });

    // Create options array with roomId as value and roomNo as label
    const options = rooms.map(room => ({
      value: room.id,
      label: room.roomNo,
      capacity: room.capacity,
      currentOccupancy: room._count.members,
      rent: room.rent,
      isAvailable: room._count.members < room.capacity, // Check if room has space
    }));

    res.status(200).json({
      success: true,
      message: "Rooms retrieved successfully",
      data: {
        options,
        pgInfo: {
          id: pg.id,
          name: pg.name,
          location: pg.location,
          type: pg.type,
        },
      },
    });
  } catch (error) {
    console.error("Error getting rooms by PG ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve rooms",
    });
  }
};

export const validatePersonalData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      age,
      gender,
      phone,
      email,
      location,
    }: PersonalDataValidation = req.body;

    // Validate required fields
    if (!name || !age || !gender || !phone || !email || !location) {
      res.status(400).json({
        success: false,
        message: "All personal data fields are required",
        error:
          "Missing required fields: name, age, gender, phone, email, location",
      });
      return;
    }

    const [
      existingMemberByPhone,
      existingMemberByEmail,
      existingRegMemberByPhone,
      existingRegMemberByEmail,
    ] = await Promise.all([
      prisma.member.findUnique({ where: { phone: phone } }),
      prisma.member.findUnique({ where: { email: email } }),
      prisma.registeredMember.findUnique({
        where: { phone: phone },
      }),
      prisma.registeredMember.findUnique({
        where: { email: email },
      }),
    ]);

    // Check for conflicts and clean up images if any found
    if (existingMemberByPhone || existingRegMemberByPhone) {
      res.status(409).json({
        success: false,
        message: "Phone number already exists",
        error: "A member or registration with this phone number already exists",
        field: "phone",
      });
      return;
    }

    if (existingMemberByEmail || existingRegMemberByEmail) {
      res.status(409).json({
        success: false,
        message: "Email already exists",
        error: "A member or registration with this email already exists",
        field: "email",
      });
      return;
    }

    // If validation passes, return success
    res.status(200).json({
      success: true,
      message: "Personal data validation successful",
      data: {
        name,
        age,
        gender,
        phone,
        location,
      },
    });
  } catch (error) {
    console.error("Error validating personal data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to validate personal data",
    });
  }
};

export const completeRegistration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Extract files from multer
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const profileImage = files?.profileImage?.[0];
    const aadharImage = files?.aadharImage?.[0];

    // Parse the registration data from form data
    const registrationData: CreateMemberRequest = {
      name: req.body.name,
      age: parseInt(req.body.age),
      gender: req.body.gender as Gender,
      phone: req.body.phone,
      location: req.body.location,
      email: req.body.email,
      work: req.body.work,
      pgLocation: req.body.pgLocation,
      rentType: req.body.rentType as RentType,
      pgType: req.body.pgType as PgType,
    };

    // Validate required fields
    const requiredFields = [
      "name",
      "age",
      "gender",
      "phone",
      "location",
      "work",
      "email",
      "pgLocation",
      "rentType",
      "pgType",
    ];
    const missingFields = requiredFields.filter(
      (field) => !registrationData[field as keyof CreateMemberRequest]
    );

    if (missingFields.length > 0) {
      // Clean up uploaded files if validation fails
      if (profileImage)
        await deleteImage(profileImage.filename, ImageType.PROFILE);
      if (aadharImage)
        await deleteImage(aadharImage.filename, ImageType.AADHAR);

      res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: `Required fields missing: ${missingFields.join(", ")}`,
      });
      return;
    }

    // Check if both images are provided
    if (!profileImage || !aadharImage) {
      // Clean up any uploaded files
      if (profileImage)
        await deleteImage(profileImage.filename, ImageType.PROFILE);
      if (aadharImage)
        await deleteImage(aadharImage.filename, ImageType.AADHAR);

      res.status(400).json({
        success: false,
        message: "Both profile and aadhar images are required",
        error: "Please upload both profile image and aadhar image",
      });
      return;
    }

    // Check if the pgLocation and pgType correspond to an existing PG
    const existingPG = await prisma.pG.findFirst({
      where: {
        location: registrationData.pgLocation,
        type: registrationData.pgType,
      },
    });

    if (!existingPG) {
      // Clean up uploaded files if PG validation fails
      if (profileImage)
        await deleteImage(profileImage.filename, ImageType.PROFILE);
      if (aadharImage)
        await deleteImage(aadharImage.filename, ImageType.AADHAR);

      res.status(400).json({
        success: false,
        message: "Invalid PG location or type",
        error: "The specified PG location and type do not match any existing PG",
      });
      return;
    }

    // Re-check for duplicate records
     const [
      existingMemberByPhone,
      existingMemberByEmail,
      existingRegMemberByPhone,
      existingRegMemberByEmail,
    ] = await Promise.all([
      prisma.member.findUnique({ where: { phone: registrationData.phone } }),
      prisma.member.findUnique({ where: { email: registrationData.email } }),
      prisma.registeredMember.findUnique({
        where: { phone: registrationData.phone },
      }),
      prisma.registeredMember.findUnique({
        where: { email: registrationData.   email },
      }),
    ]);

    // Check for conflicts and clean up images if any found
    if (existingMemberByPhone || existingRegMemberByPhone) {
      res.status(409).json({
        success: false,
        message: "Phone number already exists",
        error: "A member or registration with this phone number already exists",
        field: "phone",
      });
      return;
    }

    if (existingMemberByEmail || existingRegMemberByEmail) {
      res.status(409).json({
        success: false,
        message: "Email already exists",
        error: "A member or registration with this email already exists",
        field: "email",
      });
      return;
    }

    // Create image upload results
    const profileImageResult = createImageUploadResult(
      profileImage,
      ImageType.PROFILE
    );
    const aadharImageResult = createImageUploadResult(
      aadharImage,
      ImageType.AADHAR
    );

    // Create new registered member record
    const newRegisteredMember = await prisma.registeredMember.create({
      data: {
        name: registrationData.name,
        age: registrationData.age,
        gender: registrationData.gender,
        location: registrationData.location,
        pgLocation: registrationData.pgLocation,
        work: registrationData.work,
        email: registrationData.email,
        phone: registrationData.phone,
        photoUrl: profileImageResult.url,
        aadharUrl: aadharImageResult.url,
        rentType: registrationData.rentType,
        pgType: registrationData.pgType,
      },
    });

    res.status(201).json({
      success: true,
      message: "Registration completed successfully",
      data: {
        member: newRegisteredMember,
        images: {
          profile: profileImageResult,
          aadhar: aadharImageResult,
        },
      },
    });
  } catch (error) {
    console.error("Error completing registration:", error);

    // Clean up uploaded files on error
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const profileImage = files?.profileImage?.[0];
    const aadharImage = files?.aadharImage?.[0];

    if (profileImage)
      await deleteImage(profileImage.filename, ImageType.PROFILE);
    if (aadharImage) await deleteImage(aadharImage.filename, ImageType.AADHAR);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to complete registration",
    });
  }
};

export const submitPayment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Extract files from multer
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const rentBillImage = files?.rentBillScreenshot?.[0];
    const electricityBillImage = files?.electricityBillScreenshot?.[0];

    // Parse the payment data from form data
    const paymentData: SubmitPaymentRequest = {
      name: req.body.name,
      memberId: req.body.memberId,
      roomId: req.body.roomId,
      pgId: req.body.pgId,
    };

    // Validate required fields
    const requiredFields = ["name", "memberId", "roomId", "pgId"];
    const missingFields = requiredFields.filter(
      (field) => !paymentData[field as keyof SubmitPaymentRequest]
    );

    if (missingFields.length > 0) {
      // Clean up uploaded files if validation fails
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: `Required fields missing: ${missingFields.join(", ")}`,
      });
      return;
    }

    // Check if both images are provided
    if (!rentBillImage || !electricityBillImage) {
      // Clean up any uploaded files
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(400).json({
        success: false,
        message: "Both rent bill and electricity bill screenshots are required",
        error: "Please upload both rent bill and electricity bill screenshots",
      });
      return;
    }

    // Validate that the provided PG and Room exist and are related
    const [pg, room] = await Promise.all([
      prisma.pG.findUnique({
        where: { id: paymentData.pgId },
        select: { id: true, name: true, location: true, type: true },
      }),
      prisma.room.findUnique({
        where: { id: paymentData.roomId },
        select: { id: true, roomNo: true, rent: true, pGId: true },
      }),
    ]);

    if (!pg) {
      // Clean up uploaded files if PG not found
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(404).json({
        success: false,
        message: "PG not found",
        error: "No PG found with the provided PG ID",
      });
      return;
    }

    if (!room) {
      // Clean up uploaded files if room not found
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(404).json({
        success: false,
        message: "Room not found",
        error: "No room found with the provided room ID",
      });
      return;
    }

    // Validate that the room belongs to the specified PG
    if (room.pGId !== paymentData.pgId) {
      // Clean up uploaded files if room-PG mismatch
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(400).json({
        success: false,
        message: "Room and PG mismatch",
        error: "The provided room does not belong to the specified PG",
      });
      return;
    }

    // Find the member by memberId
    const member = await prisma.member.findUnique({
      where: { memberId: paymentData.memberId },
      include: {
        pg: {
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNo: true,
            rent: true,
          },
        },
      },
    });

    if (!member) {
      // Clean up uploaded files if member not found
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(404).json({
        success: false,
        message: "Member not found",
        error: "No member found with the provided member ID",
      });
      return;
    }

    // Validate member details match the provided data
    if (
      member.name.toLowerCase() !== paymentData.name.toLowerCase() ||
      member.pg.id !== paymentData.pgId ||
      member.room?.id !== paymentData.roomId
    ) {
      // Clean up uploaded files if validation fails
      if (rentBillImage)
        await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
      if (electricityBillImage)
        await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

      res.status(400).json({
        success: false,
        message: "Member details do not match",
        error: "The provided member details do not match our records",
      });
      return;
    }

    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Calculate due date and overdue date based on member's joining date
    const memberJoiningDate = new Date(member.dateOfJoining);
    const paymentDueDay = memberJoiningDate.getDate();
    const dueDate = new Date(currentYear, currentMonth - 1, paymentDueDay);
    const overdueDate = new Date(dueDate);
    overdueDate.setDate(overdueDate.getDate() + 5);

    // Check if there's an existing payment record for current month
    const existingPayment = await prisma.payment.findFirst({
      where: {
        memberId: member.id,
        month: currentMonth,
        year: currentYear,
      },
    });

    let paymentRecord;

    if (existingPayment) {
      // Handle existing payment record based on approval status
      if (existingPayment.approvalStatus === "APPROVED") {
        // Clean up uploaded files if payment already approved
        if (rentBillImage)
          await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
        if (electricityBillImage)
          await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

        res.status(400).json({
          success: false,
          message: "Payment already approved",
          error: "Payment for this month has already been approved by admin",
        });
        return;
      }

      if (existingPayment.approvalStatus === "PENDING") {
        // Clean up uploaded files if payment is pending approval
        if (rentBillImage)
          await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
        if (electricityBillImage)
          await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

        res.status(400).json({
          success: false,
          message: "Payment already submitted",
          error: "Payment already done and waiting for admin approval",
        });
        return;
      }

      if (existingPayment.approvalStatus === "REJECTED") {
        // Create image upload results for rejected payment retry
        const rentBillResult = createImageUploadResult(
          rentBillImage,
          ImageType.PAYMENT
        );
        const electricityBillResult = createImageUploadResult(
          electricityBillImage,
          ImageType.PAYMENT
        );

        // Update the existing payment record with new payment data
        paymentRecord = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            paymentStatus: "PAID",
            approvalStatus: "PENDING", // Reset to pending for re-approval
            rentBillScreenshot: rentBillResult.url,
            electricityBillScreenshot: electricityBillResult.url,
            paidDate: now,
            attemptNumber: existingPayment.attemptNumber + 1,
            updatedAt: now,
          },
          include: {
            member: {
              select: {
                id: true,
                memberId: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            pg: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        });
      }
    } else {
      // Create image upload results for new payment
      const rentBillResult = createImageUploadResult(
        rentBillImage,
        ImageType.PAYMENT
      );
      const electricityBillResult = createImageUploadResult(
        electricityBillImage,
        ImageType.PAYMENT
      );

      // Create a new payment record
      paymentRecord = await prisma.payment.create({
        data: {
          memberId: member.id,
          pgId: member.pg.id,
          amount: member.room?.rent || 0,
          month: currentMonth,
          year: currentYear,
          dueDate: dueDate,
          overdueDate: overdueDate,
          paymentStatus: "PAID",
          approvalStatus: "PENDING",
          rentBillScreenshot: rentBillResult.url,
          electricityBillScreenshot: electricityBillResult.url,
          paidDate: now,
          attemptNumber: 1,
        },
        include: {
          member: {
            select: {
              id: true,
              memberId: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          pg: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      });
    }

    const messageText = existingPayment && existingPayment.approvalStatus === "REJECTED" 
      ? "Payment resubmitted successfully" 
      : "Payment submitted successfully";

    res.status(200).json({
      success: true,
      message: messageText,
      data: {
        payment: paymentRecord,
        images: {
          rentBill: {
            url: paymentRecord?.rentBillScreenshot,
          },
          electricityBill: {
            url: paymentRecord?.electricityBillScreenshot,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error submitting payment:", error);

    // Clean up uploaded files on error
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const rentBillImage = files?.rentBillScreenshot?.[0];
    const electricityBillImage = files?.electricityBillScreenshot?.[0];

    if (rentBillImage)
      await deleteImage(rentBillImage.filename, ImageType.PAYMENT);
    if (electricityBillImage)
      await deleteImage(electricityBillImage.filename, ImageType.PAYMENT);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to submit payment",
    });
  }
};
