import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  ImageType,
  createImageUploadResult,
  deleteImage,
} from "../utils/imageUpload";
import { Gender, RentType, PgType } from "@prisma/client";
import {
  PersonalDataValidation,
  CreateMemberRequest,
  SubmitPaymentRequest,
} from "../types/request";

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
      orderBy: [{ type: "asc" }, { location: "asc" }],
    });

    // Create options array with pgId as value and location as label
    const options = pgs
      .filter((pg) => pg.location) // Filter out null/undefined locations
      .map((pg) => ({
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
    const options = rooms.map((room) => ({
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
    const documentImage = files?.documentImage?.[0];

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
      dateOfRelieving: req.body.dateOfRelieving, // Optional (only for short-term rent)
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
      if (documentImage)
        await deleteImage(documentImage.filename, ImageType.DOCUMENT);

      res.status(400).json({
        success: false,
        message: "Missing required fields",
        error: `Required fields missing: ${missingFields.join(", ")}`,
      });
      return;
    }

    // Check if both images are provided
    if (!profileImage || !documentImage) {
      // Clean up any uploaded files
      if (profileImage)
        await deleteImage(profileImage.filename, ImageType.PROFILE);
      if (documentImage)
        await deleteImage(documentImage.filename, ImageType.DOCUMENT);

      res.status(400).json({
        success: false,
        message: "Both profile and document images are required",
        error: "Please upload both profile image and document image",
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
      if (documentImage)
        await deleteImage(documentImage.filename, ImageType.DOCUMENT);

      res.status(400).json({
        success: false,
        message: "Invalid PG location or type",
        error:
          "The specified PG location and type do not match any existing PG",
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
        where: { email: registrationData.email },
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
    const documentImageResult = createImageUploadResult(
      documentImage,
      ImageType.DOCUMENT
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
        documentUrl: documentImageResult.url,
        rentType: registrationData.rentType,
        pgType: registrationData.pgType,
        dateOfRelieving: registrationData.dateOfRelieving
          ? new Date(registrationData.dateOfRelieving)
          : null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Registration completed successfully",
      data: {
        member: newRegisteredMember,
        images: {
          profile: profileImageResult,
          document: documentImageResult,
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
    if (aadharImage)
      await deleteImage(aadharImage.filename, ImageType.DOCUMENT);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to complete registration",
    });
  }
};
