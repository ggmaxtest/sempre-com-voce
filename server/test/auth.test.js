import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../src/modules/auth/service.js';

describe('Segurança de senha (bcrypt)', () => {
  it('nunca armazena a senha em texto puro e verifica corretamente', async () => {
    const plain = 'SenhaForte#2026';
    const hash = await bcrypt.hash(plain, 12);
    expect(hash).not.toContain(plain);
    expect(hash.startsWith('$2')).toBe(true); // prefixo bcrypt
    expect(await bcrypt.compare(plain, hash)).toBe(true);
    expect(await bcrypt.compare('senhaErrada', hash)).toBe(false);
  });
});

describe('JWT', () => {
  it('rejeita tokens inválidos / adulterados', () => {
    expect(verifyToken('token.invalido.aqui')).toBeNull();
    expect(verifyToken('')).toBeNull();
  });

  it('aceita token assinado com o segredo configurado', () => {
    const secret = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
    const token = jwt.sign({ sub: 'u1', role: 'USER' }, secret, { expiresIn: '1h' });
    const decoded = verifyToken(token);
    expect(decoded?.sub).toBe('u1');
  });
});
