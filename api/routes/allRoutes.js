import express from "express";
import multer from "multer";

import authenticateRole from "../middlewares/authMiddleware.js";

import { userDetail } from "../controllers/usersControllers.js";
import {
  register,
  login,
  emailExists,
  userDetail,
  getAllUser,
  getUserById,
  deleteUserById,
  updateUserById,
  addInstitute,
  institutesList,
  getInstituteById,
  getInstituteCourses,
  getMyCourses,
  addCourse,
  getCourseById,
  updateCourseById,
  deleteCourseById,
  addGraduates,
  getGraduates,
  getGraduateById,
  updateGraduateById,
  deleteGraduateById,
  certificateJson,
  certificatePNG,
  certificatesList,
  issueCertificates,
  prepareCetificates,
  revokeCertificate,
  sendCertificates,
  verifyCertificate,
  makeCertificatesData,
} from "../controllers/allControllers.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 },
});

const router = express.Router();

// ===== main =====
router.get("/", (req, res, next) => {
  res.send({ message: "=== diasAPI ===" });
});

router.post("/register", register);
router.post("/login", login);

router.get("/emails/:email", emailExists);

// ===== admins =====
router.get("/admins/me", authenticateRole("admin"), userDetail);

// ===== certificates =====
router.get("/certificates", authenticateRole("issuer"), certificatesList);

router.get("/certificates/:certificateUUID", certificateJson);
router.get("/certificates/:certificateUUID/image", certificatePNG);

router.delete(
  "/certificates/:certificateUUID/revoke",
  authenticateRole("issuer"),
  revokeCertificate
);

router.post(
  "/certificates/verify",
  upload.single("certificateFile"),
  verifyCertificate
);

router.post(
  "/certificates/make",
  authenticateRole("admin"),
  makeCertificatesData
);
router.post("/certificates/mail", authenticateRole("admin"), sendCertificates);

// ====================
router.post(
  "/certificates/prepare",
  authenticateRole("issuer"),
  prepareCetificates
);
router.post(
  "/certificates/issue",
  authenticateRole("issuer"),
  issueCertificates
);

// ===== courses =====
router.get("/courses", authenticateRole("issuer"), getInstituteCourses);
router.get("/courses/me", authenticateRole("admin", "issuer"), getMyCourses);
router.post("/courses", authenticateRole("issuer"), addCourse);
router.get("/courses/:_id", authenticateRole("admin", "issuer"), getCourseById);
router.patch("/courses/:_id", authenticateRole("issuer"), updateCourseById);
router.delete("/courses/:_id", authenticateRole("issuer"), deleteCourseById);

router.get(
  "/courses/:courseId/graduates/:_id",
  authenticateRole("issuer"),
  getGraduateById
);
router.patch(
  "/courses/:courseId/graduates/:_id",
  authenticateRole("issuer"),
  updateGraduateById
);
router.delete(
  "/courses/:courseId/graduates/:_id",
  authenticateRole("issuer"),
  deleteGraduateById
);

router.post(
  "/courses/:_id/graduates",
  authenticateRole("issuer"),
  addGraduates
);
router.get(
  "/courses/:_id/graduates",
  authenticateRole("admin", "issuer"),
  getGraduates
);

// ===== institutes =====
router.get("/institutes", institutesList);
router.post("/institutes", authenticateRole("admin"), addInstitute);

router.get("/institutes/:_id", getInstituteById);

// ===== issuers =====
router.post("/issuers", authenticateRole("admin"), register);

router.get("/issuers/me", authenticateRole("issuer"), userDetail);

router.get("/issuers/me/courses", authenticateRole("issuer"), getMyCourses);

// ===== users =====
router.get(
  "/users/me",
  authenticateRole("admin", "issuer", "user"),
  userDetail
);
router.get(
  "/users/me/certificates",
  authenticateRole("user"),
  certificatesList
);

router.post("/users", authenticateRole("admin"), register);

router.get("/users", getAllUser);
router.get("/users/:_id", getUserById);
router.patch(
  "/users/:_id",
  authenticateRole("admin", "issuer", "user"),
  updateUserById
);
router.delete(
  "/users/:_id",
  authenticateRole("admin", "issuer", "user"),
  deleteUserById
);

export default router;
