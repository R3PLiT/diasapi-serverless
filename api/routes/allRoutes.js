import express from "express";
import multer from "multer";
import authenticateRole from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/allControllers.js";
// import {
//   register,
//   login,
//   emailExists,
//   userDetail,
//   getAllUser,
//   getUserById,
//   deleteUserById,
//   updateUserById,
//   addInstitute,
//   institutesList,
//   getInstituteById,
//   getInstituteCourses,
//   getMyCourses,
//   addCourse,
//   getCourseById,
//   updateCourseById,
//   deleteCourseById,
//   addGraduates,
//   getGraduates,
//   getGraduateById,
//   updateGraduateById,
//   deleteGraduateById,
//   certificateJson,
//   certificatePNG,
//   certificatesList,
//   issueCertificates,
//   prepareCetificates,
//   revokeCertificate,
//   sendCertificates,
//   verifyCertificate,
//   makeCertificatesData,
// } from "../controllers/allControllers.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 },
});

const router = express.Router();

// ===== main =====
router.get("/", (req, res, next) => {
  res.send({ message: "=== diasAPI serverless ===" });
});

router.get("/favicon.ico", (req, res) => res.status(204).end());
router.get("/favicon.png", (req, res) => res.status(204).end());

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);

router.get("/emails/:email", ctrl.emailExists);

// ===== admins =====
router.get("/admins/me", authenticateRole("admin"), ctrl.userDetail);

// ===== certificates =====
router.get("/certificates", authenticateRole("issuer"), ctrl.certificatesList);

router.get("/certificates/:certificateUUID", ctrl.certificateJson);
router.get("/certificates/:certificateUUID/image", ctrl.certificatePNG);

router.delete(
  "/certificates/:certificateUUID/revoke",
  authenticateRole("issuer"),
  ctrl.revokeCertificate
);

router.post("/certificates/verify", upload.single("certificateFile"), ctrl.verifyCertificate);

router.post("/certificates/make", authenticateRole("admin"), ctrl.makeCertificatesData);
router.post("/certificates/mail", authenticateRole("admin"), ctrl.sendCertificates);

// ====================
router.post("/certificates/prepare", authenticateRole("issuer"), ctrl.prepareCetificates);
router.post("/certificates/issue", authenticateRole("issuer"), ctrl.issueCertificates);

// ===== courses =====
router.get("/courses", authenticateRole("issuer"), ctrl.getInstituteCourses);
router.get("/courses/me", authenticateRole("admin", "issuer"), ctrl.getMyCourses);
router.post("/courses", authenticateRole("issuer"), ctrl.addCourse);
router.get("/courses/:_id", authenticateRole("admin", "issuer"), ctrl.getCourseById);
router.patch("/courses/:_id", authenticateRole("issuer"), ctrl.updateCourseById);
router.delete("/courses/:_id", authenticateRole("issuer"), ctrl.deleteCourseById);

router.get("/courses/:courseId/graduates/:_id", authenticateRole("issuer"), ctrl.getGraduateById);
router.patch(
  "/courses/:courseId/graduates/:_id",
  authenticateRole("issuer"),
  ctrl.updateGraduateById
);
router.delete(
  "/courses/:courseId/graduates/:_id",
  authenticateRole("issuer"),
  ctrl.deleteGraduateById
);

router.post("/courses/:_id/graduates", authenticateRole("issuer"), ctrl.addGraduates);
router.get("/courses/:_id/graduates", authenticateRole("admin", "issuer"), ctrl.getGraduates);

// ===== institutes =====
router.get("/institutes", ctrl.institutesList);
router.post("/institutes", authenticateRole("admin"), ctrl.addInstitute);

router.get("/institutes/:_id", ctrl.getInstituteById);

// ===== issuers =====
router.post("/issuers", authenticateRole("admin"), ctrl.register);

router.get("/issuers/me", authenticateRole("issuer"), ctrl.userDetail);

router.get("/issuers/me/courses", authenticateRole("issuer"), ctrl.getMyCourses);

// ===== users =====
router.get("/users/me", authenticateRole("admin", "issuer", "user"), ctrl.userDetail);
router.get("/users/me/certificates", authenticateRole("user"), ctrl.certificatesList);

router.post("/users", authenticateRole("admin"), ctrl.register);

router.get("/users", ctrl.getAllUser);
router.get("/users/:_id", ctrl.getUserById);
router.patch("/users/:_id", authenticateRole("admin", "issuer", "user"), ctrl.updateUserById);
router.delete("/users/:_id", authenticateRole("admin", "issuer", "user"), ctrl.deleteUserById);

export default router;
