import "dotenv/config";
import fs from "fs";
import createError from "http-errors";
import mongoose from "mongoose";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { google } from "googleapis";
import dayjs from "dayjs";
import "dayjs/locale/th.js";
import buddhistEra from "dayjs/plugin/buddhistEra.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { registerFont, createCanvas, loadImage } from "canvas";
import nd from "unicodedigits";

// ===== mongoose =====
export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const handleMongooseError = (error) => {
  // if (error instanceof mongoose.Error || error.name === "MongoServerError") {
  if (error instanceof mongoose.Error || error.name.includes("Mongo")) {
    if (error.code === 11000 || error.code === 11001) {
      const regex = /dup key: (\{[^}]+\})/;
      const errorMessage = error.message;
      const match = errorMessage.match(regex);
      if (match && match.length > 1) {
        const fieldDup = JSON.parse(match[1].replace(/(\w+):/g, '"$1":'));
        const firstMessage = { message: "duplicate key error" };
        const customMessage = { ...firstMessage, ...fieldDup };
        return createError(409, "duplicate key error", { customMessage });
      } else {
        return createError(409, "duplicate key error");
      }
    } else if (error.name === "ValidationError") {
      console.log(error.message);
      console.log(JSON.stringify(error));
      const customMessage = {};
      customMessage["message"] = error.name;
      for (const field in error.errors) {
        if (error.errors[field].name === "CastError") {
          const regex = /.*(?=for)/;
          const matches = error.errors[field].message.match(regex);
          if (matches) {
            customMessage[field] = `${matches[0]} ('${error.errors[field].value}')`;
          } else {
            customMessage[field] = `${error.errors[field].name} ('${error.errors[field].value}')`;
          }
        } else {
          customMessage[field] = `${error.errors[field].message} ('${error.errors[field].value}')`;
        }
      }
      return createError(422, "ValidationError", { customMessage });
    } else {
      return createError(400);
    }
  } else {
    return error;
  }
};

export const insertDocuments = async (Model, documents) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await Model.insertMany(documents, { session });

    await session.commitTransaction();

    return result.length;
  } catch (error) {
    await session.abortTransaction();
    console.error("==== insertDocuments ====\n", error);
    const handledError = handleMongooseError(error);
    if (createError.isHttpError(handledError)) {
      throw handledError;
    } else {
      // throw createError(500, "insert data Error");
      throw createError(500);
    }
  } finally {
    session.endSession();
  }
};

// ===== merkletree =====
export const createMerkleTree = (data, dataType) => {
  try {
    return StandardMerkleTree.of(data, dataType);
  } catch (error) {
    console.error("==== createMerkleTree ====\n", error);
    // throw createError(500, "create tree Error");
    throw createError(500);
  }
};

export const treeDump = (tree) => {
  try {
    return tree.dump();
  } catch (error) {
    console.error("==== treeDump ====\n", error);
    // throw createError(500, "dump data Error");
    throw createError(500);
  }
};

export const getProofAll = (tree) => {
  try {
    let allProofs = {}; // object key-value pair
    const root = tree.root;
    for (const [i, v] of tree.entries()) {
      allProofs[v[0]] = {
        root: root,
        proofs: tree.getProof(i),
        leaf: v[0],
      };
    }
    return allProofs;
  } catch (error) {
    console.error("==== getProofAll ====\n", error);
    // throw createError(500, "get data Error");
    throw createError(500);
  }
};

