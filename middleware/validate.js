const { validationResult, body, param } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

const registerSchema = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio.'),
  body('email').trim().isEmail().withMessage('Introduce un correo electrónico válido.'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'),
  validate
];

const loginSchema = [
  body('email').trim().isEmail().withMessage('Introduce un correo electrónico válido.'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria.'),
  validate
];

const resetPasswordSchema = [
  body('token').trim().notEmpty().withMessage('El token de restablecimiento es obligatorio.'),
  body('password').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres.'),
  validate
];

const profileSchema = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio.'),
  body('timezone').trim().notEmpty().withMessage('La zona horaria es obligatoria.'),
  validate
];

const changePasswordSchema = [
  body('currentPassword').notEmpty().withMessage('La contraseña actual es obligatoria.'),
  body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres.'),
  validate
];

const courseSchema = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio.'),
  body('description').trim().notEmpty().withMessage('La descripción es obligatoria.'),
  body('thumbnail').trim().isURL().withMessage('Introduce una URL de miniatura válida.'),
  body('category').trim().notEmpty().withMessage('La categoría es obligatoria.'),
  validate
];

const moduleSchema = [
  body('course_id').isInt().withMessage('El ID de curso debe ser un entero.'),
  body('title').trim().notEmpty().withMessage('El título es obligatorio.'),
  body('order_num').isInt().withMessage('El orden debe ser un entero.'),
  validate
];

const lessonSchema = [
  body('module_id').isInt().withMessage('El ID del módulo debe ser un entero.'),
  body('title').trim().notEmpty().withMessage('El título es obligatorio.'),
  body('order_num').isInt().withMessage('El número de orden debe ser un entero.'),
  validate
];

const sessionSchema = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio.'),
  body('date_time').isISO8601().withMessage('Introduce una fecha y hora válidas (ISO 8601).'),
  body('duration').trim().notEmpty().withMessage('La duración es obligatoria.'),
  validate
];

const postSchema = [
  body('title').trim().notEmpty().withMessage('El título es obligatorio.'),
  body('content').trim().notEmpty().withMessage('El contenido no puede estar vacío.'),
  validate
];

const replySchema = [
  body('content').trim().notEmpty().withMessage('La respuesta no puede estar vacía.'),
  validate
];

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  profileSchema,
  changePasswordSchema,
  courseSchema,
  moduleSchema,
  lessonSchema,
  sessionSchema,
  postSchema,
  replySchema
};
