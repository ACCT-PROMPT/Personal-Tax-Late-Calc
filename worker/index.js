const PROGRAM_SLUG = 'personal-tax-late-calc';
const MEMBER_ORIGIN = 'https://acctprompt.com';
const SESSION_COOKIE = '__Host-acctprompt_tax_late_session';
const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60;

function tokenFromCookie(request) {
  const cookies = request.headers.get('Cookie') || '';
  for (const part of cookies.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      const token = value.join('=');
      return /^[a-f0-9]{64}$/.test(token) ? token : '';
    }
  }
  return '';
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function messagePage(status, title, message, clearCookie = false) {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  if (clearCookie) headers.append('Set-Cookie', clearSessionCookie());
  return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px system-ui,sans-serif;max-width:620px;margin:12vh auto;padding:24px;color:#261c36"><h1>${title}</h1><p>${message}</p><p><a href="${MEMBER_ORIGIN}/my-programs" target="_top">กลับไปโปรแกรมของฉัน</a></p></body></html>`, { status, headers });
}

async function memberRequest(env, action, token) {
  const response = await env.MEMBER_EDGE.fetch(new Request(`${MEMBER_ORIGIN}/api/program-bridge/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, slug: PROGRAM_SLUG }),
    signal: AbortSignal.timeout(10000),
  }));
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { response, body };
}

async function validate(env, token) {
  if (!token) return { ok: false, unauthorized: true };
  const { response, body } = await memberRequest(env, 'validate', token);
  if (response.ok && body?.slug === PROGRAM_SLUG) return { ok: true, body };
  if (response.status === 401 || response.status === 403) return { ok: false, unauthorized: true };
  return { ok: false, unauthorized: false };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const ticket = url.searchParams.get('launch_ticket');
    const isDocument = url.pathname === '/' || url.pathname === '/index.html';
    if (ticket !== null) {
      if (!isDocument || !/^[a-f0-9]{64}$/.test(ticket)) {
        return messagePage(400, 'ลิงก์เปิดโปรแกรมไม่ถูกต้อง', 'กลับไปเปิดโปรแกรมจากหน้าโปรแกรมของฉันอีกครั้ง');
      }
      try {
        const { response, body } = await memberRequest(env, 'redeem', ticket);
        const expiresAt = Date.parse(body?.expiresAt || '');
        if (!response.ok || body?.slug !== PROGRAM_SLUG || !/^[a-f0-9]{64}$/.test(body?.token || '') || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          return messagePage(response.status === 503 ? 503 : 401, 'เปิดโปรแกรมไม่สำเร็จ', 'ลิงก์อาจหมดอายุ หรือบัญชีไม่มีสิทธิ์ใช้งาน กรุณากลับไปเปิดจากโปรแกรมของฉัน', true);
        }
        const seconds = Math.max(1, Math.min(MAX_SESSION_SECONDS, Math.floor((expiresAt - Date.now()) / 1000)));
        const headers = new Headers({
          Location: `${url.origin}/`,
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        });
        headers.append('Set-Cookie', `${SESSION_COOKIE}=${body.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`);
        return new Response(null, { status: 303, headers });
      } catch {
        return messagePage(503, 'เชื่อมต่อระบบสมาชิกไม่ได้', 'กรุณาลองเปิดโปรแกรมอีกครั้งจากหน้าโปรแกรมของฉัน');
      }
    }

    const token = tokenFromCookie(request);
    if (url.pathname === '/__member-session') {
      try {
        const result = await validate(env, token);
        if (result.ok) return Response.json({ ok: true, expiresAt: result.body.expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
        return Response.json({ ok: false }, { status: result.unauthorized ? 401 : 503, headers: { 'Cache-Control': 'no-store', ...(result.unauthorized ? { 'Set-Cookie': clearSessionCookie() } : {}) } });
      } catch {
        return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    if (!token) {
      return messagePage(401, 'ต้องเปิดผ่านบัญชี ACCT Prompt', 'เข้าสู่ระบบและเปิดโปรแกรมนี้จากหน้าโปรแกรมของฉัน เพื่อยืนยันสิทธิ์การใช้งาน');
    }

    if (isDocument) {
      try {
        const result = await validate(env, token);
        if (!result.ok) {
          if (result.unauthorized) return messagePage(401, 'สิทธิ์ใช้งานหมดอายุหรือถูกยกเลิก', 'กลับไปตรวจสอบสิทธิ์และเปิดโปรแกรมจากหน้าโปรแกรมของฉัน', true);
          return messagePage(503, 'ตรวจสอบสิทธิ์ชั่วคราวไม่ได้', 'โปรดลองโหลดหน้านี้อีกครั้งในภายหลัง');
        }
      } catch {
        return messagePage(503, 'เชื่อมต่อระบบสมาชิกไม่ได้', 'โปรดลองโหลดหน้านี้อีกครั้งในภายหลัง');
      }
    }

    return env.ASSETS.fetch(request);
  },
};
