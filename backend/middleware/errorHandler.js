const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.stack);

  // Multer errors
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({ msg: err.message });
  }

  // MongoDB validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ msg: 'Validation Error', errors });
  }

  // MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ msg: `${field} already exists` });
  }

  // Default error
  res.status(err.status || 500).json({
    msg: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;