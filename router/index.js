import { myCache } from "../lib/cache.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as controllers from "../controllers/index.js";
import { initialize } from "../whatsapp.js";
import { sendBlastMessage } from "../controllers/blast.js";
import { clearChatSession } from "../controllers/incomingMessage.js";
import {
  checkDestination,
  checkConnectionBeforeBlast,
} from "../lib/middleware.js";

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

router.post("/backend-logout", controllers.deleteCredentials);

router.post("/backend-generate-qr", controllers.createInstance);

router.post("/backend-initialize", initialize);

router.post(
  "/backend-send-list",
  checkDestination,
  controllers.sendListMessage
);

router.post(
  "/backend-send-button",
  checkDestination,
  controllers.sendButtonMessage
);
router.post("/backend-send-media", checkDestination, controllers.sendMedia);

router.post("/backend-send-sticker", checkDestination, controllers.sendSticker);

router.post("/backend-send-text", checkDestination, controllers.sendText);

router.post("/backend-send-text-channel", controllers.sendTextChannel);

router.post("/backend-send-location", checkDestination, controllers.sendLocation);

router.post("/backend-send-product", checkDestination, controllers.sendProduct);

router.post("/backend-send-vcard", checkDestination, controllers.sendVcard);

router.post("/backend-send-poll", checkDestination, controllers.sendPoll);

router.post("/backend-getgroups", controllers.fetchGroups);

router.post("/backend-getchannel", controllers.fetchChannel);

router.post("/backend-blast", checkConnectionBeforeBlast, sendBlastMessage);
router.post("/backend-logout-device", controllers.logoutDevice);

router.post("/backend-check-number", controllers.checkNumber);

router.post("/backend-clearCache", async (req, res) => {
  clearChatSession();
  await controllers.sendAvailable(req, res);
  await myCache.flushAll();
  console.log("Cache cleared");
  return res.json({ status: "success" });
});

export default router;
