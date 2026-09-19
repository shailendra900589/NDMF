/**
 * STANDARD API RESPONSE
 * ---------------------
 * Har API same format me response degi - Flutter aur React dono ke liye easy.
 */
function success(res, data, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function error(res, message = 'Error', status = 400) {
  return res.status(status).json({ success: false, message, data: null });
}

module.exports = { success, error };
