import { formatReceipt } from '../lib/helper.js';
import * as wa from '../whatsapp.js';
import QRCode from 'qrcode';

const createInstance = async (requestData, responseHandler) => {
  const { token } = requestData.body
  if (!token) return responseHandler.status(403).end('Token needed')
  try {
    const first = await wa.connectToWhatsApp(token, requestData.io)
    if (first?.status === true) {
      return responseHandler.send({ status: true, qrcode: null, message: 'Connected' })
    }
    if (first?.qrcode) {
      return responseHandler.send({ status: 'qrcode', qrcode: first.qrcode, message: 'Scan this QR code with your WhatsApp' })
    }
    if (!wa.sock[token]) {
      return responseHandler.send({ status: 'processing', qrcode: null, message: 'Processing' })
    }
    let done = false
    const timeoutMs = 30000
    const result = { status: 'processing', qrcode: null, message: 'Processing' }
    const handler = async (update) => {
      if (done) return
      if (update.connection === 'open') {
        done = true
        try { wa.sock[token].ev.off('connection.update', handler) } catch {}
        result.status = true
        result.qrcode = null
        result.message = 'Connected'
        return responseHandler.send(result)
      }
      if (update.qr) {
        try {
          const dataUrl = await QRCode.toDataURL(update.qr)
          done = true
          try { wa.sock[token].ev.off('connection.update', handler) } catch {}
          result.status = 'qrcode'
          result.qrcode = dataUrl
          result.message = 'Scan this QR code with your WhatsApp'
          return responseHandler.send(result)
        } catch {}
      }
      if (update.connection === 'close') {
        done = true
        try { wa.sock[token].ev.off('connection.update', handler) } catch {}
        result.status = false
        result.qrcode = null
        result.message = 'Disconnected'
        return responseHandler.send(result)
      }
    }
    wa.sock[token].ev.on('connection.update', handler)
    setTimeout(async () => {
      if (done) return
      done = true
      try { wa.sock[token].ev.off('connection.update', handler) } catch {}
      try {
        const last = await wa.connectToWhatsApp(token, requestData.io)
        if (last?.status === true) {
          return responseHandler.send({ status: true, qrcode: null, message: 'Connected' })
        }
        if (last?.qrcode) {
          return responseHandler.send({ status: 'qrcode', qrcode: last.qrcode, message: 'Scan this QR code with your WhatsApp' })
        }
        return responseHandler.send({ status: false, qrcode: null, message: 'Timeout' })
      } catch {
        return responseHandler.send({ status: false, qrcode: null, message: 'Timeout' })
      }
    }, timeoutMs)
  } catch (error) {
    console.log(error)
    return responseHandler.send({ status: false, error })
  }
};

const sendAvailable = async (requestData, responseHandler) => {
    const {
      body: body,
    } = requestData.body
    const sendAvailableResult = await wa.sendAvailable(body)
	return
  };

