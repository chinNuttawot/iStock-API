const responseSuccess = (
  res,
  message = "Success",
  data = null,
  status = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

const responseError = (
  res,
  message = "Something went wrong",
  status = 500,
  data = null
) => {
  return res.status(status).json({
    success: false,
    message,
    data,
  });
};

module.exports = {
  responseSuccess,
  responseError,
};
