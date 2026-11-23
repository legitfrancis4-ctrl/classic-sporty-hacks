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