// ===== mailcerts =====
export const mailCertificates = async (details) => {
  try {
    const transporter = nodemailer.createTransport({
      pool: true,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true" ? true : false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // tls: {
      //   rejectUnauthorized: false,
      // },
    });

    const hostURL = process.env.HOST_URL;
    let accepted = 0;
    let rejected = 0;

    for (const detail of details) {
      const {
        certificateUUID,
        recipientEmail,
        recipientName,
        courseName,
        instituteName,
        certificateJson,
        titleName,
        firstName,
        lastName,
      } = detail;

      const certificateLink = `${hostURL}/certificates/${certificateUUID}`;
      // const certificateimageLink = `${hostURL}/certificates/${certificateUUID}/image`;
      const certificate = JSON.parse(certificateJson);
      // const certificateimageLink = certificate.certificateDriveImgId
      //   ? `https://drive.google.com/uc?id=${certificate.certificateDriveImgId}`
      //   : `${hostURL}/certificates/${certificateUUID}/image`;
      let certificateimageLink = "";
      if (certificate.certificateDriveImgId) {
        certificateimageLink = `https://drive.google.com/uc?id=${certificate.certificateDriveImgId}`;
      } else if (certificate.layoutId) {
        certificateimageLink = `${hostURL}/certificates/${certificateUUID}/image`;
      } else {
        certificateimageLink = "";
      }

      // const mailOptions = {
      //   from: process.env.SENDER_EMAIL,
      //   to: recipientEmail,
      //   subject: `Your Certificate (ประกาศนียบัตรของคุณ)`,
      //   html: `
      //   <p>เรียน ${recipientName},</p>
      //   <p>คุณได้รับประกาศนียบัตรจาก ${instituteName} สำหรับหลักสูตร ${courseName}</p>
      //   <p>สามารถดาวน์โหลดได้ตามลิงค์ด้านล่างนี้:</p>
      //   <p><a href="${certificateLink}" target="_blank">ไฟล์ประกาศนียบัตร</a> (ใช้ตรวจสอบความถูกต้อง)</p>
      //   <p><a href="${certificateimageLink}" target="_blank">รูปภาพประกาศนียบัตร</a></p>
      //   <p>ขอแสดงความยินดี,<br>diasCerts</p>
      // `,
      // };

      const mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: recipientEmail,
        subject: `Your Certificate (ประกาศนียบัตรของคุณ)`,
        html: `
        <p>เรียน ${recipientName ? recipientName : `${titleName}${firstName} ${lastName}`},</p>
        <p>คุณได้รับประกาศนียบัตร${
          instituteName ? `จาก ${instituteName}` : ""
        } สำหรับหลักสูตร ${courseName}</p>
        <p>สามารถดาวน์โหลดได้ตามลิงค์ด้านล่างนี้:</p> 
          <p><a href="${certificateLink}" target="_blank">ไฟล์ประกาศนียบัตร</a> (ใช้ตรวจสอบความถูกต้อง)</p>
        ${
          certificateimageLink
            ? `<p><a href="${certificateimageLink}" target="_blank">รูปภาพประกาศนียบัตร</a></p>`
            : ""
        } 
        <p>ขอแสดงความยินดี,<br>diasCerts</p>
      `,
      };

      const info = await transporter.sendMail(mailOptions);

      accepted += info.accepted.length;
      rejected += info.rejected.length;
    }

    transporter.close();

    return { accepted, rejected };
  } catch (error) {
    console.error("==== mailCertificates ====\n", error);
    // throw createError(500, "send mail Error");
    throw createError(500);
  }
};

// ===== hashdriveimage =====
const drive = google.drive({
  version: "v3",
  auth: process.env.GOOGLE_AUTHKEY,
});

export const hashDriveImage = async (fileId) => {
  try {
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");

      response.data.on("data", (chunk) => {
        hash.update(chunk);
      });

      response.data.on("end", () => {
        const fileHash = hash.digest("hex");
        resolve(fileHash);
      });

      response.data.on("error", (err) => {
        reject(err);
      });
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return "0";
    } else {
      console.error("==== hashGoogleImage ====\n", error);
      throw createError(500);
    }
  }
};

// ===== hashdata =====
export const hashSHA256 = (input) => {
  try {
    return crypto.createHash("sha256").update(input).digest("hex");
  } catch (error) {
    console.error("==== hashSHA256 ====\n", error);
    // throw createError(500, "hashing Error");
    throw createError(500);
  }
};

