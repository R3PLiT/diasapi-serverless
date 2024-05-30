const errorHandler = (err, req, res, next) => {
  console.error("==== errorHandler ====");
  // console.error(err.stack);
  if (err.status && err.status < 500) {
    if (err.customMessage) {
      console.error(
        `status ${err.status} message: ${JSON.stringify(err.customMessage)}\n`
      );
      res.status(err.status).json(err.customMessage);
    } else {
      console.error(`status ${err.status} message: ${err.message}\n`);
      res.status(err.status).json({ message: err.message });
    }
  } else {
    console.error(
      `status ${err.status || 500} error: ${
        err.message || "Internal Server Error"
      }\n`
    );
    res
      .status(err.status || 500)
      .json({ error: err.message || "Internal Server Error" });
  }
};

export default errorHandler;
