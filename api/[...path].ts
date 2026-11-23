import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rucejbrxmpzrwhxqensy.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';
const SHIKA_SECRET_KEY = process.env.SHIKA_SECRET_KEY || '';
const MTN_RECEIVING_NUMBER = process.env.MTN_RECEIVING_NUMBER || '';

const send = (res: VercelResponse, status: number, body: unknown) =>
  res.status(status).json(body);
const clean = (v: unknown, max = 160) =>
  String(v ?? '').replace(/[<>]/g, '').trim().slice(0, max);

async function userFromToken(token: string) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return await r.json() as { id?: string };
}
async function adminRest(path: string, init: RequestInit = {}) {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const t = await r.text();
  let data: any = null;
  try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  if (!r.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  return data;
}
function dateParam(v: unknown) {
  const d = clean(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(`${d}T00:00:00Z`))) {
    throw new Error('Provide a valid date in YYYY-MM-DD format.');
  }
  return d;
}
function currentSeason() {
  const now = new Date(), y = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}
async function fixtures() {
  const season = currentSeason();
  const leagues = [
    ['en.1', 'English Premier League'], ['de.1', 'German Bundesliga'],
    ['es.1', 'Spanish La Liga'], ['it.1', 'Italian Serie A'], ['fr.1', 'French Ligue 1']
  ];
  const groups = await Promise.allSettled(leagues.map(async ([code, name]) => {
    const r = await fetch(`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${code}.json`);
    if (!r.ok) throw new Error(`${name} feed unavailable`);
    const data = await r.json() as any;
    return (data.matches || []).map((m: any) => ({ m, league: data.name || name }));
  }));
  const now = Date.now();
  const rows = groups.flatMap(x => x.status === 'fulfilled' ? x.value : [])
    .filter(({m}: any) => m.date && m.team1 && m.team2 && !m.score?.ft && new Date(`${m.date}T23:59:59Z`).getTime() >= now)
    .map(({m, league}: any) => ({
      id: `openfootball-${league}-${m.date}-${m.team1}-${m.team2}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      league, date: m.date, time: m.time || null, home: m.team1, away: m.team2,
      round: m.round || null, odds: [], source: 'OpenFootball'
    }))
    .sort((a: any,b: any) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
  return { fixtures: rows, source: 'OpenFootball', updatedAt: new Date().toISOString(), note: 'Upcoming fixtures only.' };
}
async function footballData(kind: 'odds' | 'results', date: string) {
  if (!API_FOOTBALL_KEY) throw new Error('API_FOOTBALL_KEY is not configured on Vercel.');
  const endpoint = kind === 'odds' ? 'odds' : 'fixtures';
  const r = await fetch(`https://v3.football.api-sports.io/${endpoint}?date=${encodeURIComponent(date)}${kind === 'odds' ? '&page=1' : ''}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY, Accept: 'application/json' }
  });
  const raw = await r.json() as any;
  if (!r.ok || (raw.errors && Object.keys(raw.errors).length)) throw new Error(JSON.stringify(raw.errors || `HTTP ${r.status}`));
  const rows = (raw.response || []).map((x: any) => {
    if (kind === 'results') return {
      fixtureId: x.fixture?.id ?? null, kickoff: x.fixture?.date ?? null,
      status: String(x.fixture?.status?.short || '').toUpperCase(),
      statusText: x.fixture?.status?.long || '', league: x.league?.name || '',
      home: x.teams?.home?.name || '', away: x.teams?.away?.name || '',
      homeScore: x.goals?.home ?? null, awayScore: x.goals?.away ?? null
    };
    const books = x.bookmakers || [];
    const book = books.find((b: any) => (b.bets || []).some((m: any) => /match winner|1x2|winner/i.test(m.name || '')));
    const market = book?.bets?.find((m: any) => /match winner|1x2|winner/i.test(m.name || ''));
    const values = market?.values || [];
    const odd = (p: RegExp) => {
      const n = Number(values.find((v: any) => p.test(v.value || '') && !v.suspended)?.odd);
      return Number.isFinite(n) && n > 1 ? n : null;
    };
    return {
      fixtureId: x.fixture?.id ?? null, kickoff: x.fixture?.date ?? null,
      status: x.fixture?.status?.short ?? null, league: x.league?.name ?? null,
      home: x.teams?.home?.name ?? null, away: x.teams?.away?.name ?? null,
      bookmaker: book?.name ?? null, market: market?.name ?? null,
      odds: { home: odd(/^home$/i), draw: odd(/^draw$/i), away: odd(/^away$/i) }
    };
  }).filter((x: any) => x.fixtureId && x.home && x.away);
  return { date, source: 'API-Football', updatedAt: new Date().toISOString(), results: raw.results ?? rows.length, fixtures: rows };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = `/api/${String(req.query.path || '').replace(/^\/+|\/+$/g, '')}`;
  try {
    if (req.method === 'GET' && route === '/api/_healthcheck') return send(res, 200, { message: 'Success' });
    if (req.method === 'GET' && route === '/api/fixtures') return send(res, 200, await fixtures());

    if (req.method === 'GET' && (route === '/api/bookmaker-odds' || route === '/api/results')) {
      const date = dateParam(req.query.date);
      return send(res, 200, await footballData(route.endsWith('results') ? 'results' : 'odds', date));
    }

    if (req.method === 'POST' && route === '/api/deposit-receiving-instructions') {
      const token = clean((req.body || {}).access_token, 4000);
      if (!SERVICE_KEY || !MTN_RECEIVING_NUMBER) return send(res, 503, { error: 'Deposit instructions are not configured.' });
      const user = await userFromToken(token);
      if (!user?.id) return send(res, 401, { error: 'Please sign in again.' });
      if (!/^(?:\+233[0-9]{9}|0[0-9]{9})$/.test(MTN_RECEIVING_NUMBER)) return send(res, 503, { error: 'Receiving number is not configured correctly.' });
      return send(res, 200, { network: 'MTN Mobile Money', receivingNumber: MTN_RECEIVING_NUMBER });
    }

    if (req.method === 'POST' && route === '/api/create-deposit-payment') {
      if (!SERVICE_KEY || !SHIKA_SECRET_KEY) return send(res, 503, { success: false, error: 'Payment service is not configured.' });
      const token = clean((req.body || {}).access_token || String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), 4000);
      const requestId = clean((req.body || {}).request_id, 80);
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return send(res, 400, { success: false, error: 'Invalid deposit request.' });
      const user = await userFromToken(token);
      if (!user?.id) return send(res, 401, { success: false, error: 'Please sign in again.' });
      const found = await adminRest(`deposit_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,amount,payment_method,payment_reference,status,shika_payment_id`);
      const d = found?.[0];
      if (!d) return send(res, 404, { success: false, error: 'Deposit request not found.' });
      if (d.status !== 'pending' || d.shika_payment_id) return send(res, 409, { success: false, error: 'This deposit request has already been processed or submitted.' });
      const providers: Record<string,string> = { 'MTN Mobile Money':'mtn', 'Telecel Cash':'telecel', 'AirtelTigo Money':'airteltigo' };
      const provider = providers[d.payment_method], phone = String(d.payment_reference || '').replace(/\s+/g, '');
      if (!provider || !/^0[0-9]{9}$/.test(phone)) return send(res, 400, { success: false, error: 'Enter a valid Ghana mobile money number and network.' });
      const pay = await fetch('https://api.shikacreators.com/v1/payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SHIKA_SECRET_KEY}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': requestId },
        body: JSON.stringify({ amount: Number(d.amount), currency: 'GHS', payment_method: { type: 'mobile_money', phone_number: phone, provider }, description: `Classic Sporty Hacks wallet deposit ${requestId}`, metadata: { deposit_request_id: requestId, user_id: user.id } })
      });
      const payment = await pay.json().catch(() => ({})) as any;
      if (!pay.ok || !payment.id) return send(res, 502, { success: false, error: clean(payment.message || payment.error || `Payment provider HTTP ${pay.status}`, 220) });
      await adminRest(`deposit_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ shika_payment_id: payment.id })
      });
      return send(res, 200, { success: true, payment_id: payment.id, status: payment.status || 'pending', message: 'Payment request sent. Approve the prompt on your phone.' });
    }

    if (req.method === 'POST' && route === '/api/match-preview') {
      const m = (req.body || {}).match || {};
      if (!clean(m.home) || !clean(m.away)) return send(res, 400, { error: 'A valid fixture is required.' });
      const odds = Array.isArray(m.odds) ? m.odds.slice(0,3) : [];
      const preview = `Match overview: ${clean(m.home,100)} vs ${clean(m.away,100)} in ${clean(m.league,120) || 'an unspecified competition'}. Kickoff: ${clean(m.time,80) || 'not supplied'}. Current score: ${clean(m.score,40) || 'not supplied'}.\\n\\nOdds context: ${odds.length ? odds.join(' / ') : 'No bookmaker odds were supplied, so no market assessment is possible.'}\\n\\nKey uncertainties: Team form, lineups, injuries and other supporting data were not supplied.\\n\\nCautious summary: This is a limited description of the supplied fixture only. It does not establish a likely winner or guarantee an outcome.`;
      return send(res, 200, { preview, fixture: m, disclaimer: 'Informational analysis only; outcomes are uncertain.' });
    }

    return send(res, 404, { error: 'API route not found.' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server request failed.';
    console.error('API route error:', message.slice(0, 400));
    return send(res, 502, { error: message.slice(0, 260) });
  }
}