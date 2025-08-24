import { Request, Response } from "express";
import prisma from "../config/prisma";
import {
  ImageType,
  createImageUploadResult,
  deleteImage,
} from "../utils/imageUpload";
import { Gender, RentType, PgType } from "@prisma/client";
import { PersonalDataValidation, CreateMemberRequest } from "../types/request";

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

// Get all registered members (for admin)
export const getAllRegisteredMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalMembers = await prisma.registeredMember.count();

    // Get paginated registered members
    const registeredMembers = await prisma.registeredMember.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const totalPages = Math.ceil(totalMembers / limit);

    res.status(200).json({
      success: true,
      message: "Registered members retrieved successfully",
      data: registeredMembers,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalMembers,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching registered members:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve registered members",
    });
  }
};

// Get registered member by ID (for admin)
export const getRegisteredMemberById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const registeredMember = await prisma.registeredMember.findUnique({
      where: { id },
    });

    if (!registeredMember) {
      res.status(404).json({
        success: false,
        message: "Registered member not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Registered member retrieved successfully",
      data: registeredMember,
    });
  } catch (error) {
    console.error("Error fetching registered member:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to retrieve registered member",
    });
  }
};

// Delete registered member (for admin)
export const deleteRegisteredMember = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const registeredMember = await prisma.registeredMember.findUnique({
      where: { id },
    });

    if (!registeredMember) {
      res.status(404).json({
        success: false,
        message: "Registered member not found",
      });
      return;
    }

    // Delete associated images
    const deletePromises = [];

    if (registeredMember.photoUrl) {
      const photoFilename = registeredMember.photoUrl.split("/").pop();
      if (photoFilename) {
        deletePromises.push(deleteImage(photoFilename, ImageType.PROFILE));
      }
    }

    if (registeredMember.aadharUrl) {
      const aadharFilename = registeredMember.aadharUrl.split("/").pop();
      if (aadharFilename) {
        deletePromises.push(deleteImage(aadharFilename, ImageType.AADHAR));
      }
    }

    // Wait for all image deletions to complete
    await Promise.all(deletePromises);

    // Delete registered member record
    await prisma.registeredMember.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Registered member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting registered member:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: "Failed to delete registered member",
    });
  }
};
