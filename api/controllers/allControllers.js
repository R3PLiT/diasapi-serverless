import "dotenv/config";
// import fs from "fs";
import createError from "http-errors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import {
  User,
  Institute,
  Course,
  Graduate,
  CertificateTree,
  Certificate,
} from "../models/allModels.js";
import * as utls from "../utils/allUtils.js";
// import {
//   handleMongooseError,
//   isValidObjectId,
//   insertDocuments,
//   hashSHA256,
//   createMerkleTree,
//   treeDump,
//   getProofAll,
//   drawCertificate,
//   mailCertificates,
//   customDate,
//   hashDriveImage,
// } from "../utils/allUtils.js";
import {
  readContractData,
  sendContractTransaction,
} from "../services/connectEthers.js";

// ===== main =====
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, instituteId, userImage } = req.body;

    if (
      !(
        name &&
        email &&
        password &&
        role &&
        ((role === "issuer" && instituteId) ||
          (role !== "issuer" && !instituteId))
      )
    ) {
      return next(createError(400));
    }

    if (instituteId && !utls.isValidObjectId(instituteId)) {
      return next(createError(400, "invalid institute id"));
    }

    if (req.jwt?.role !== "admin" && (role === "admin" || role === "issuer")) {
      // return next(createError(403, "Forbidden"));
      return next(createError(403));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const document = { name, email, password: hashedPassword, role };

    if (role === "issuer" && instituteId) {
      document.instituteId = instituteId;
    }

    if (userImage) {
      const split = userImage.split(",");
      const contentType = split[0];
      const data = Buffer.from(split[1], "base64");
      document.userImage = { data, contentType };
    }

    await User.create(document);

    // res.status(201).json({ message: "User registered successfully" });
    res.status(201).json({ message: "Created" });
  } catch (error) {
    console.error("==== register ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "reigister user Error"));
      next(createError(500));
    }
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select(
      "email name role instituteId userImage +password"
    );
    if (!user) {
      return next(createError(400, "invalid credentials"));
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return next(createError(400, "invalid credentials"));
    }

    const payload = {
      userId: user._id,
      role: user.role,
      instituteId: user.instituteId ? user.instituteId : undefined,
    };

    const token = jwt.sign(payload, process.env.SECRET_ACCESS_TOKEN, {
      expiresIn: process.env.EXPIRES_IN,
    });

    const data = {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      // instituteId: user.instituteId ? user.instituteId : undefined,
      instituteId: user.instituteId || undefined,
      token,
    };

    if (user.userImage.data) {
      const userImage = user.userImage.toObject();
      data.userImage =
        userImage.contentType + "," + userImage.data.toString("base64");
    }

    res.json(data);

    // res.json({ userId: user._id, role: user.role, token });
  } catch (error) {
    console.error("==== login ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "login Error"));
      next(createError(500));
    }
  }
};

export const emailExists = async (req, res, next) => {
  try {
    const { email } = req.params;

    const user = await User.exists({ email });
    if (!user) {
      return next(createError(404, "email does not exists"));
    }

    res.json({ message: `email:${email} exists` });
  } catch (error) {
    console.error("==== emailExists ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      next(createError(500));
    }
  }
};

