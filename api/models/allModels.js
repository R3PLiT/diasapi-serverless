import mongoose from "mongoose";
import { customDate } from "../utils/allUtils.js";

const isValidObjectId = mongoose.Types.ObjectId.isValid;

// ===== certificate ======
const certificateSchema = new mongoose.Schema(
  {
    certificateUUID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // recipientName: { type: String, required: true },
    // recipientEmail: { type: String, required: true, index: true },
    // courseName: { type: String, required: true },
    // instituteName: { type: String, required: true, index: true },
    // certificateId: { type: String, required: true, index: true },
    // issueDate: {
    //   type: String,
    //   validate: {
    //     validator: function (dateString) {
    //       return customDate.isDateValid(dateString, "YYYYMMDD");
    //     },
    //     message: "format must be 'YYYYMMDD' ",
    //   },
    //   // match: [/^\d{8}$/, "issueDate must be exactly 8 digits long"],
    //   // required: true,
    // },
    courseName: { type: String },
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
    },
    // 1. ------------------------------
    titleName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    // ============ OR =================
    // 2.-------------------------------
    recipientName: { type: String },
    recipientEmail: { type: String, index: true },
    instituteName: { type: String, index: true },
    issueDate: {
      type: String,
      validate: {
        validator: function (dateString) {
          return customDate.isDateValid(dateString, "YYYYMMDD");
        },
        message: "format must be 'YYYYMMDD' ",
      },
      // match: [/^\d{8}$/, "issueDate must be exactly 8 digits long"],
      // required: true,
    },
    // ---------------------------------
    certificateJson: { type: String, required: true },
    certificateHash: { type: String, required: true, unique: true },
    signature: {
      root: { type: String },
      proofs: { type: [String] },
      leaf: { type: String },
    },
    certificateRevoked: { type: Boolean, default: false },
    revokedDate: { type: Date },
    treeRoot: {
      type: String,
      ref: "CertificateTree",
      index: true,
      // validate: {
      //   validator: async function (value) {
      //     // return await mongoose.model("CertificateTree").exists({ root: value });
      //   },

      //   message: "CertificateTree with this root does not exist.",
      // },
    },
    transactionHash: { type: String },
    issuerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function (value) {
          // if (!isValidObjectId(value)) {
          //   return false;
          // }
          return await mongoose
            .model("User")
            .exists({ _id: value, role: { $in: ["issuer", "admin"] } });
        },
        message: "Issuer with this ID does not exist.",
      },
    },
    issueBatchId: { type: String, default: "batch" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Certificate = mongoose.model("Certificate", certificateSchema);

// ===== course ======
const signatureSchema = new mongoose.Schema(
  {
    no: { type: Number },
    signature: { type: String },
    signName: { type: String },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    course: { type: String, required: true },
    // courseAbbr: { type: String },
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
    },
    // 1. ------------------------------
    dateOfStudyStart: { type: String },
    dateOfStudyEnd: { type: String },
    dateOfExpireCert: { type: String },
    signature: { data: Buffer, contentType: String },
    signName: { type: String },
    signatureArray: [signatureSchema],
    // ============ OR =================
    // 2.-------------------------------
    instituteName: { type: String },
    issueDate: { type: String },
    expireDate: { type: String },
    layoutId: { type: String },
    // ---------------------------------
    issueStatus: { type: String, enum: ["P", "R", "E", "I"], default: "P" },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CertTemplate",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // instituteName: { type: String, required: true },
    // active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Course = mongoose.model("Course", courseSchema);

// ===== certificatetree ======
const certificateTreeSchema = new mongoose.Schema(
  {
    root: { type: String, required: true, unique: true, index: true },
    treeDumpData: { type: mongoose.Schema.Types.Mixed, required: true },
    // transactionHash: { type: String, index: true },
    // insertTransactionDate: { type: String },
    rootRevoked: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const CertificateTree = mongoose.model("CertificateTree", certificateTreeSchema);

// ===== graduate ======
const graduateSchema = new mongoose.Schema(
  {
    // 1. ------------------------------
    titleName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    // ============ OR =================
    // 2.-------------------------------
    recipientName: { type: String },
    recipientEmail: { type: String },
    // ---------------------------------
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
    },
    certificateUUID: { type: String, ref: "Certificate" },
    certificateRevoked: { type: Boolean },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // instituteName: { type: String, required: true },
    // active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Graduate = mongoose.model("Graduate", graduateSchema);

// ===== institute ======
const instituteSchema = new mongoose.Schema(
  {
    instituteName: { type: String, required: true, unique: true },
    instituteAbbr: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Institute = mongoose.model("Institute", instituteSchema);

// ===== user ======
const userSchema = new mongoose.Schema(
  {
    // userName: {
    //   type: String,
    //   match: [
    //     /^[a-zA-Z0-9]{1,10}$/,
    //     "userName only allow alphanumeric characters (a-zA-Z0-9), hyphens (-), underscores (_), and periods (.) and length between 1 and 10 characters",
    //   ],
    //   required: true,
    //   trim: true,
    //   unique: true,
    //   index: true,
    // },
    email: {
      type: String,
      lowercase: true,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: { type: String, max: 100, required: true, trim: true },
    password: { type: String, max: 25, required: true, select: false },
    role: {
      type: String,
      enum: ["user", "issuer", "admin"],
      required: true,
      default: "user",
    },
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: function () {
        return this.role === "issuer";
      },
      validate: {
        validator: async function (value) {
          if (this.role !== "issuer" || !isValidObjectId(value)) {
            return false;
          }
          return await mongoose.model("Institute").exists({ _id: value });
        },
        message: "Required only for issuer and must exist in the 'Institute' collection.",
      },
    },
    userImage: { data: Buffer, contentType: String },
    active: { type: Boolean, default: true },
  },

  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

// ===== certificatetemplate ======
const templateSchema = new mongoose.Schema(
  {
    name: { type: String },
    value: { type: String },
    type: { type: String, enum: ["input", "label", "image"] },
    orderNumber: { type: Number },
    file: { type: String },
  },
  { _id: false }
);

const certTemplateSchema = new mongoose.Schema(
  {
    templateValues: [templateSchema],
  },

  { timestamps: true }
);

export const CertTemplate = mongoose.model("CertTemplate", certTemplateSchema);