// ===== formatdate =====
dayjs.extend(customParseFormat);
dayjs.extend(buddhistEra); // ใช้งาน buddhistEra plugin เพื่อแปลงเป็น พ.ศ.
dayjs.extend(utc);
dayjs.extend(timezone);

export const customDate = {
  // dateLongTH: (date) => {
  //   dayjs.locale("th");
  //   return dayjs(date).format("DD MMMM BBBB");
  // },
  // dateShortTH: (date) => {
  //   dayjs.locale("th");
  //   return dayjs(date).format("DD MMM BB");
  // },
  // dateLongEN: (date) => {
  //   dayjs.locale("en");
  //   return dayjs(date).format("DD MMMM YYYY");
  // },
  // dateShortEN: (date) => {
  //   dayjs.locale("en");
  //   return dayjs(date).format("DD MMM YY");
  // },
  dateFormat: (yyyymmdd, formatStr, locale) => {
    try {
      dayjs.locale(locale);
      dayjs.tz.setDefault("Asia/Bangkok");
      const paramDate = yyyymmdd === "now" ? dayjs.tz() : dayjs.tz(yyyymmdd);
      return paramDate.format(formatStr);
    } catch (error) {
      console.error("==== dateFormat ====\n", error);
      // throw createError(500, "format date Error");
      throw createError(500);
    }
  },
  isDateValid: (date, formatStr) => {
    try {
      return dayjs(date, formatStr, true).isValid();
    } catch (error) {
      console.error("==== isDateValid ====\n", error);
      // throw createError(500, "validate date Error");
      throw createError(500);
    }
  },
};

// ===== certimage =====
// console.log("load fonts");
registerFont("api/contracts/fonts/THSarabun Bold.ttf", { family: "Bold" });
registerFont("api/contracts/fonts/THSarabun.ttf", { family: "Normal" });

export const drawCertificate = async (certificateJson) => {
  try {
    const certificate = JSON.parse(certificateJson);
    const layout = JSON.parse(fs.readFileSync(`api/contracts/${certificate.layoutId}.json`));

    const imageTemplate = await loadImage(`api/contracts/${layout.template}`);
    const canvas = createCanvas(imageTemplate.width, imageTemplate.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageTemplate, 0, 0);

    for (let i = 0; i < layout.images.length; i++) {
      const img = await loadImage(`api/contracts/${layout.images[i].image}`);
      ctx.drawImage(
        img,
        layout.images[i].x,
        layout.images[i].y,
        layout.images[i].width,
        layout.images[i].height
      );
    }

    for (let j = 0; j < layout.texts.length; j++) {
      ctx.font = `${layout.texts[j].fontsize}px "${layout.texts[j].font}"`;
      ctx.textAlign = layout.texts[j].align;

      // let textString;
      // for (let k = 0; k < layout.texts[j].text.length; k++) {
      //   textString = textString
      //     ? textString + " " + certificate[layout.texts[j].text[k].field]
      //     : certificate[layout.texts[j].text[k].field];
      // }

      // if (layout.texts[j].dateformat) {
      //   textString = customDate.dateFormat(
      //     textString,
      //     layout.texts[j].dateformat.format,
      //     layout.texts[j].dateformat.locale
      //   );
      // }
      // ctx.fillText(textString, layout.texts[j].x, layout.texts[j].y);

      let textString = certificate[layout.texts[j].text];
      if (textString) {
        if (layout.texts[j].dateformat) {
          textString = customDate.dateFormat(
            textString,
            layout.texts[j].dateformat.format,
            layout.texts[j].dateformat.locale
          );
        }
        if (layout.texts[j].digits) {
          textString = nd.replaceDigits(textString, layout.texts[j].digits);
        }
        if (layout.texts[j].color) {
          ctx.fillStyle = layout.texts[j].color;
        }

        ctx.fillText(textString, layout.texts[j].x, layout.texts[j].y);
      }
    }
    return canvas;
  } catch (error) {
    console.error("==== drawCertificate ====\n", error);
    // throw createError(500, "draw image Error");
    throw createError(500);
  }
};