// ===== users =====
export const userDetail = async (req, res, next) => {
  try {
    const { userId } = req.jwt;
    const user = await User.findById(userId).select(
      "-__v -createdAt -updatedAt"
    );

    if (!user) {
      // return next(createError(404, "no user Found"));
      return next(createError(404));
    }

    const userObj = user.toObject();
    if (userObj.userImage) {
      const imageBase64 =
        userObj.userImage.contentType +
        "," +
        userObj.userImage.data.toString("base64");
      userObj.userImage = imageBase64;
    }

    res.json(userObj);
  } catch (error) {
    console.error("==== userDetail ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

export const getAllUser = async (req, res, next) => {
  try {
    const users = await User.find().select("-__v -createdAt -updatedAt");

    if (users.length === 0) {
      return next(createError(404));
    }

    const usersObj = users.map((user) => {
      const plainObj = user.toObject();
      if (plainObj.userImage) {
        const imageBase64 =
          plainObj.userImage.contentType +
          "," +
          plainObj.userImage.data.toString("base64");
        plainObj.userImage = imageBase64;
      }
      return plainObj;
    });

    res.json(usersObj);
  } catch (error) {
    console.error("==== getAllUser ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      next(createError(500));
    }
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { _id } = req.params;

    const user = await User.findById(_id).select("-__v -createdAt -updatedAt");

    if (!user) {
      // return next(createError(404, "no user Found"));
      return next(createError(404));
    }

    const userObj = user.toObject();
    if (userObj.userImage) {
      const imageBase64 =
        userObj.userImage.contentType +
        "," +
        userObj.userImage.data.toString("base64");
      userObj.userImage = imageBase64;
    }

    res.json(userObj);
  } catch (error) {
    console.error("==== getUserById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

export const deleteUserById = async (req, res, next) => {
  try {
    const { userId, role } = req.jwt;
    const { _id } = req.params;

    if (role !== "admin" && userId !== _id) {
      return next(createError(403));
    }

    const user = await User.findByIdAndDelete(_id);
    if (!user) {
      return next(createError(404, "no user Found"));
      // return next(createError(404));
    }

    res.json({ message: "user deleted successfully" });
  } catch (error) {
    console.error("==== deleteUserById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

export const updateUserById = async (req, res, next) => {
  try {
    const { userId } = req.jwt;
    const { _id } = req.params;
    const { name, oldPassword, newPassword, userImage } = req.body;

    if (userId !== _id) {
      return next(createError(403));
    }

    if (!name && !oldPassword && !newPassword && !userImage) {
      return next(createError(400, "no data to update"));
    }

    if (!((oldPassword && newPassword) || (!oldPassword && !newPassword))) {
      return next(createError(400, "require both old and new password"));
    }

    const update = {};

    if (oldPassword && newPassword) {
      const user = await User.findById(_id).select("+password");

      if (!user) {
        return next(createError(404, "no user found"));
      }

      const isValidPassword = await bcrypt.compare(oldPassword, user.password);

      if (!isValidPassword) {
        return next(createError(400, "invalid credentials"));
      }

      update.password = await bcrypt.hash(newPassword, 10);
    }

    if (name) {
      update.name = name;
    }

    if (userImage) {
      const split = userImage.split(",");
      const contentType = split[0];
      const data = Buffer.from(split[1], "base64");
      update.userImage = { data, contentType };
    }

    const updUser = await User.findByIdAndUpdate(_id, update);

    if (!updUser) {
      return next(createError(404, "no user Found"));
      // return next(createError(404));
    }

    // res.json(user);
    res.json({ message: "Updated" });
  } catch (error) {
    console.error("==== updateUserById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

// ===== institutes =====
export const institutesList = async (req, res, next) => {
  try {
    const { _id, instituteName, instituteAbbr } = req.query;

    const query = {};

    if (_id && !utls.isValidObjectId(_id)) {
      return next(createError(400));
    }

    if (_id) {
      query._id = _id;
    }

    if (instituteName) {
      query.instituteName = { $regex: new RegExp(instituteName, "ui") };
    }

    if (instituteAbbr) {
      query.instituteAbbr = { $regex: new RegExp(instituteAbbr, "i") };
    }

    const institutes = await Institute.find(query);

    if (institutes.length === 0) {
      // return next(createError(404, "no institute found"));
      return next(createError(404));
    }

    res.json(institutes);
  } catch (error) {
    console.error("==== getInstitutes ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find institutes Error"));
      next(createError(500));
    }
  }
};

export const addInstitute = async (req, res, next) => {
  try {
    const { instituteName, instituteAbbr } = req.body;

    const document = { instituteName, instituteAbbr };
    await Institute.create(document);

    // res.status(201).json({ message: "institute added successfully" });
    res.status(201).json({ message: "Created" });
  } catch (error) {
    console.error("==== addInstitute ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "add institute Error"));
      next(createError(500));
    }
  }
};

export const getInstituteById = async (req, res, next) => {
  try {
    const { _id } = req.params;

    if (!_id || !utls.isValidObjectId(_id)) {
      return next(createError(400));
    }

    const institute = await Institute.findById(_id).select(
      "-__v,-createdAt -updatedAt"
    );

    if (!institute) {
      return next(createError(404));
    }

    res.json(institute);
  } catch (error) {
    console.error("==== getInstituteById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      next(createError(500));
    }
  }
};

// ===== courses =====
export const getInstituteCourses = async (req, res, next) => {
  try {
    const { instituteId } = req.jwt;

    const courses = await Course.find({ instituteId }).select(
      "-__v -createdAt -updatedAt"
    );

    if (courses.length === 0) {
      // return next(createError(404, "no courses found"));
      return next(createError(404));
    }

    const coursesModify = courses.map((course) => {
      const plainObj = course.toObject();
      if (plainObj.signature) {
        const signatureBase64 =
          plainObj.signature.contentType +
          "," +
          plainObj.signature.data.toString("base64");
        plainObj.signature = signatureBase64;
      }

      if (plainObj.signatureArray && plainObj.signatureArray.length === 0) {
        delete plainObj.signatureArray;
      }

      return plainObj;
    });

    res.json(coursesModify);
  } catch (error) {
    console.error("==== getAllcourses ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

export const getMyCourses = async (req, res, next) => {
  try {
    const { instituteId, userId, role } = req.jwt;

    // const where = { instituteId, createdBy: userId };

    const where = {};

    if (role === "admin") {
      where.issueStatus = { $in: ["R", "E", "I"] };
    } else {
      where.instituteId = instituteId;
      where.createdBy = userId;
    }

    const courses = await Course.find(where).select(
      "-__v -createdAt -updatedAt"
    );

    if (courses.length === 0) {
      // return next(createError(404, "no courses found"));
      return next(createError(404));
    }

    const coursesModify = courses.map((obj) => {
      const plainObj = obj.toObject();
      if (plainObj.signature) {
        const signatureBase64 =
          plainObj.signature.contentType +
          "," +
          plainObj.signature.data.toString("base64");
        plainObj.signature = signatureBase64;
      }

      if (plainObj.signatureArray && plainObj.signatureArray.length === 0) {
        delete plainObj.signatureArray;
      }

      return plainObj;
    });

    res.json(coursesModify);
  } catch (error) {
    console.error("==== getmecourses ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

export const addCourse = async (req, res, next) => {
  try {
    const { instituteId, userId } = req.jwt;

    // const { course, dateOfStudyStart, dateOfStudyEnd, dateOfExpireCert, signature } = req.body;

    const document = req.body;

    if (document.signature) {
      const split = document.signature.split(",");
      const contentType = split[0];
      const data = Buffer.from(split[1], "base64");
      document.signature = { data, contentType };
    }

    document.instituteId = instituteId;
    document.issueStatus = "P";
    document.createdBy = userId;

    const result = await Course.create(document);
    // console.log("==== resId ====\n", result._id);

    // res.status(201).json({ message: "course added successfully" });
    res.status(201).json({ message: "Created", _id: result._id });
  } catch (error) {
    console.error("==== addCourse ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "add course Error"));
      next(createError(500));
    }
  }
};

export const getCourseById = async (req, res, next) => {
  try {
    const { instituteId, role } = req.jwt;
    const { _id } = req.params;

    const where = {};
    where._id = _id;
    if (role === "admin") {
      where.issueStatus = { $in: ["R", "E", "I"] };
    } else {
      where.instituteId = instituteId;
    }

    const course = await Course.findOne(where).select(
      "-__v -createdAt -updatedAt"
    );

    if (!course) {
      // return next(createError(404, "no course Found"));
      return next(createError(404));
    }

    if (course.signatureArray && course.signatureArray.length === 0) {
      course.signatureArray = undefined;
    }

    const objCourse = course.toObject();

    if (objCourse.signature) {
      const signatureBase64 =
        objCourse.signature.contentType +
        "," +
        objCourse.signature.data.toString("base64");
      objCourse.signature = signatureBase64;
    }

    res.json(objCourse);
  } catch (error) {
    console.error("==== getCourseById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "get course Error"));
      next(createError(500));
    }
  }
};

export const updateCourseById = async (req, res, next) => {
  try {
    const { userId, instituteId } = req.jwt;
    const { _id } = req.params;
    // const { course, dateOfStudyStart, dateOfStudyEnd, dateOfExpireCert, signature } = req.body;
    const reqUpdate = req.body;

    if (
      reqUpdate.issueStatus &&
      !(reqUpdate.issueStatus === "R" || reqUpdate.issueStatus === "E")
    ) {
      return next(createError(403));
    }

    if (reqUpdate.signature) {
      const split = reqUpdate.signature.split(",");
      const contentType = split[0];
      const data = Buffer.from(split[1], "base64");
      reqUpdate.signature = { data, contentType };
    }

    const where = { _id, instituteId };
    let update = {};

    if (reqUpdate.issueStatus === "E") {
      where.issueStatus = "I";
      update.issueStatus = "E";
    } else {
      where.issueStatus = { $in: ["P", "R"] };
      update = reqUpdate;
    }
    update.updatedBy = userId;

    console.log(where);
    console.log(update);

    const result = await Course.findOneAndUpdate(where, update);

    if (!result) {
      return next(createError(404, "no course Found"));
      // return next(createError(404));
    }

    // res.json(result);
    res.json({ message: "Updated" });
  } catch (error) {
    console.error("==== updateCourseById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "update course Error"));
      next(createError(500));
    }
  }
};

export const deleteCourseById = async (req, res, next) => {
  try {
    const { instituteId } = req.jwt;
    const { _id } = req.params;

    const course = await Course.findByIdAndDelete(_id).where({
      instituteId,
      issueStatus: { $in: ["P", "R"] },
    });

    if (!course) {
      return next(createError(404, "no course Found"));
      // return next(createError(404));
    }

    // *** to do  add delete graduate with session

    res.json({ message: "course deleted successfully" });
  } catch (error) {
    console.error("==== deleteCourseById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "delete course Error"));
      next(createError(500));
    }
  }
};

export const addGraduates = async (req, res, next) => {
  try {
    const { userId, instituteId } = req.jwt;
    const { _id } = req.params;
    const graduates = req.body;

    const documents = graduates.map((obj) => ({
      ...obj,
      courseId: _id,
      instituteId,
      createdBy: userId,
    }));

    const records = await utls.insertDocuments(Graduate, documents);

    res.status(201).json({ message: "graduates created ", records });
  } catch (error) {
    console.error("==== addGraduates ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "add graduates Error"));
      next(createError(500));
    }
  }
};

export const getGraduates = async (req, res, next) => {
  try {
    const { role, instituteId } = req.jwt;
    const { _id } = req.params;

    // const graduates = await Graduate.find({
    //   courseId: _id,
    //   instituteId,
    // }).select("-__v -createdAt -updatedAt");

    // *** to do ***
    // check course issueStatus = { $in: ["R", "E", "I"] } for admin

    const where = {};
    where.courseId = _id;
    if (role !== "admin") {
      where.instituteId = instituteId;
    }
    const graduates = await Graduate.find(where).select(
      "-__v -createdAt -updatedAt"
    );

    if (graduates.length === 0) {
      // return next(createError(404, "no graduates found"));
      return next(createError(404));
    }

    res.json(graduates);
  } catch (error) {
    console.error("==== getgraduates ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find graduates Error"));
      next(createError(500));
    }
  }
};

export const getGraduateById = async (req, res, next) => {
  try {
    const { instituteId } = req.jwt;
    const { courseId, _id } = req.params;

    const graduate = await Graduate.findById(_id)
      .select("-__v -createdAt -updatedAt")
      .where({ courseId, instituteId });

    if (!graduate) {
      // return next(createError(404, "no graduate Found"));
      return next(createError(404));
    }

    res.json(graduate);
  } catch (error) {
    console.error("==== getGraduateById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find graduate Error"));
      next(createError(500));
    }
  }
};

export const deleteGraduateById = async (req, res, next) => {
  try {
    const { instituteId } = req.jwt;
    const { courseId, _id } = req.params;

    const graduate = await Graduate.findByIdAndDelete(_id).where({
      courseId,
      instituteId,
      certificateUUID: { $exists: false },
    });
    if (!graduate) {
      return next(createError(404, "no graduate Found"));
      // return next(createError(404));
    }

    res.json({ message: "graduate deleted successfully" });
  } catch (error) {
    console.error("==== deleteGraduateById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find graduate Error"));
      next(createError(500));
    }
  }
};

export const updateGraduateById = async (req, res, next) => {
  try {
    const { userId, instituteId } = req.jwt;
    const { courseId, _id } = req.params;
    // const { titleName, firstName, lastName } = req.body;

    const update = req.body;

    update.updatedBy = userId;

    const result = await Graduate.findByIdAndUpdate(_id, update).where({
      courseId,
      instituteId,
      certificateUUID: { $exists: false },
    });

    if (!result) {
      return next(createError(404, "no graduate Found"));
      // return next(createError(404));
    }

    // res.json(result);
    res.json({ message: "Updated" });
  } catch (error) {
    console.error("==== updateGraduateById ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "find user Error"));
      next(createError(500));
    }
  }
};

// ===== certificates =====
export const certificatesList = async (req, res, next) => {
  try {
    const { userId, role } = req.jwt;

    let query = {};

    if (role === "user") {
      const user = await User.findById(userId).select("email -_id");

      if (!user) {
        // throw createError(404, "no data found");
        throw createError(404);
      }

      query = { recipientEmail: { $regex: new RegExp(user.email, "i") } };
    } else {
      const { recipientName, recipientEmail, courseName } = req.query;

      if (recipientName) {
        query.recipientName = { $regex: new RegExp(recipientName, "ui") };
      }

      if (recipientEmail) {
        query.recipientEmail = { $regex: new RegExp(recipientEmail, "i") };
      }

      if (courseName) {
        query.courseName = { $regex: new RegExp(courseName, "ui") };
      }

      query.issuerId = userId;
    }

    const select = "certificateUUID recipientName certificateJson -_id";
    const sort = { issueDate: -1 };

    const documents = await Certificate.find(query).select(select).sort(sort);

    if (documents.length === 0) {
      // throw createError(404, "no data found");
      throw createError(404);
    }

    const certificates = documents.map((document) => ({
      certificateUUID: document.certificateUUID,
      certificateJson: JSON.parse(document.certificateJson),
    }));

    res.send(certificates);
  } catch (error) {
    console.error("==== certificatesList ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "listing certificates Error"));
      next(createError(500));
    }
  }
};

export const certificateJson = async (req, res, next) => {
  try {
    const { certificateUUID } = req.params;

    const query = { certificateUUID };
    const select =
      "certificateUUID certificateJson certificateHash signature -_id";

    const document = await Certificate.findOne(query).select(select);

    if (!document) {
      // throw createError(404, "no data found");
      throw createError(404);
    }
    if (
      `0x${utls.hashSHA256(document.certificateJson)}` !==
      document.certificateHash
    ) {
      return next(createError(500, "certificate data conflict"));
    }

    const certificateData = JSON.parse(document.certificateJson);
    const jsonString = JSON.stringify({
      certificateUUID: document.certificateUUID,
      certificateJson: certificateData,
      certificateHash: document.certificateHash,
      signature: document.signature,
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${certificateUUID}.json`
    );
    res.send(jsonString);
  } catch (error) {
    console.error("==== certificateJson ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "create file certificate Error"));
      next(createError(500));
    }
  }
};

export const certificatePNG = async (req, res, next) => {
  try {
    const { certificateUUID } = req.params;

    const query = { certificateUUID };
    const select =
      "certificateUUID certificateJson certificateHash signature -_id";

    const document = await Certificate.findOne(query).select(select);

    if (!document) {
      // throw createError(404, "no data found");
      throw createError(404);
    }

    if (
      `0x${utls.hashSHA256(document.certificateJson)}` !==
      document.certificateHash
    ) {
      return next(createError(500, "certificate data conflict"));
    }

    const certificate = JSON.parse(document.certificateJson);

    if (certificate.certificateDriveImgId) {
      const imgHash = await utls.hashDriveImage(
        certificate.certificateDriveImgId
      );
      if (`0x${imgHash}` === certificate.certificateDriveImgHash) {
        return res.redirect(
          `https://drive.google.com/uc?id=${certificate.certificateDriveImgId}`
        );
      } else {
        if (imgHash === "0") {
          throw createError(
            404,
            `no image (${certificate.certificateDriveImgId}) found`
          );
        } else {
          throw createError(
            409,
            `image hash (${certificate.certificateDriveImgId}) conflict`
          );
        }
      }
    }

    if (!certificate.layoutId) {
      throw createError(404, "no layout found");
    }

    res.setHeader("Content-Type", "image/png");
    // res.setHeader("Content-Disposition", `attachment; filename=${certificateUUID}.png`);
    const canvas = await utls.drawCertificate(document.certificateJson);
    const stream = canvas.createPNGStream();
    stream.pipe(res);
    res.on("finish", () => {
      res.end();
    });
  } catch (error) {
    console.error("==== certificatePNG ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "create image certificate Error"));
      next(createError(500));
    }
  }
};

export const revokeCertificate = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { certificateUUID } = req.params;
    const { userId } = req.jwt;
    const { maxTransactionFee } = req.body;

    const queryGraduate = { certificateUUID };
    const update = { certificateRevoked: true };
    const options = { session, new: true };

    const result = await Graduate.findOneAndUpdate(
      queryGraduate,
      update,
      options
    );

    if (!result) {
      throw createError(404);
    }

    const query = { certificateUUID, issuerId: userId };
    // const update = { certificateRevoked: true };
    // const options = { session, new: true };
    // update.revokedDate = new Date(new Date().toISOString());
    update.revokedDate = new Date();

    const document = await Certificate.findOneAndUpdate(query, update, options);

    if (!document) {
      // throw createError(404, "no data found");
      throw createError(404);
    }

    if (
      `0x${utls.hashSHA256(document.certificateJson)}` !==
      document.certificateHash
    ) {
      return next(createError(500, "Certificate data conflict"));
    }

    const leaf = document.certificateHash;
    const transactionHash = await sendContractTransaction(
      "revokeLeaf",
      maxTransactionFee,
      leaf
    );
    console.log("transactionHash : ", transactionHash);
    console.log("certificateUUID : ", certificateUUID);
    console.log("certificateHash : ", leaf + "\n");

    await session.commitTransaction();

    res.json({ transactionHash, certificateUUID, certificateHash: leaf });
  } catch (error) {
    if (
      error.message === "execution reverted: This certificate has been revoked."
    ) {
      try {
        await session.commitTransaction();
        res.json({
          transactionHash: "",
          certificateUUID: req.params.certificateUUID,
          certificateHash: "",
        });
      } catch (err) {
        next(createError(500));
      }
    } else {
      await session.abortTransaction();
      console.error("==== revokeCertificate ====\n", error);
      const handledError = utls.handleMongooseError(error);
      if (createError.isHttpError(handledError)) {
        next(handledError);
      } else {
        // next(createError(500, "revoke certificate Error"));
        next(createError(500));
      }
    }
  } finally {
    session.endSession();
  }
};

export const verifyCertificate = async (req, res, next) => {
  // let certificateFile;
  try {
    // certificateFile = req.file.path;
    // const certificate = JSON.parse(fs.readFileSync(certificateFile));
    // fs.unlinkSync(certificateFile);
    const certificate = JSON.parse(String(req.file.buffer));

    const certificateJson = JSON.stringify(certificate.certificateJson);

    if (
      `0x${utls.hashSHA256(certificateJson)}` !== certificate.certificateHash ||
      certificate.certificateHash !== certificate.signature.leaf
    ) {
      return next(createError(409, "Certificate data conflict"));
    }

    const document = JSON.parse(certificateJson);

    // if (
    //   document.expireDate &&
    //   document.expireDate < utls.customDate.dateFormat("now", "YYYYMMDD", "en")
    // ) {
    //   return next(createError(409, "certificate expired"));
    // }

    const root = certificate.signature.root;
    const proofs = certificate.signature.proofs;
    const leaf = certificate.signature.leaf;

    const result = await readContractData("verifyLeaf", root, proofs, leaf);

    let outURL = "";
    let message;
    if (result) {
      if (
        document.expireDate &&
        document.expireDate <
          utls.customDate.dateFormat("now", "YYYYMMDD", "en")
      ) {
        // return next(createError(400, "This certificate is valid but EXPIRED"));
        message = "expired";
      }

      // console.log(document.dateOfExpireCert);
      if (
        document.dateOfExpireCert &&
        new Date(document.dateOfExpireCert) < new Date(new Date().toISOString())
      ) {
        // console.log(new Date(document.dateOfExpireCert));
        // console.log(new Date(new Date().toISOString()));
        message = "expired";
      }

      if (document.certificateDriveImgId) {
        const imgHash = await utls.hashDriveImage(obj.certificateDriveImgId);
        if (`0x${imgHash}` === document.certificateDriveImgHash) {
          outURL = JSON.stringify({
            // message: "This certificate is valid.",
            certificate: message || "valid",
            certificateData: document,
            certificateImageURL: `https://drive.google.com/uc?id=${document.certificateDriveImgId}`,
          });
        } else {
          outURL = JSON.stringify({
            certificate: message || "valid",
            certificateData: document,
            certificateImageURL: "image error",
          });
        }
      } else if (document.layoutId) {
        const canvas = await utls.drawCertificate(certificateJson);

        outURL = JSON.stringify({
          // message: "This certificate is valid.",
          certificate: message || "valid",
          certificateData: document,
          certificateImageBase64: canvas.toDataURL(),
        });
      } else {
        outURL = JSON.stringify({
          certificate: message || "valid",
          certificateData: document,
        });
      }
    } else {
      return next(createError(400, "verify cetificate failure"));
    }

    res.type("json").send(outURL);
  } catch (error) {
    // if (req.file && fs.existsSync(certificateFile)) {
    //   fs.unlinkSync(certificateFile);
    // }
    if (error.message === "This certificate has been revoked.") {
      const outURL = JSON.stringify({
        certificate: "revoked",
      });
      res.type("json").send(outURL);
    } else {
      console.error("==== verifyCertificate ====\n", error);
      const handledError = utls.handleMongooseError(error);
      if (createError.isHttpError(handledError)) {
        next(handledError);
      } else {
        // next(createError(500, "verify certificate Error"));
        next(createError(500));
      }
    }
  }
};

// export const prepareCetificates = async (req, res, next) => {
//   try {
//     const { issueBatchId, certificates } = req.body;

//     for (let obj of certificates) {
//       if (obj.certificateDriveImgId) {
//         const imgHash = await utls.hashDriveImage(obj.certificateDriveImgId);
//         obj.certificateDriveImgHash = `0x${imgHash}`;
//         if (imgHash === "0") {
//           throw createError(
//             404,
//             `no image (${obj.certificateDriveImgId}) found`
//           );
//         } else {
//           obj.certificateDriveImgHash = `0x${imgHash}`;
//         }
//       }
//       const jsonStr = JSON.stringify(obj);
//       const hash = utls.hashSHA256(jsonStr);
//       obj.certificateJson = jsonStr;
//       obj.certificateHash = `0x${hash}`;
//     }

//     const documents = certificates.map((obj) => ({
//       certificateUUID: randomUUID(),
//       recipientName: obj.recipientName,
//       recipientEmail: obj.recipientEmail,
//       courseName: obj.courseName,
//       instituteName: obj.instituteName,
//       certificateId: obj.certificateId,
//       issueDate: obj.issueDate,
//       certificateJson: obj.certificateJson,
//       certificateHash: obj.certificateHash,
//       issuerId: req.jwt.userId,
//       issueBatchId,
//     }));

//     const records = await utls.insertDocuments(Certificate, documents);

//     res.json({ message: "Certificates have been prepared", records });
//   } catch (error) {
//     console.error("==== prepareCetificates ====\n", error);
//     const handledError = utls.handleMongooseError(error);
//     if (createError.isHttpError(handledError)) {
//       next(handledError);
//     } else {
//       // next(createError(500, "prepare certificates Error"));
//       next(createError(500));
//     }
//   }
// };

// export const issueCertificates = async (req, res, next) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { issueBatchId } = req.body;
//     const { userId } = req.jwt;

//     const query = {
//       issueBatchId,
//       issuerId: userId,
//       treeRoot: { $exists: false },
//     };
//     const select = "certificateHash -_id";

//     const documents = await Certificate.find(query).select(select);

//     if (documents.length === 0) {
//       // throw createError(404, "no data found");
//       throw createError(404);
//     }

//     const certificatesHash = documents.map((obj) => [obj.certificateHash]);
//     const tree = utls.createMerkleTree(certificatesHash, ["bytes32"]);

//     const root = tree.root;
//     const treeDumpData = utls.treeDump(tree);

//     const document = [{ root, treeDumpData }];

//     await CertificateTree.create(document, { session });

//     const signatures = utls.getProofAll(tree);

//     let count = 0;
//     for (const key in signatures) {
//       const query = { certificateHash: key };
//       const update = {
//         $set: { signature: signatures[key], treeRoot: signatures[key].root },
//       };

//       const result = await Certificate.updateOne(query, update, { session });

//       if (result.matchedCount !== result.modifiedCount) {
//         throw createError(500, "update data Error");
//       }

//       count += result.modifiedCount;
//     }

//     const transactionHash = await sendContractTransaction("addRoot", root);
//     console.log("transactionHash : ", transactionHash);
//     console.log("root : ", root);
//     console.log("certificates : ", count + "\n");

//     await session.commitTransaction();

//     res.status(201).json({ transactionHash, root, certificates: count });
//   } catch (error) {
//     await session.abortTransaction();
//     console.error("==== issueCertificates ====\n", error);
//     const handledError = utls.handleMongooseError(error);
//     if (createError.isHttpError(handledError)) {
//       next(handledError);
//     } else {
//       // next(createError(500, "issue certificates Error"));
//       next(createError(500));
//     }
//   } finally {
//     session.endSession();
//   }
// };

export const sendCertificates = async (req, res, next) => {
  try {
    const { root } = req.body;
    const { role } = req.jwt;

    if (role !== "admin") {
      throw createError(401);
    }

    // const query = { treeRoot: root, issuerId: userId };
    const query = { treeRoot: root };

    const documents = await Certificate.find(query).select(
      "certificateUUID recipientEmail recipientName courseName instituteName certificateJson titleName firstName lastName"
    );

    if (documents.length === 0) {
      // throw createError(404, "no data found");
      throw createError(404);
    }
    const result = await utls.mailCertificates(documents);

    res.json(result);
  } catch (error) {
    console.error("==== sendCertificates ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "send certificates Error"));
      next(createError(500));
    }
  }
};

export const makeCertificatesData = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { courseId, maxTransactionFee } = req.body;
    const { userId, role, instituteId } = req.jwt;

    if (!(role === "admin" || role === "issuer")) {
      throw createError(401);
    }

    if (!courseId && role === "issuer") {
      throw createError(400);
    }

    // const excludeFields = "-__v -createdAt -updatedAt -createdBy -updatedBy";
    const excludeFields = "-__v -createdAt -updatedAt -updatedBy";

    let query = {};

    if (instituteId) {
      query.instituteId = instituteId;
    }

    if (courseId) {
      query._id = courseId;
    }

    query.issueStatus = { $in: ["R", "E"] };

    // console.log(query);

    const courses = await Course.find(query).select(excludeFields);

    if (courses.length === 0) {
      return next(createError(404));
    }

    const courseIds = courses.map((obj) => obj._id);

    // console.log(courseIds);

    query = {};

    query.courseId = { $in: courseIds };

    query.certificateUUID = { $exists: false };

    const certificates = await Graduate.find(query)
      .select(excludeFields)
      .populate("courseId", excludeFields)
      .session(session)
      .exec();

    if (certificates.length === 0) {
      return next(createError(404));
    }

    const documents = [];
    const updatedCourseIds = new Set();

    for (const certificate of certificates) {
      const plainObj = certificate.toObject();

      const {
        _id,
        courseId: {
          _id: courseId,
          instituteId,
          // signature,
          // signName,
          updatedAt,
          issueStatus,
          createdBy: courseCreatedBy,
          __v,
          ...courseDetail
        },
        instituteId: instId,
        certificateUUID,
        createdBy,
        ...graduateDetail
      } = plainObj;

      // if (signature) {
      //   const signatureBase64 =
      //     signature.contentType + "," + plainObj.signature.data.toString("base64");
      // }

      const certificateData = {
        ...graduateDetail,
        ...courseDetail,
        courseId,
        instituteId,
      };

      if (
        certificateData.signatureArray &&
        certificateData.signatureArray.length === 0
      ) {
        delete certificateData.signatureArray;
      }

      // console.log(certificateData);

      // if (signature) {
      //   const signatureBase64 =
      //     signature.contentType + "," + plainObj.signature.data.toString("base64");
      //   certificateData.signature = signatureBase64;
      // }

      const jsonStr = JSON.stringify(certificateData);
      const hash = utls.hashSHA256(jsonStr);

      const document = {
        certificateUUID: randomUUID(),
        courseName: certificateData.course,
        instituteId: certificateData.instituteId,
        // 1. ------------------------------
        titleName: certificateData.titleName,
        firstName: certificateData.firstName,
        lastName: certificateData.lastName,
        // ============ OR =================
        // 2.-------------------------------
        recipientName: certificateData.recipientName,
        recipientEmail: certificateData.recipientEmail,
        instituteName: certificateData.instituteName,
        issueDate: certificateData.issueDate,
        // ---------------------------------
        certificateJson: jsonStr,
        certificateHash: `0x${hash}`,
        // issuerId: userId,
        issuerId: courseCreatedBy,
        createdBy: userId,
        // issueBatchId,
      };

      certificate.certificateUUID = document.certificateUUID;
      await certificate.save({ session });

      if (!updatedCourseIds.has(courseId)) {
        certificate.courseId.issueStatus = "I";

        if (
          certificate.courseId.signatureArray &&
          certificate.courseId.signatureArray.length === 0
        ) {
          certificate.courseId.signatureArray = undefined;
        }
        // console.log(certificate.courseId);

        await certificate.courseId.save({ session });
        updatedCourseIds.add(courseId);
      }

      documents.push(document);
    }

    const certificatesHash = documents.map((obj) => [obj.certificateHash]);

    const tree = utls.createMerkleTree(certificatesHash, ["bytes32"]);

    const root = tree.root;
    const treeDumpData = utls.treeDump(tree);

    const document = [{ root, treeDumpData, createdBy: userId }];

    await CertificateTree.create(document, { session });

    const signatures = utls.getProofAll(tree);
    const count = documents.length;

    // const transactionHash = await sendContractTransaction("addRoot", root);

    // console.log("transactionHash : ", transactionHash);
    // console.log("root : ", root);
    // console.log("certificates : ", count + "\n");

    for (const document of documents) {
      const key = document.certificateHash;
      if (!signatures[key]) {
        throw createError(500, "update data Error");
      }
      document.signature = signatures[key];
      document.treeRoot = signatures[key].root;
      // document.transactionHash = transactionHash;
    }

    const results = await Certificate.insertMany(documents, { session });

    if (results.length === 0) {
      throw createError(404);
    }

    const transactionHash = await sendContractTransaction(
      "addRoot",
      maxTransactionFee,
      root
    );

    console.log("transactionHash : ", transactionHash);
    console.log("root : ", root);
    console.log("certificates : ", count + "\n");

    await session.commitTransaction();
    session.endSession();

    try {
      const bulkOps = results.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { transactionHash },
        },
      }));

      await Certificate.bulkWrite(bulkOps);
    } catch (updateError) {
      console.error(
        "Failed to update transactionHash:",
        transactionHash,
        "\n",
        updateError
      );
    }

    res.status(201).json({ transactionHash, root, certificates: count });
  } catch (error) {
    await session.abortTransaction();
    console.error("==== makeCertificatesData ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      next(createError(500));
    }
  } finally {
    if (session.inTransaction()) {
      await session.endSession();
    }
  }
};

export const countCertificates = async (req, res, next) => {
  try {
    // const { userId, role } = req.jwt;
    // const {instituteId } = req.params;
    const { startDate, endDate } = req.query;

    if (
      !(
        utls.customDate.isDateValid(startDate, "YYYY-MM-DD") &&
        utls.customDate.isDateValid(endDate, "YYYY-MM-DD")
      )
    ) {
      throw createError(400);
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    const results = await Certificate.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$instituteId",
          certificates: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          instituteId: "$_id",
          certificates: 1,
        },
      },
    ]);

    // if (results.length === 0) {
    //   throw createError(404);
    // }

    const revokedRecs = await Certificate.aggregate([
      {
        $match: {
          revokedDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$instituteId",
          certificates: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          instituteId: "$_id",
          certificates: 1,
        },
      }
    ]);

    // if (revokedRecs.length === 0) {
    //   throw createError(404);
    // }

    const result = { startDate, endDate, issued: results, revoked: revokedRecs};

    res.send(result);
  } catch (error) {
    console.error("==== countCertificates ====\n", error);
    const handledError = utls.handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      next(handledError);
    } else {
      // next(createError(500, "listing certificates Error"));
      next(createError(500));
    }
  }
};
