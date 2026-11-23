import { router, json, error, ai, secrets } from '@appdeploy/sdk';

type PreviewMatch = {
  id?: string;
  league?: string;
  time?: string;
  home?: string;
  away?: string;
  score?: string;
  odds?: string[];
  live?: boolean;
};

type OpenFootballMatch = {
  date?: string;
  time?: string;
  team1?: string;
  team2?: string;
  score?: { ft?: number[] };
  round?: string;
};

type ApiFootballValue = { value?: string; odd?: string; suspended?: boolean };
type ApiFootballBet = { name?: string; values?: ApiFootballValue[] };
type ApiFootballBookmaker = { name?: string; bets?: ApiFootballBet[] };
type ApiFootballOddsRow = {
  fixture?: { id?: number; date?: string; status?: { short?: string } };
  league?: { name?: string; country?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  bookmakers?: ApiFootballBookmaker[];
};

type ApiFootballResultRow = {
  fixture?: { id?: number; date?: string; status?: { short?: string; long?: string } };
  league?: { name?: string; country?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
};

const clean = (value: unknown, max = 160): string =>
  String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);

const currentSeason = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
};

const loadOpenFootballFixtures = async () => {
  const season = currentSeason();
  const leagues = [
    { code: 'en.1', name: 'English Premier League' },
    { code: 'de.1', name: 'German Bundesliga' },
    { code: 'es.1', name: 'Spanish La Liga' },
    { code: 'it.1', name: 'Italian Serie A' },
    { code: 'fr.1', name: 'French Ligue 1' },
  ];

  const results = await Promise.allSettled(leagues.map(async (league) => {
    const response = await fetch(
      `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${league.code}.json`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) throw new Error(`${league.name} feed returned ${response.status}`);
    const dataset = await response.json() as { matches?: OpenFootballMatch[]; name?: string };
    return (dataset.matches || []).map((match) => ({ match, league: dataset.name || league.name }));
  }));

  const now = Date.now();
  const fixtures = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .filter(({ match }) => {
      if (!match.date || !match.team1 || !match.team2 || match.score?.ft) return false;
      const endOfMatchDay = new Date(`${match.date}T23:59:59Z`).getTime();
      return Number.isFinite(endOfMatchDay) && endOfMatchDay >= now;
    })
    .map(({ match, league }) => ({
      id: `openfootball-${league}-${match.date}-${match.team1}-${match.team2}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      league,
      date: match.date,
      time: match.time || null,
      home: match.team1,
      away: match.team2,
      round: match.round || null,
      odds: [],
      source: 'OpenFootball',
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));

  if (!fixtures.length && results.every((result) => result.status === 'rejected')) {
    throw new Error('The free fixture source is temporarily unavailable.');
  }
  return fixtures;
};

const oddsCache = new Map<string, { expiresAt: number; payload: unknown }>();
const resultsCache = new Map<string, { expiresAt: number; payload: unknown }>();

const loadApiFootballOdds = async (date: string) => {
  const cached = oddsCache.get(date);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const key = await secrets.readSecret('API_FOOTBALL_KEY');
  const response = await fetch(`https://v3.football.api-sports.io/odds?date=${encodeURIComponent(date)}&page=1`, {
    method: 'GET',
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  });
  const raw = await response.json() as {
    errors?: Record<string, unknown> | unknown[];
    results?: number;
    response?: ApiFootballOddsRow[];
  };

  if (!response.ok || (raw.errors && Object.keys(raw.errors).length)) {
    const detail = JSON.stringify(raw.errors || `HTTP ${response.status}`).slice(0, 240);
    throw new Error(`API-Football rejected the odds request: ${detail}`);
  }

  const fixtures = (raw.response || []).map((row) => {
    const bookmakers = row.bookmakers || [];
    const selected = bookmakers.find((bookmaker) => (bookmaker.bets || []).some((bet) =>
      /match winner|1x2|winner/i.test(bet.name || '')
    ));
    const market = selected?.bets?.find((bet) => /match winner|1x2|winner/i.test(bet.name || ''));
    const values = market?.values || [];
    const findOdd = (pattern: RegExp) => {
      const item = values.find((value) => pattern.test(value.value || '') && !value.suspended);
      const price = Number(item?.odd);
      return Number.isFinite(price) && price > 1 ? price : null;
    };
    return {
      fixtureId: row.fixture?.id ?? null,
      kickoff: row.fixture?.date ?? null,
      status: row.fixture?.status?.short ?? null,
      league: row.league?.name ?? null,
      home: row.teams?.home?.name ?? null,
      away: row.teams?.away?.name ?? null,
      bookmaker: selected?.name ?? null,
      market: market?.name ?? null,
      odds: { home: findOdd(/^home$/i), draw: findOdd(/^draw$/i), away: findOdd(/^away$/i) },
    };
  }).filter((fixture) => fixture.fixtureId && fixture.home && fixture.away);

  const payload = {
    date,
    source: 'API-Football',
    updatedAt: new Date().toISOString(),
    results: raw.results ?? fixtures.length,
    fixtures,
    note: 'Only bookmaker prices returned by API-Football are included. Coverage depends on the competition and bookmaker.',
  };
  oddsCache.set(date, { expiresAt: Date.now() + 3 * 60 * 60 * 1000, payload });
  return payload;
};

const loadApiFootballResults = async (date: string) => {
  const cached = resultsCache.get(date);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const key = await secrets.readSecret('API_FOOTBALL_KEY');
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}`, {
    method: 'GET',
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  });
  const raw = await response.json() as {
    errors?: Record<string, unknown> | unknown[];
    results?: number;
    response?: ApiFootballResultRow[];
  };

  if (!response.ok || (raw.errors && Object.keys(raw.errors).length)) {
    const detail = JSON.stringify(raw.errors || `HTTP ${response.status}`).slice(0, 240);
    throw new Error(`API-Football rejected the results request: ${detail}`);
  }

  const fixtures = (raw.response || []).map((row) => ({
    fixtureId: row.fixture?.id ?? null,
    kickoff: row.fixture?.date ?? null,
    status: String(row.fixture?.status?.short || '').toUpperCase(),
    statusText: row.fixture?.status?.long || '',
    league: row.league?.name || '',
    home: row.teams?.home?.name || '',
    away: row.teams?.away?.name || '',
    homeScore: row.goals?.home ?? null,
    awayScore: row.goals?.away ?? null,
  })).filter((row) => row.fixtureId && row.home && row.away);

  const payload = {
    date,
    source: 'API-Football',
    updatedAt: new Date().toISOString(),
    results: raw.results ?? fixtures.length,
    fixtures,
    note: 'Only provider-reported fixture statuses and scores are returned. A match is eligible for automatic settlement only when its status is FT, AET or PEN.',
  };
  resultsCache.set(date, { expiresAt: Date.now() + 10 * 60 * 1000, payload });
  return payload;
};

const SUPABASE_URL = 'https://rucejbrxmpzrwhxqensy.supabase.co';

const readHeader = (event: any, name: string): string => {
  const headers = event?.headers || {};
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] || '') : '';
};

const supabaseAdminRequest = async (path: string, serviceKey: string, init: RequestInit = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  return data;
};

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'POST /api/deposit-receiving-instructions': [async ({ body }) => {
    try {
      const input = body as { access_token?: string } | null;
      const accessToken = clean(input?.access_token, 4000);
      if (!accessToken) return error('Please sign in to view private deposit instructions.', 401);

      const secretNames = await secrets.listSecretNames();
      if (!secretNames.includes('SUPABASE_SERVICE_ROLE_KEY') || !secretNames.includes('MTN_RECEIVING_NUMBER')) {
        return error('MTN receiving details are not fully configured. Please contact support.', 503);
      }

      const serviceKey = await secrets.readSecret('SUPABASE_SERVICE_ROLE_KEY');
      const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
      });
      if (!authResponse.ok) return error('Your session could not be verified. Please sign in again.', 401);

      const user = await authResponse.json() as { id?: string };
      if (!user.id) return error('Your session could not be verified.', 401);

      const receivingNumber = clean(await secrets.readSecret('MTN_RECEIVING_NUMBER'), 32);
      if (/^(?:\+233[0-9]{9}|0[0-9]{9})$/.test(receivingNumber) === false) {
        return error('The configured MTN receiving number is not in a valid Ghana format. Please contact support.', 503);
      }

      return json({ network: 'MTN Mobile Money', receivingNumber });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load private deposit instructions.';
      console.error('Private deposit instructions failed', message.slice(0, 300));
      return error('Could not load private deposit instructions. Please try again.', 503);
    }
  }],

  'POST /api/create-deposit-payment': [async ({ body, event }) => {
    try {
      const input = body as { request_id?: string; access_token?: string } | null;
      const requestId = clean(input?.request_id, 80);
      const authorization = readHeader(event, 'authorization');
      const accessToken = clean(input?.access_token || authorization.replace(/^Bearer\s+/i, ''), 4000).trim();

      if (!accessToken) return error('Please sign in again before making a deposit.', 401);
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return error('Invalid deposit request.', 400);

      const secretNames = await secrets.listSecretNames();
      if (!secretNames.includes('SHIKA_SECRET_KEY') || !secretNames.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        return error('The payment service is not fully configured. Please contact support.', 503);
      }

      const shikaKey = await secrets.readSecret('SHIKA_SECRET_KEY');
      const serviceKey = await secrets.readSecret('SUPABASE_SERVICE_ROLE_KEY');

      const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
      });
      if (!authResponse.ok) return error('Your session could not be verified. Please sign in again.', 401);

      const user = await authResponse.json() as { id?: string };
      if (!user.id) return error('Your session could not be verified.', 401);

      const rows = await supabaseAdminRequest(
        `deposit_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,amount,payment_method,payment_reference,status,shika_payment_id`,
        serviceKey
      ) as Array<{
        id: string;
        user_id: string;
        amount: number;
        payment_method: string;
        payment_reference: string;
        status: string;
        shika_payment_id?: string | null;
      }>;

      const deposit = rows?.[0];
      if (!deposit) return error('Deposit request was not found for this account.', 404);
      if (deposit.status !== 'pending') return error('This deposit request has already been processed.', 409);
      if (deposit.shika_payment_id) return error('A payment prompt has already been created for this deposit.', 409);

      const providerMap: Record<string, string> = {
        'MTN Mobile Money': 'mtn',
        'Telecel Cash': 'telecel',
        'AirtelTigo Money': 'airteltigo',
      };

      const provider = providerMap[deposit.payment_method];
      const phone = String(deposit.payment_reference || '').replace(/\\s+/g, '');
      if (!provider || !/^0[0-9]{9}$/.test(phone)) {
        return error('Enter a valid Ghana mobile money number and network.', 400);
      }

      const paymentResponse = await fetch('https://api.shikacreators.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${shikaKey}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': requestId,
        },
        body: JSON.stringify({
          amount: Number(deposit.amount),
          currency: 'GHS',
          payment_method: { type: 'mobile_money', phone_number: phone, provider },
          description: `Classic Sporty Hacks wallet deposit ${requestId}`,
          metadata: { deposit_request_id: requestId, user_id: user.id },
        }),
      });

      const paymentRaw = await paymentResponse.text();
      let paymentData: {
        id?: string;
        status?: string;
        message?: string;
        error?: string;
        details?: unknown;
      } = {};

      try {
        paymentData = paymentRaw ? JSON.parse(paymentRaw) : {};
      } catch {
        paymentData = { message: paymentRaw.slice(0, 220) || 'Shika returned an empty response.' };
      }

      if (!paymentResponse.ok || !paymentData.id) {
        const providerMessage = clean(
          paymentData.message || paymentData.error ||
          (typeof paymentData.details === 'string' ? paymentData.details : '') ||
          `Shika returned HTTP ${paymentResponse.status}.`,
          220
        );

        console.error('Shika payment creation failed', JSON.stringify({
          status: paymentResponse.status,
          response: paymentRaw.slice(0, 500),
        }));

        return json({
          success: false,
          error: providerMessage,
          provider_status: paymentResponse.status,
        }, 502);
      }

      await supabaseAdminRequest(
        `deposit_requests?id=eq.${encodeURIComponent(requestId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        serviceKey,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ shika_payment_id: paymentData.id }),
        }
      );

      return json({
        success: true,
        payment_id: paymentData.id,
        status: paymentData.status || 'pending',
        message: 'Payment request sent. Check your phone and approve the MoMo prompt with your PIN.',
      });
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : (() => {
              try { return JSON.stringify(err); } catch { return 'Could not start the Mobile Money payment.'; }
            })();

      console.error('Deposit payment endpoint failed', message.slice(0, 500));
      return json({
        success: false,
        error: message.slice(0, 260) || 'Could not start the Mobile Money payment.',
      }, 502);
    }
  }],

  'GET /api/fixtures': [async () => {
    try {
      const fixtures = await loadOpenFootballFixtures();
      return json({
        fixtures,
        source: 'OpenFootball',
        updatedAt: new Date().toISOString(),
        note: 'Upcoming fixtures only. The source publishes refreshed season datasets daily; match times are shown only when supplied.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load football fixtures.';
      return error(message.slice(0, 240), 503);
    }
  }],

  'GET /api/bookmaker-odds': [async ({ query }) => {
    const date = clean(query.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
      return error('Provide a valid date in YYYY-MM-DD format.', 400);
    }

    try {
      const secretNames = await secrets.listSecretNames();
      if (!secretNames.includes('API_FOOTBALL_KEY')) {
        return error('The API-Football key is not configured on the server.', 503);
      }
      return json(await loadApiFootballOdds(date));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not retrieve bookmaker odds.';
      return error(message.slice(0, 300), 502);
    }
  }],

  'GET /api/results': [async ({ query }) => {
    const date = clean(query.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
      return error('Provide a valid date in YYYY-MM-DD format.', 400);
    }

    try {
      const secretNames = await secrets.listSecretNames();
      if (!secretNames.includes('API_FOOTBALL_KEY')) {
        return error('The API-Football key is not configured on the server.', 503);
      }
      return json(await loadApiFootballResults(date));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not retrieve football results.';
      return error(message.slice(0, 300), 502);
    }
  }],

  'POST /api/match-preview': [async ({ body }) => {
    const input = body as { match?: PreviewMatch } | null;
    const match = input?.match;

    if (!match || !clean(match.home) || !clean(match.away)) {
      return error('A valid fixture is required to create a match preview.', 400);
    }

    const fixture = {
      id: clean(match.id, 80),
      competition: clean(match.league, 120) || 'Not supplied',
      kickoff: clean(match.time, 80) || 'Not supplied',
      homeTeam: clean(match.home, 100),
      awayTeam: clean(match.away, 100),
      currentScore: clean(match.score, 40) || 'Not supplied',
      live: Boolean(match.live),
      decimalOdds: Array.isArray(match.odds)
        ? match.odds.slice(0, 3).map((odd) => clean(odd, 16) || 'Not supplied')
        : ['Not supplied', 'Not supplied', 'Not supplied'],
    };

    const prompt = [
      'Create a concise, balanced football match preview using ONLY the fixture information and decimal odds supplied below.',
      'Do not invent form, injuries, lineups, head-to-head records, player statistics, weather, standings, or news.',
      'If important context is missing, say that it was not supplied.',
      'Explain what the available 1X2 odds suggest without presenting them as certainty. If odds are missing, say so.',
      'Include: Match overview; What the supplied odds indicate; Key uncertainties; Cautious summary.',
      'Do not tell the user to bet, stake money, or claim a guaranteed winner. This is informational analysis, not financial advice.',
      '',
      'FIXTURE DATA:',
      JSON.stringify(fixture, null, 2),
    ].join('\\n');

    try {
      const result = await ai.generate({
        system: 'You are a careful football analyst. Be factual, neutral, concise, and transparent about missing data. Never describe a prediction as guaranteed.',
        prompt,
        maxTokens: 650,
        temperature: 0.25,
        thinkingMode: 'FAST',
        cache: true,
      });

      return json({
        preview: result.text,
        fixture,
        disclaimer: 'AI analysis is uncertain, based only on the displayed fixture and odds, and is not a guarantee of any result.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The AI preview service is temporarily unavailable.';
      return error(message.slice(0, 240), 503);
    }
  }],
});