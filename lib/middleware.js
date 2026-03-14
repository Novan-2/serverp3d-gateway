import * as wa from "../whatsapp.js";
import { sock } from "../whatsapp.js";
import { formatReceipt } from "./helper.js";

const checkDestination = async (req, res, next) => {
  const { token, number } = req.body;
  if (token && number) {
    const check = await wa.isExist(token, formatReceipt(number));

    if (!check) {
      return res.send({
        status: false,
        message:
          "The destination Number not registered in WhatsApp or your sender not connected",
      });
  }
    next();
  } else {
    res.send({ status: false, message: "Check your parameter" });
  }
};

const checkConnectionBeforeBlast = async (req, res, next) => {
  try {
    const data = JSON.parse(req.body.data);
    if (!data.sender || !sock[data.sender] || !sock[data.sender].user) {
      return res.send({
        status: false,
        message: `Unauthorized`,
      });
    }
    next();
  } catch {
    return res.send({
      status: false,
      message: `Unauthorized`,
    });
  }
};

export { checkDestination, checkConnectionBeforeBlast };
