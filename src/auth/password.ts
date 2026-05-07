import bcrypt from 'bcryptjs';

export const hashPassword = (password: string, saltRounds = 10) =>
  bcrypt.hashSync(password, saltRounds);

export const comparePassword = (password: string, hash: string) =>
  bcrypt.compareSync(password, hash);
