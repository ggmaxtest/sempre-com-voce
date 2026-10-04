import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../src/modules/auth/service.js';

describe('Segurança de senha (Argon2)', () => {
  it('nunca armazena a senha em texto puro e verifica corretamente', async () => {
    const plain = 'SenhaForte#2026';
    const hash = await argon2.hash(plain, { type: argon2.argon2id });
    expect(hash).not.toContain(plain);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(hash, plain)).toBe(true);
    expect(await argon2.verify(hash, 'senhaErrada')).toBe(false);
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