const sendText = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
	  msgid: msgid,
      text: text,
    } = requestData.body
    if (token && number && text) {
      const sendMessageResult = await wa.sendText(token, number, msgid ?? '', text)
      return handleResponSendMessage(sendMessageResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const sendTextChannel = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      text: text,
    } = requestData.body
    if (token && number && text) {
      const sendTextChannelResult = await wa.sendTextChannel(token, number, text)
      return handleResponSendMessage(sendTextChannelResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const sendLocation = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
	  msgid: msgid,
      latitude: latitude,
	  longitude: longitude,
    } = requestData.body
    if (token && number && latitude && longitude) {
      const sendLocationResult = await wa.sendLocation(token, number, msgid, latitude, longitude)
      return handleResponSendMessage(sendLocationResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const sendProduct = async (requestData, responseHandler) => {
	  const {
		token,
		number,
		product_id,
		phone,
		product_title,
		company_name,
		description,
		price,
		old_price,
		currency,
		image,
		message,
		msgid
	  } = requestData.body

	  if (token && number && product_id && phone) {
		const sendProductResult = await wa.sendProduct(
		  token,
		  number,
		  {
			product_id,
			phone,
			title: product_title,
			company: company_name,
			description,
			price,
			old_price,
			currency,
			image,
			message,
			msgid
		  }
		)
		return handleResponSendMessage(sendProductResult, responseHandler)
	  }

	  responseHandler.send({
		status: false,
		message: 'Check your parameter',
	  })
	};

const sendVcard = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      name: name,
	  phone: phone,
	  msgid: msgid
    } = requestData.body
    if (token && number && name && phone) {
      const sendVcardResult = await wa.sendVcard(token, number, name, phone, msgid ?? '')
      return handleResponSendMessage(sendVcardResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const sendMedia = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      type: type,
      url: url,
      caption: caption,
      ptt: ptt,
	  msgid: msgid,
	  viewonce: viewonce,
      filename: filename,
    } = requestData.body
    if (token && number && type && url) {
      const sendMediaResult = await wa.sendMedia(
        token,
        number,
        type,
        url,
        caption ?? '',
        ptt,
		viewonce ?? false,
        filename,
		msgid ?? ''
      )
      return handleResponSendMessage(sendMediaResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const sendSticker = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      url: url,
	  msgid: msgid
    } = requestData.body
    if (token && number && url) {
      const sendStickerResult = await wa.sendSticker(
        token,
        number,
        url,
		msgid ?? ''
      )
      return handleResponSendMessage(sendStickerResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const sendButtonMessage = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      button: button,
      message: message,
      footer: footer,
      image: image,
    } = requestData.body
    const parsedButton = JSON.parse(button)
    if (token && number && button && message && image) {
      const sendButtonResult = await wa.sendButtonMessage(
        token,
        number,
        parsedButton,
        message,
        footer,
        image
      )
      return handleResponSendMessage(sendButtonResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameterr',
    })
  };

const sendListMessage = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      list: list,
      text: text,
      footer: footer,
      title: title,
      buttonText: buttonText,
	  msgid: msgid,
	  image: image
    } = requestData.body
    if (
      token &&
      number &&
      list &&
      text &&
      title &&
      buttonText &&
      image
    ) {
      const sendListResult = await wa.sendListMessage(
        token,
        number,
        JSON.parse(list),
        text,
        footer ?? '',
        title,
        buttonText,
		msgid ?? '',
		image
      )
      return handleResponSendMessage(sendListResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameterr',
    })
  };

const sendPoll = async (requestData, responseHandler) => {
    const {
      token: token,
      number: number,
      name: name,
      options: options,
      countable: countable,
	  msgid
    } = requestData.body
    if (token && number && name && options && countable) {
      const sendPollResult = await wa.sendPollMessage(
        token,
        number,
        name,
        JSON.parse(options),
        countable,
		msgid ?? ''
      )
      return handleResponSendMessage(sendPollResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameterrss',
    })
  };

const fetchGroups = async (requestData, responseHandler) => {
    const { token: token } = requestData.body
    if (token) {
      const fetchGroupsResult = await wa.fetchGroups(token)
      return handleResponSendMessage(fetchGroupsResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const fetchChannel = async (requestData, responseHandler) => {
    const { token: token, code: code } = requestData.body
    if (token) {
      const fetchChannelResult = await wa.fetchChannel(token, code)
      return handleResponSendMessage(fetchChannelResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const deleteCredentials = async (requestData, responseHandler) => {
    const { token: token } = requestData.body
    if (token) {
      const deleteCredentialsResult = await wa.deleteCredentials(token)
      return handleResponSendMessage(deleteCredentialsResult, responseHandler)
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const handleResponSendMessage = (sendMessageResult, responseHandler, extraParam = null) => {
    if (sendMessageResult) {
      return responseHandler.send({
        status: true,
        data: sendMessageResult,
      })
    }
    return responseHandler.send({
      status: false,
      message: 'Check your whatsapp connection',
    })
  };

const checkNumber = async (requestData, responseHandler) => {
    const { token: token, number: number } = requestData.body
    if (token && number) {
      const isExistResult = await wa.isExist(token, number)
      return (
        console.log(isExistResult),
        responseHandler.send({
          status: true,
          active: isExistResult,
        })
      )
    }
    responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

const logoutDevice = async (requestData, responseHandler) => {
    const { token: token } = requestData.body
    if (token) {
      const deleteCredentialsResult = await wa.deleteCredentials(token)
      return responseHandler.send(deleteCredentialsResult)
    }
    return responseHandler.send({
      status: false,
      message: 'Check your parameter',
    })
  };

export {
  createInstance,
  sendAvailable,
  sendText,
  sendTextChannel,
  sendLocation,
  sendVcard,
  sendMedia,
  sendSticker,
  sendButtonMessage,
  sendProduct,
  sendListMessage,
  deleteCredentials,
  fetchGroups,
  fetchChannel,
  sendPoll,
  logoutDevice,
  checkNumber,
};
