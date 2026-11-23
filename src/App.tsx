import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@appdeploy/client';
import { supabase } from './lib/supabase';
import { Activity, ClipboardList, Search, Shield, Ticket, X, ChevronLeft, Gift, RefreshCw } from 'lucide-react';

type Match = { id: string; league: string; time: string; home: string; away: string; score?: string; odds: string[]; live: boolean; homeLogo?: string; awayLogo?: string; operatorScheduled?: boolean; scheduledEndAt?: string; scheduledStatus?: string };
type Pick = { match: Match; market: string; selection: string; odd: number };

const games = [
  ['Instant World Cup','NEW','🏆','game-green'],['Instant Football','POPULAR','⚽','game-red'],
  ['Scheduled Football','NEW','🗓️','game-purple'],['Football Legends','NEW','🛡️','game-black'],
  ['vFootball','SCHEDULED','🔷','game-blue'],['Penalty Shootout','NEW','🥅','game-red'],
  ['Instant African Cup','NEW','🌍','game-africa'],['Instant Basketball','INSTANT','🏀','game-orange'],
  ['Horse Racing','POPULAR','🏇','game-purple'],['Greyhounds','INSTANT','🐕','game-blue'],
  ['Virtual Tennis','SCHEDULED','🎾','game-green'],['Speedway','NEW','🏁','game-black']
];
const virtualLeagues = [
  { name: 'England', flag: '🏴', teams: ['Arsenal','Aston Villa','Bournemouth','Brentford','Brighton','Chelsea','Crystal Palace','Everton','Fulham','Ipswich','Leicester','Liverpool','Man City','Man United','Newcastle','Nottingham Forest','Southampton','Tottenham','West Ham','Wolves'] },
  { name: 'Spain', flag: '🇪🇸', teams: ['Alaves','Athletic Club','Atletico Madrid','Barcelona','Real Betis','Celta Vigo','Getafe','Girona','Las Palmas','Leganes','Mallorca','Osasuna','Rayo Vallecano','Real Madrid','Real Sociedad','Sevilla','Valencia','Valladolid','Villarreal','Espanyol'] },
  { name: 'Germany', flag: '🇩🇪', teams: ['Augsburg','Bayern Munich','Bochum','Dortmund','Eintracht Frankfurt','Freiburg','Heidenheim','Hoffenheim','Holstein Kiel','Leverkusen','Mainz','Monchengladbach','RB Leipzig','St Pauli','Stuttgart','Union Berlin','Werder Bremen','Wolfsburg','Hamburg','Schalke'] },
  { name: 'Italy', flag: '🇮🇹', teams: ['Atalanta','Bologna','Cagliari','Como','Empoli','Fiorentina','Genoa','Inter','Juventus','Lazio','Lecce','AC Milan','Monza','Napoli','Parma','Roma','Torino','Udinese','Sampdoria','Palermo'] },
  { name: 'France', flag: '🇫🇷', teams: ['Auxerre','Brest','Le Havre','Lens','Lille','Lyon','Marseille','Monaco','Montpellier','Nantes','Nice','PSG','Reims','Rennes','Saint-Etienne','Strasbourg','Toulouse','Bordeaux','Lorient','Metz'] }
];
const money = (n: number) => `GHS ${Number(n || 0).toFixed(2)}`;
const val = (row: any, keys: string[], fallback = ''): string => {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return String(row[key]);
  return fallback;
};

export default function App() {
  const [theme,setTheme] = useState<'light'|'dark'>(() => { try { return localStorage.getItem('csh-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [recentWinners,setRecentWinners] = useState<any[]>([]);
  const [winnersLoading,setWinnersLoading] = useState(false);
  const [winnersError,setWinnersError] = useState('');
  const [page,setPage] = useState('home');
  const [tab,setTab] = useState('Matches');
  const [matches,setMatches] = useState<Match[]>([]);
  const [loading,setLoading] = useState(true);
  const [dbError,setDbError] = useState('');
  const [session,setSession] = useState<any>(null);
  const [profile,setProfile] = useState<any>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authMode,setAuthMode] = useState<'login'|'register'>('login');
  const [showAuth,setShowAuth] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [fullName,setFullName] = useState('');
  const [authBusy,setAuthBusy] = useState(false);
  const [authError,setAuthError] = useState('');
  const [slip,setSlip] = useState<Pick[]>([]);
  const [stake,setStake] = useState('10');
  const [betBusy,setBetBusy] = useState(false);
  const [betError,setBetError] = useState('');
  const [myBets,setMyBets] = useState<any[]>([]);
  const [myBetsLoading,setMyBetsLoading] = useState(false);
  const [myBetSelections,setMyBetSelections] = useState<any[]>([]);
  const [myBetMatches,setMyBetMatches] = useState<any[]>([]);
  const [selectedBetId,setSelectedBetId] = useState<string|null>(null);
  const [betView,setBetView] = useState<'open'|'history'>('history');
  const [betResultFilter,setBetResultFilter] = useState('all');
  const [showSlip,setShowSlip] = useState(false);
  const [showMore,setShowMore] = useState(false);
  const [codeTab,setCodeTab] = useState('Code Hub');
  const [bookingCode,setBookingCode] = useState('');
  const [showBookingTicket,setShowBookingTicket] = useState(false);
  const [codeSelections,setCodeSelections] = useState<string[]>([]);
  const [codeBusy,setCodeBusy] = useState(false);
  const [realMode,setRealMode] = useState(true);
  const [selectedGame,setSelectedGame] = useState<string|null>(null);
  const [activeVirtualLeague,setActiveVirtualLeague] = useState('England');
  const [practicePoints,setPracticePoints] = useState(1000);
  const [gameResult,setGameResult] = useState('');
  const [gameRounds,setGameRounds] = useState(0);
  const [footballBusy,setFootballBusy] = useState(false);
  const [footballScore,setFootballScore] = useState({home:0,away:0});
  const [footballMinute,setFootballMinute] = useState(0);
  const [footballPhase,setFootballPhase] = useState('Ready for kick-off');
  const [footballHistory,setFootballHistory] = useState<string[]>([]);
  const [winnerPopup,setWinnerPopup] = useState<any>(null);
  const openBetTicket = (bet:any) => {
    setSelectedBetId(String(bet.id));
    if (String(bet.status || '').toLowerCase() === 'won') setWinnerPopup(bet);
  };
  const playPracticeRound = async () => {
    if (!selectedGame || footballBusy) return;
    if (selectedGame === 'Instant Football') {
      setFootballBusy(true);
      setFootballScore({home:0,away:0});
      setFootballMinute(0);
      setGameResult('');
      setFootballPhase('Kick-off · The match is underway');
      let home = 0;
      let away = 0;
      const wait = (ms:number) => new Promise(resolve => window.setTimeout(resolve, ms));
      for (const minute of [15,30,45,60,75,90]) {
        await wait(850);
        setFootballMinute(minute);
        const eventRoll = Math.random();
        if (eventRoll > 0.78) {
          if (Math.random() > 0.5) home += 1;
          else away += 1;
          setFootballPhase('⚽ GOAL! A shot finds the back of the net.');
        } else if (eventRoll > 0.58) {
          setFootballPhase('Big chance! The goalkeeper makes a save.');
        } else if (eventRoll > 0.36) {
          setFootballPhase('Midfield battle · Possession changes hands.');
        } else {
          setFootballPhase('Play continues · Both teams push forward.');
        }
        setFootballScore({home,away});
      }
      const summary = `FULL TIME · HOME ${home}–${away} AWAY`;
      setFootballPhase('Full time');
      setGameResult(summary);
      setFootballHistory(old => [summary, ...old].slice(0,5));
      setGameRounds(n => n + 1);
      setPracticePoints(n => n + 10);
      setFootballBusy(false);
      return;
    }
    const outcomes:Record<string,string[]> = {
      'Penalty Shootout':['GOAL! You scored.','SAVED! The goalkeeper stopped it.','WIDE! The shot missed.'],
      'Instant Basketball':['3-POINTER!','BUCKET! Two points.','MISS! Try another shot.'],
      'Horse Racing':['Your selected runner finished 1st!','Your runner finished 2nd.','Your runner finished outside the places.'],
      'Greyhounds':['Your selected dog won the practice race!','Close finish: 2nd place.','Not this time: 3rd place.'],
      'Virtual Tennis':['ACE! Point won.','RALLY WON!','Unforced error. Point lost.'],
      'Speedway':['You finished 1st in the practice heat!','You finished 2nd.','You finished 3rd.'],
    };
    const choices = outcomes[selectedGame] || ['YOU WIN! Practice round completed.','GOOD PLAY! Round completed.','ROUND OVER. Try again.'];
    const outcome = choices[Math.floor(Math.random()*choices.length)];
    setGameResult(outcome);
    setGameRounds(n=>n+1);
    setPracticePoints(n=>n+10);
  };
  const [codePanelOpen,setCodePanelOpen] = useState(true);
  const [previewMatch,setPreviewMatch] = useState<Match|null>(null);
  const [previewText,setPreviewText] = useState('');
  const [previewError,setPreviewError] = useState('');
  const [previewLoading,setPreviewLoading] = useState(false);
  const [matchCentre,setMatchCentre] = useState<Match|null>(null);
  const [matchCentreOdds,setMatchCentreOdds] = useState<any[]>([]);
  const [matchCentreLoading,setMatchCentreLoading] = useState(false);
  const [matchCentreError,setMatchCentreError] = useState('');
  const [matchCentreTab,setMatchCentreTab] = useState<'markets'|'stats'>('markets');
  const [notice,setNotice] = useState('');
  const [walletData,setWalletData] = useState<any>(null);
  const [walletLoading,setWalletLoading] = useState(false);
  const [walletError,setWalletError] = useState('');
  const [walletRaw,setWalletRaw] = useState('');
  const [walletAction,setWalletAction] = useState<'deposit'|'withdraw'>('deposit');
  const [walletActionBusy,setWalletActionBusy] = useState(false);
  const [walletActionError,setWalletActionError] = useState('');
  const [depositForm,setDepositForm] = useState({amount:'',payment_method:'MTN Mobile Money',phone:''});
  const [depositTab,setDepositTab] = useState<'Mobile Money'|'Paybill'|'Card'>('Mobile Money');
  const [withdrawalForm,setWithdrawalForm] = useState({amount:'',provider:'MTN',account_name:'',phone:''});
  const [depositAdminNote,setDepositAdminNote] = useState('');
  const [privateDepositMessages,setPrivateDepositMessages] = useState<Record<string,string>>({});
  const [notifications,setNotifications] = useState<any[]>([]);
  const [notificationsLoading,setNotificationsLoading] = useState(false);
  const [notificationsError,setNotificationsError] = useState('');
  const [mtnReceivingNumber,setMtnReceivingNumber] = useState('');
  const [mtnReceivingError,setMtnReceivingError] = useState('');
  const openPrivateDepositChat = (row:any) => {
    if (!isAdmin) return;
    const customerPhone = String(row.payment_reference || '').replace(/[^0-9]/g, '');
    if (!/^0[0-9]{9}$/.test(customerPhone)) {
      setAdminError('This request has no valid Ghana customer MoMo number.');
      return;
    }
    const message = String(privateDepositMessages[row.id] || '').trim();
    if (!message) {
      setAdminError('Enter the payment instructions before opening WhatsApp.');
      return;
    }
    const whatsappPhone = '233' + customerPhone.slice(1);
    const text = `Hello, your Classic Sporty Hacks deposit request for ${money(Number(row.amount || 0))} via ${row.payment_method || 'Mobile Money'} is being processed.\\n\\n${message}\\n\\nPlease keep your transaction receipt. Your wallet will only be credited after payment verification.`;
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };
  const [adminTab,setAdminTab] = useState('Overview');
  const [adminBusy,setAdminBusy] = useState(false);
  const [adminError,setAdminError] = useState('');
  const [adminRows,setAdminRows] = useState<Record<string,any[]>>({});
  const [matchForm,setMatchForm] = useState({id:'',home_team:'',away_team:'',league:'',match_date:'',is_active:true});
  const [scheduledForm,setScheduledForm] = useState({home_team:'',away_team:'',kickoff:'',home_score:'',away_score:''});
  const [scheduledBusy,setScheduledBusy] = useState(false);
  const [clockNow,setClockNow] = useState(Date.now());
  const [oddsForm,setOddsForm] = useState({id:'',match_id:'',market:'1X2',selection:'1',odds:''});
  const [userAction,setUserAction] = useState({user_id:'',amount:'',description:''});
  const [walletUserSearch,setWalletUserSearch] = useState('');
  const [resultInputs,setResultInputs] = useState<Record<string,{home:string;away:string}>>({});
  const [resultsBusy,setResultsBusy] = useState(false);
  const [resultsMessage,setResultsMessage] = useState('');
  const tell = (s:string) => { setNotice(s); window.setTimeout(()=>setNotice(''),3500); };

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('csh-theme', theme); } catch { /* local storage may be unavailable */ }
  }, [theme]);

  const formatCountdown = (target:string) => {
    const remaining = Math.max(0, new Date(target).getTime() - clockNow);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  };
  const virtualRoundDurationMs = 150000;
  const virtualRoundNumber = Math.floor(clockNow / virtualRoundDurationMs) + 1;
  const virtualRoundSecondsLeft = Math.ceil((virtualRoundDurationMs - (clockNow % virtualRoundDurationMs)) / 1000);
  const virtualRoundCountdown = `${String(Math.floor(virtualRoundSecondsLeft / 60)).padStart(2, '0')}:${String(virtualRoundSecondsLeft % 60).padStart(2, '0')}`;

  const loadMyBets = async () => {    if (!session?.user?.id) { setMyBets([]); setMyBetSelections([]); setMyBetMatches([]); return; }
    setMyBetsLoading(true); setBetError('');
    try {
      const { data, error } = await supabase.from('bets').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const bets = data || [];
      setMyBets(bets);
      const ids = bets.map((bet:any) => bet.id).filter(Boolean);
      if (!ids.length) { setMyBetSelections([]); setMyBetMatches([]); return; }
      const { data: legs, error: legsError } = await supabase.from('bet_selections').select('*').in('bet_id', ids);
      if (legsError) throw legsError;
      setMyBetSelections(legs || []);
      const matchIds = Array.from(new Set((legs || []).map((leg:any) => leg.match_id).filter(Boolean)));
      if (matchIds.length) {
        const { data: matchRows, error: matchError } = await supabase.from('matches').select('*').in('id', matchIds);
        if (matchError) throw matchError;        setMyBetMatches(matchRows || []);
      } else setMyBetMatches([]);
    } catch (err:any) {
      setBetError(err?.message || 'Could not load your bet history.');
    } finally { setMyBetsLoading(false); }
  };

  const loadRecentWinners = async () => {
    setWinnersLoading(true);
    setWinnersError('');
    try {
      // This narrowly scoped SECURITY DEFINER RPC returns only prize amount and
      // settlement time. It never exposes bet IDs, user IDs, references or selections.
      const { data, error } = await supabase.rpc('get_public_grand_prize_winners');
      if (error) throw error;
      setRecentWinners((data || []).filter((row:any) => Number(row.potential_win) > 0));
    } catch (err:any) {
      setRecentWinners([]);
      setWinnersError(err?.message || 'The public winners feed is temporarily unavailable.');
    } finally {
      setWinnersLoading(false);
    }
  };

  const loadWallet = async () => {
    if (!session?.user?.id) { setWalletData(null); return; }
    setWalletLoading(true); setWalletError(''); setWalletRaw('');
    const { data, error } = await supabase.rpc('get_my_wallet');
    if (error) {
      setWalletError(error.message);
      setWalletData(null);
    } else {
      setWalletData(data);
      setWalletRaw(JSON.stringify(data));
    }
    setWalletLoading(false);
  };

  const loadNotifications = async () => {
    if (!session?.user?.id) { setNotifications([]); return; }
    setNotificationsLoading(true); setNotificationsError('');
    const { data, error } = await supabase.from('user_notifications').select('id,title,message,created_at').order('created_at', { ascending: false }).limit(50);
    if (error) {
      setNotificationsError(error.message);
      setNotificationsLoading(false);
      return;
    }
    const items = data || [];
    setNotifications(items);
    const hasMtnDeposit = items.some((item:any) => String(item.title || '').toLowerCase().includes('deposit') && /mtn/i.test(String(item.message || '')));
    if (hasMtnDeposit) {
      try {
        if (!session?.access_token) throw new Error('Please sign in again to view private payment instructions.');
        const response = await api.post('/api/deposit-receiving-instructions', { access_token: session.access_token });
        setMtnReceivingNumber(String(response.data?.receivingNumber || ''));
        setMtnReceivingError(response.data?.receivingNumber ? '' : 'MTN receiving details are not configured. Please contact support.');
      } catch (err:any) {
        setMtnReceivingNumber('');
        setMtnReceivingError(err?.response?.data?.error || err?.message || 'Could not load private MTN payment instructions.');
      }
    } else {
      setMtnReceivingNumber('');
      setMtnReceivingError('');
    }
    setNotificationsLoading(false);
  };

  const submitWalletRequest = async (event:FormEvent) => {
    event.preventDefault();
    if (!session?.user?.id) { setAuthMode('login'); setShowAuth(true); return; }
    setWalletActionBusy(true); setWalletActionError('');
    try {
      const amount = Number(walletAction === 'deposit' ? depositForm.amount : withdrawalForm.amount);
      if (!Number.isFinite(amount) || amount < (walletAction === 'withdraw' ? 10 : 1)) throw new Error(walletAction === 'withdraw' ? 'Minimum withdrawal is GHS 10.00.' : 'Enter a valid deposit amount of at least GHS 1.00.');
      if (walletAction === 'deposit') {
        const phone = depositForm.phone.trim();
        if (!/^0[0-9]{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Ghana Mobile Money number.');
        const { data: requestId, error } = await supabase.rpc('request_deposit', {
          p_amount: amount,
          p_payment_method: depositForm.payment_method,
          p_payment_reference: phone
        });
        if (error) throw error;
        if (!requestId) throw new Error('The deposit request was not created.');
        setDepositForm({amount:'',payment_method:depositForm.payment_method,phone:''});
        await loadNotifications();
        tell('Deposit request received. Open Notification Center for your payment update. Do not send money until payment instructions appear there. Your wallet is credited only after payment verification.');
      } else {
        const { error } = await supabase.rpc('request_manual_withdrawal', { p_amount: amount, p_provider: withdrawalForm.provider, p_account_name: withdrawalForm.account_name.trim(), p_phone: withdrawalForm.phone.trim() });
        if (error) throw error;
        setWithdrawalForm({amount:'',provider:withdrawalForm.provider,account_name:'',phone:''});
        tell('Withdrawal request submitted. The amount has been reserved from your wallet.');
      }
      await loadWallet();
    } catch (err:any) { setWalletActionError(err?.message || 'Could not submit your wallet request.'); }
    finally { setWalletActionBusy(false); }
  };

  const processDepositRequest = async (row:any, action:'approved'|'rejected') => {
    if (!isAdmin) return;
    const promptText = action === 'approved' ? 'Confirm you have independently verified this payment in your payment account before approving it.' : 'Reject this deposit request? The wallet will not be credited.';
    if (!window.confirm(promptText)) return;
    setAdminBusy(true); setAdminError('');
    try {
      const { error } = await supabase.rpc('admin_process_deposit', { p_request_id: row.id, p_action: action, p_admin_note: depositAdminNote.trim() || null });
      if (error) throw error;
      setDepositAdminNote('');
      tell(action === 'approved' ? 'Verified deposit approved and wallet credited.' : 'Deposit request rejected.');
      await loadAdminData();
    } catch (err:any) { setAdminError(err?.message || 'Could not process this deposit.'); }
    finally { setAdminBusy(false); }
  };

  const processWithdrawalRequest = async (row:any, action:'paid'|'rejected') => {
    if (!isAdmin) return;
    let payoutNote = 'Withdrawal rejected by admin.';
    if (action === 'paid') {
      const reference = window.prompt('Enter the successful MoMo transfer reference/transaction ID. Only continue after the money has actually been sent and the recipient name and number have been verified.');
      if (!reference?.trim()) {
        tell('Payout not marked paid. A successful transfer reference is required.');
        return;
      }
      const confirmed = window.confirm('Confirm GHS ' + Number(row.amount || 0).toFixed(2) + ' was successfully sent to ' + (row.phone || row.phone_number || row.account_number || 'the customer') + ' on ' + (row.provider || row.payment_method || 'their selected network') + ', and that the recipient name matched?');
      if (!confirmed) return;
      payoutNote = 'Manual payout sent from admin personal MTN MoMo wallet. Transfer reference: ' + reference.trim();
    } else {
      if (!window.confirm('Reject this withdrawal? The reserved amount will be refunded to the customer wallet.')) return;
    }
    setAdminBusy(true); setAdminError('');
    try {
      const { error } = await supabase.rpc('admin_mark_manual_withdrawal', {
        p_request_id: row.id,
        p_action: action,
        p_note: payoutNote
      });
      if (error) throw error;
      tell(action === 'paid' ? 'Withdrawal marked paid.' : 'Withdrawal rejected and wallet refunded.');
      await loadAdminData();
    } catch (err:any) {
      setAdminError(err?.message || 'Could not process this withdrawal.');
    } finally {
      setAdminBusy(false);
    }
  };

  const walletBalance = (() => {
    const value = Array.isArray(walletData) ? walletData[0] : walletData;
    if (typeof value === 'number' || typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    if (value && typeof value === 'object') {
      for (const key of ['balance','wallet_balance','available_balance','amount','current_balance']) {
        if (value[key] !== undefined && value[key] !== null) {
          const n = Number(value[key]);
          if (Number.isFinite(n)) return n;
        }
      }
    }
    return null;
  })();

  const requestMatchPreview = async (match: Match) => {
    setPreviewMatch(match);
    setPreviewText('');
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const response = await api.post('/api/match-preview', { match });
      const result = response.data as { preview?: string; disclaimer?: string };
      if (!result?.preview) throw new Error('The AI service returned an empty preview.');
      setPreviewText(result.preview);
    } catch (err: any) {
      setPreviewError(err?.response?.data?.error || err?.message || 'Could not create the match preview. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const teamInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  const openMatchCentre = async (match: Match) => {
    setMatchCentre(match);
    setMatchCentreTab('markets');
    setMatchCentreOdds([]);
    setMatchCentreError('');
    if (match.id.startsWith('openfootball-')) {
      setMatchCentreError('This fixture is from the public fixture feed and has not yet been saved to the betting database. Markets will appear after it is saved and genuine prices are supplied.');
      return;
    }
    setMatchCentreLoading(true);
    try {
      const { data, error } = await supabase
        .from('match_odds')
        .select('*')
        .eq('match_id', match.id)
        .eq('is_active', true)
        .order('market', { ascending: true });
      if (error) throw error;
      setMatchCentreOdds((data || []).filter((row: any) => Number(row.odd ?? row.odds ?? row.price) > 1));
    } catch (err: any) {
      setMatchCentreError(err?.message || 'Could not load this match markets. Please try again.');
    } finally {
      setMatchCentreLoading(false);
    }
  };

  const loadMatches = async () => {
    setLoading(true);
    setDbError('');
    const year = new Date().getUTCFullYear();
    const season = new Date().getUTCMonth() >= 6 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
    const leagueFeeds = [
      { code: 'en.1', name: 'English Premier League' },
      { code: 'de.1', name: 'German Bundesliga' },
      { code: 'es.1', name: 'Spanish La Liga' },
      { code: 'it.1', name: 'Italian Serie A' },

    ];
    const [feedResults, matchResult, logoResults] = await Promise.all([
      Promise.allSettled(leagueFeeds.map(async (league) => {
        const response = await fetch(`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${league.code}.json`);
        if (!response.ok) throw new Error(`${league.name} fixture feed unavailable`);
        const dataset = await response.json();
        return (dataset.matches || []).map((fixture: any) => ({ fixture, league: dataset.name || league.name }));
      })),
      Promise.allSettled([
        supabase.from('matches').select('*').limit(300),
        supabase.from('match_odds').select('*').limit(500),      ]),
      Promise.allSettled([
        'English Premier League', 'German Bundesliga', 'Spanish La Liga', 'Italian Serie A'
      ].map(async (leagueName) => {
        const response = await fetch(`https://www.thesportsdb.com/api/v1/json/123/search_all_teams.php?l=${encodeURIComponent(leagueName.replace(/ /g, '_'))}`);
        if (!response.ok) throw new Error('Team badge feed unavailable');
        const payload = await response.json();
        return (payload.teams || []).map((team: any) => ({
          name: String(team.strTeam || ''),
          logo: String(team.strBadge || team.strTeamBadge || ''),
        }));
      })),
    ]);

    const teamLogos = new Map<string, string>();    logoResults.forEach((result) => {
      if (result.status === 'fulfilled') result.value.forEach((team: any) => {
        if (team.name && team.logo) teamLogos.set(team.name.toLowerCase().replace(/[^a-z0-9]/g, ''), team.logo);
      });
    });
    const findTeamLogo = (name: string) => {
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return teamLogos.get(key) || [...teamLogos.entries()].find(([known]) => known.includes(key) || key.includes(known))?.[1] || '';
    };

    const externalFixtures: Match[] = feedResults
      .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      .filter(({ fixture }) => {
        if (!fixture.date || !fixture.team1 || !fixture.team2 || fixture.score?.ft) return false;
        return new Date(`${fixture.date}T23:59:59Z`).getTime() >= Date.now();
      })
      .map(({ fixture, league }) => ({
        id: `openfootball-${league}-${fixture.date}-${fixture.team1}-${fixture.team2}`,
        league: String(league),
        time: fixture.time ? `${fixture.date} · ${fixture.time}` : String(fixture.date),
        home: String(fixture.team1),
        away: String(fixture.team2),
        odds: ['', '', ''],
        live: false,
        homeLogo: findTeamLogo(String(fixture.team1)),
        awayLogo: findTeamLogo(String(fixture.team2)),
      }));

    let databaseFixtures: Match[] = [];
    let databaseError = '';
    const [rowsOutcome, oddsOutcome] = matchResult;
    if (rowsOutcome.status === 'fulfilled' && oddsOutcome.status === 'fulfilled') {
      const rowsResult = rowsOutcome.value;
      const oddsResult = oddsOutcome.value;
      if (rowsResult.error) databaseError = rowsResult.error.message;
      else if (oddsResult.error) databaseError = oddsResult.error.message;
      else {
        databaseFixtures = (rowsResult.data || [])
           .filter((row: any) => (row.is_active ?? row.active ?? true) !== false || row.is_operator_scheduled === true)
          .map((row: any) => {
            const id = val(row, ['id', 'match_id']);
            const marketOdds = (oddsResult.data || []).filter((odd: any) => String(odd.match_id ?? '') === id && (odd.is_active ?? true) !== false);
            const prices = ['', '', ''];
            marketOdds.forEach((odd: any) => {
              const market = val(odd, ['market', 'market_type', 'market_name'], '1X2').toLowerCase();
              if (!market.includes('1x2') && !market.includes('winner')) return;
              const outcome = val(odd, ['selection', 'outcome', 'name', 'label']).toLowerCase();
              const index = outcome === '1' || outcome.includes('home') ? 0
                : outcome === 'x' || outcome.includes('draw') ? 1
                : outcome === '2' || outcome.includes('away') ? 2 : -1;
              const price = val(odd, ['odds', 'odd', 'odd_value', 'price', 'value']);
              if (index >= 0 && price) prices[index] = price;
            });
            const kickoff = val(row, ['kickoff_at', 'match_date', 'start_time', 'scheduled_at', 'date']);
            const kickoffDate = kickoff ? new Date(kickoff) : null;
            const status = val(row, ['status', 'match_status']).toLowerCase();
            if ((status === 'finished' || status === 'completed' || status === 'ft' || status === 'cancelled') && row.is_operator_scheduled !== true) return null;
            const isOperatorScheduled = row.is_operator_scheduled === true;
            const isLive = status === 'live' || status === 'in_play' || row.is_live === true;
            if (!isOperatorScheduled && !isLive && kickoffDate && Number.isFinite(kickoffDate.getTime()) && kickoffDate.getTime() < Date.now()) return null;
            const homeScore = val(row, ['home_score', 'score_home']);
            const awayScore = val(row, ['away_score', 'score_away']);
            return {
              id,
              league: val(row, ['league', 'competition', 'league_name'], 'Football'),
              time: (() => {
                if (!kickoff) return 'Schedule TBA';
                const parsed = new Date(kickoff);
                return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(11, 19) === '23:59:59'
                  ? parsed.toISOString().slice(0, 10) + ' · Time TBA'
                  : kickoff;
              })(),
              home: val(row, ['home_team', 'home', 'team_home', 'home_name'], 'Home team'),
              away: val(row, ['away_team', 'away', 'team_away', 'away_name'], 'Away team'),
              homeLogo: val(row, ['home_logo', 'home_team_logo', 'home_badge']) || findTeamLogo(val(row, ['home_team', 'home', 'team_home', 'home_name'], '')),
              awayLogo: val(row, ['away_logo', 'away_team_logo', 'away_badge']) || findTeamLogo(val(row, ['away_team', 'away', 'team_away', 'away_name'], '')),
              score: homeScore !== '' || awayScore !== '' ? homeScore + ' - ' + awayScore : undefined,
              odds: prices,
              live: isLive,
              operatorScheduled: isOperatorScheduled,
              scheduledEndAt: isOperatorScheduled && kickoff ? new Date(new Date(kickoff).getTime() + 90 * 60000).toISOString() : undefined,
              scheduledStatus: status,
            } as Match;
          })
          .filter((match: Match | null): match is Match => match !== null);
      }
    } else {
      databaseError = 'Could not reach the connected match database.';
    }

    const merged = [...externalFixtures, ...databaseFixtures];
    const unique = new Map<string, Match>();
    merged.forEach((match) => unique.set(`${match.home.toLowerCase()}|${match.away.toLowerCase()}|${match.time.slice(0, 10)}`, match));
    setMatches(Array.from(unique.values()).sort((a, b) => Number(b.live) - Number(a.live) || a.time.localeCompare(b.time)));
    if (!externalFixtures.length && !databaseFixtures.length) {
      setDbError(feedResults.every((result) => result.status === 'rejected')
        ? 'The free fixture source is temporarily unavailable. Please refresh.'
        : databaseError || 'No upcoming fixtures are available from the connected sources.');
    } else if (databaseError && !externalFixtures.length) {
      setDbError(databaseError);
    }
    setLoading(false);
  };

  const loadProfile = async (user:any) => {
    if (!user) { setProfile(null); return; }
    const {data,error} = await supabase.from('profiles').select('id, role, is_active').eq('id',user.id).maybeSingle();
    setProfile(error ? {role:'user',is_active:true,profileError:error.message} : data || {role:'user',is_active:true});  };

  useEffect(()=>{
    let mounted=true;
    supabase.auth.getSession().then(async ({data})=>{
      if (!mounted) return;
      setSession(data.session); await loadProfile(data.session?.user || null);
      if (mounted) setAuthLoading(false);
    });
    const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{
      setSession(next); window.setTimeout(()=>loadProfile(next?.user || null),0); setAuthLoading(false);
    });
    loadMatches();
    let lastDailyRefresh = Date.now();
    const dailyRefresh = window.setInterval(() => {
      lastDailyRefresh = Date.now();
      loadMatches();
    }, 24 * 60 * 60 * 1000);
    const scheduledRefresh = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase.from('matches').select('id,status,is_live,home_score,away_score,start_time,is_active,is_operator_scheduled').eq('is_operator_scheduled', true);
      if (!data?.length) return;
      setMatches(current => current.map(match => {
        const row = data.find((item:any) => String(item.id) === String(match.id));
        if (!row) return match;
        return {
          ...match,
          live: row.status === 'live' || row.is_live === true,
          scheduledStatus: String(row.status || '').toLowerCase(),
          score: row.home_score !== null && row.home_score !== undefined && row.away_score !== null && row.away_score !== undefined ? row.home_score + ' - ' + row.away_score : match.score,
        };
      }));
    }, 5000);
    const refreshWhenReturning = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastDailyRefresh >= 24 * 60 * 60 * 1000) {
        lastDailyRefresh = Date.now();
        loadMatches();
      }
    };
    document.addEventListener('visibilitychange', refreshWhenReturning);
    return ()=>{ mounted=false; window.clearInterval(dailyRefresh); window.clearInterval(scheduledRefresh); document.removeEventListener('visibilitychange', refreshWhenReturning); listener.subscription.unsubscribe(); };
  },[]);

  const isAdmin = profile?.role==='admin' && profile?.is_active!==false;
  const displayName = String(session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Classic Sporty Hacks User').toUpperCase();

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setAdminBusy(true); setAdminError('');
    const jobs:Record<string,string> = {Users:'admin_get_users',Bets:'admin_get_bets',Transactions:'admin_get_transactions',Withdrawals:'admin_get_manual_withdrawals'};
    const next:Record<string,any[]> = {};
    try {
      const [matchesResult,oddsResult] = await Promise.all([
        supabase.from('matches').select('*').order('start_time',{ascending:true}).limit(300),
        supabase.from('match_odds').select('*').limit(1000)
      ]);
      if (matchesResult.error) throw new Error('Matches: '+matchesResult.error.message);
      if (oddsResult.error) throw new Error('Match odds: '+oddsResult.error.message);
      next.Matches = matchesResult.data || []; next.Odds = oddsResult.data || [];
      const depositsResult = await supabase.from('deposit_requests').select('*').order('created_at', { ascending: false }).limit(300);
      if (depositsResult.error) throw new Error('Deposits: ' + depositsResult.error.message);
      next.Deposits = depositsResult.data || [];
      const selectionsResult = await supabase.from('bet_selections').select('match_id,result').limit(3000);
      if (selectionsResult.error) throw new Error('Pending selections: '+selectionsResult.error.message);
      const pendingMatchIds = Array.from(new Set((selectionsResult.data || [])
        .filter((row:any) => row.result == null || ['pending','open'].includes(String(row.result).toLowerCase()))
        .map((row:any) => String(row.match_id)).filter(Boolean)));
      if (pendingMatchIds.length) {
        const pendingMatchesResult = await supabase.from('matches').select('*').in('id',pendingMatchIds).order('start_time',{ascending:true});
        if (pendingMatchesResult.error) throw new Error('Pending result matches: '+pendingMatchesResult.error.message);
        next.PendingMatches = pendingMatchesResult.data || [];
      } else next.PendingMatches = [];
      const codesResult = await supabase.from('booking_codes').select('*').order('created_at',{ascending:false}).limit(100);
      if (codesResult.error) throw new Error('Booking codes: '+codesResult.error.message);
      next.BookingCodes = codesResult.data || [];
      for (const [label,rpc] of Object.entries(jobs)) {
        const {data,error} = await supabase.rpc(rpc);
        if (error) { next[label]=[]; next[label+'Error']=[{error:error.message}]; }
        else next[label] = Array.isArray(data)?data:data==null?[]:[data];
      }
      setAdminRows(next);
    } catch (err:any) { setAdminError(err.message || 'Could not load admin data.'); setAdminRows(next); }
    finally { setAdminBusy(false); }
  };

  const syncFootballFeed = async () => {
    if (!isAdmin) return;
    setAdminBusy(true);
    setAdminError('');

    let matchesAdded = 0;
    let fixturesSeen = 0;
    let oddsSaved = 0;
    let oddsFixturesSeen = 0;
    let syncWarning = '';

    const normalizeTeam = (value: unknown) =>
      String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    try {
      // Step 1: load and save fixtures independently of bookmaker odds.
      const fixtureResponse = await api.get('/api/fixtures');
      const sourceFixtures = Array.isArray(fixtureResponse.data?.fixtures)
        ? fixtureResponse.data.fixtures
        : [];

      if (!sourceFixtures.length) {
        throw new Error('The free fixture feed returned no upcoming matches. Please try again later.');
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayText = today.toISOString().slice(0, 10);
      const futureLimit = new Date(today);
      futureLimit.setUTCDate(futureLimit.getUTCDate() + 35);

      const fixtures = sourceFixtures
        .filter((fixture: any) => {
          if (!fixture.date || !fixture.home || !fixture.away) return false;
          const date = new Date(String(fixture.date) + 'T00:00:00Z');
          return Number.isFinite(date.getTime()) && date >= today && date <= futureLimit;
        })
        .sort((a: any, b: any) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.time || '').localeCompare(String(b.time || ''))
        )
        .slice(0, 120);

      const savedFixtures: Array<{ id: string; date: string; home: string; away: string }> = [];

      for (const fixture of fixtures) {
        const date = String(fixture.date);
        const home = String(fixture.home).trim();
        const away = String(fixture.away).trim();
        // The source sometimes supplies a match date without a kickoff time.
        // End-of-day is a storage placeholder only; the UI labels it "Time TBA".
        const kickoff = fixture.time
          ? new Date(date + 'T' + String(fixture.time) + 'Z').toISOString()
          : new Date(date + 'T23:59:59Z').toISOString();
        const dayStart = new Date(date + 'T00:00:00Z').toISOString();
        const nextDay = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
        const sameDay = await supabase.from('matches')
          .select('id,home_team,away_team,start_time')
          .gte('start_time', dayStart)
          .lt('start_time', nextDay)
          .limit(100);

        if (sameDay.error) throw sameDay.error;

        const existing = (sameDay.data || []).find((row: any) =>
          normalizeTeam(row.home_team) === normalizeTeam(home) &&
          normalizeTeam(row.away_team) === normalizeTeam(away)
        );
        let matchId = existing?.id;
        if (!matchId) {
          const inserted = await supabase.from('matches').insert({
            home_team: home,
            away_team: away,
            start_time: kickoff,
            status: 'scheduled',
            is_live: false,
            is_active: true,
          }).select('id').single();

          if (inserted.error) throw inserted.error;
          matchId = inserted.data.id;
          matchesAdded += 1;
        } else {
          const refreshed = await supabase.from('matches').update({
            start_time: kickoff,
            status: 'scheduled',
            is_live: false,
            is_active: true,
          }).eq('id', matchId);

          if (refreshed.error) throw refreshed.error;
        }

        savedFixtures.push({ id: String(matchId), date, home, away });
        fixturesSeen += 1;
      }

      // Step 2: API-Football Free currently exposes odds only in its short
      // rolling date window. Avoid querying later fixture dates that the plan rejects.
      // Keep today's fixtures and the next day; never fabricate missing prices.
      const oddsWindowStart = new Date(today);
      const oddsWindowEnd = new Date(today);
      oddsWindowEnd.setUTCDate(oddsWindowEnd.getUTCDate() + 1);
      const oddsWindowStartText = oddsWindowStart.toISOString().slice(0, 10);
      const oddsWindowEndText = oddsWindowEnd.toISOString().slice(0, 10);
      const dates = Array.from(new Set(savedFixtures.map((fixture) => fixture.date)))
        .filter((date) => date >= oddsWindowStartText && date <= oddsWindowEndText)
        .sort();

      for (const date of dates) {
        let oddsResponse: any;
        try {
          oddsResponse = await api.get('/api/bookmaker-odds?date=' + date);
        } catch (err: any) {
          const providerError = String(err?.response?.data?.error || err?.message || '');
          const allowedRange = providerError.match(/try from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i);

          if (/Free plans do not have access to this date/i.test(providerError) || allowedRange) {
            const restrictionNote = allowedRange
              ? 'API-Football Free allows odds dates from ' + allowedRange[1] + ' through ' + allowedRange[2] + '.'
              : 'API-Football Free restricted this odds date.';
            syncWarning = syncWarning
              ? syncWarning + ' ' + restrictionNote
              : restrictionNote;
            // Skip this date only; do not abandon any other accessible dates.
            continue;
          }

          syncWarning = 'Fixtures were saved, but bookmaker odds could not be refreshed: ' + providerError.slice(0, 180);
          break;
        }

        const oddsFixtures = Array.isArray(oddsResponse.data?.fixtures)
          ? oddsResponse.data.fixtures
          : [];

        for (const pricedFixture of oddsFixtures) {
          const kickoff = String(pricedFixture.kickoff || '');
          const kickoffDate = new Date(kickoff);
          const homeKey = normalizeTeam(pricedFixture.home);
          const awayKey = normalizeTeam(pricedFixture.away);
          if (!homeKey || !awayKey || !Number.isFinite(kickoffDate.getTime())) continue;

          const fixtureDate = kickoffDate.toISOString().slice(0, 10);
          const saved = savedFixtures.find((fixture) =>
            fixture.date === fixtureDate &&
            normalizeTeam(fixture.home) === homeKey &&
            normalizeTeam(fixture.away) === awayKey
          );
          if (!saved) continue;

          oddsFixturesSeen += 1;
          const selections: Array<[string, unknown]> = [
            ['1', pricedFixture.odds?.home],
            ['X', pricedFixture.odds?.draw],
            ['2', pricedFixture.odds?.away],
          ];

          for (const [selection, rawOdd] of selections) {
            const odd = Number(rawOdd);
            if (!Number.isFinite(odd) || odd <= 1) continue;

            const current = await supabase.from('match_odds')
              .select('id')
              .eq('match_id', saved.id)
              .eq('market', '1X2')
              .eq('selection', selection)
              .limit(1);

            if (current.error) throw current.error;

            if (current.data?.[0]?.id) {
              const updated = await supabase.from('match_odds')
                .update({ odd, is_active: true })
                .eq('id', current.data[0].id);
              if (updated.error) throw updated.error;
            } else {
              const inserted = await supabase.from('match_odds').insert({
                match_id: saved.id,
                market: '1X2',
                selection,
                odd,
                is_active: true,              });
              if (inserted.error) throw inserted.error;
            }
            oddsSaved += 1;
          }
        }
      }

      if (dates.length > 0 && oddsFixturesSeen === 0 && !syncWarning) {
        syncWarning = 'API-Football returned no matching bookmaker-priced fixtures for the currently accessible dates. Existing and manually entered odds were left unchanged.';
      }

      await loadAdminData();
      await loadMatches();
      tell(
        'Football sync complete: ' + fixturesSeen + ' upcoming fixtures checked, ' +
        matchesAdded + ' new matches saved, ' + oddsSaved + ' genuine bookmaker prices saved from ' +
        oddsFixturesSeen + ' priced fixtures.' +
        (syncWarning ? ' ' + syncWarning : ' Odds coverage depends on API-Football and its bookmaker data.')
      );
    } catch (err: any) {
      setAdminError(
        err?.response?.data?.error ||
        err?.message ||
        'Football sync failed. Check the free fixture feed and Supabase admin write permissions.'
      );
    } finally {
      setAdminBusy(false);
    }
  };

  const normalizeResultTeam = (value:unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');

  const syncMatchResults = async () => {
    if (!isAdmin || resultsBusy) return;
    setResultsBusy(true); setResultsMessage(''); setAdminError('');
    let updated = 0; let settled = 0; let skipped = 0;
    const issues:string[] = [];
    try {
      const {data:selectionRows,error:selectionError} = await supabase.from('bet_selections').select('match_id,result').limit(3000);
      if (selectionError) throw selectionError;
      const pendingIds = Array.from(new Set((selectionRows || [])
        .filter((row:any) => row.result == null || ['pending','open'].includes(String(row.result).toLowerCase()))
        .map((row:any) => String(row.match_id)).filter(Boolean)));
      if (!pendingIds.length) { setResultsMessage('There are no unresolved football selections to settle.'); await loadAdminData(); return; }
      const {data:pendingMatches,error:matchesError} = await supabase.from('matches')
        .select('id,home_team,away_team,start_time,status,home_score,away_score')
        .in('id',pendingIds).lte('start_time',new Date().toISOString()).limit(300);
      if (matchesError) throw matchesError;
      const dates = Array.from(new Set((pendingMatches || []).map((match:any) =>
        match.start_time ? new Date(match.start_time).toISOString().slice(0,10) : ''
      ).filter(Boolean)));
      if (!dates.length) { setResultsMessage('No unresolved selections belong to matches whose kickoff has passed.'); await loadAdminData(); return; }
      for (const date of dates) {
        let fixtures:any[] = [];
        try {
          const response = await api.get('/api/results?date='+date);
          fixtures = Array.isArray(response.data?.fixtures) ? response.data.fixtures : [];
        } catch (err:any) {
          issues.push(date+': '+String(err?.response?.data?.error || err?.message || 'Results unavailable').slice(0,140));
          continue;
        }
        for (const match of (pendingMatches || []).filter((row:any) => row.start_time && new Date(row.start_time).toISOString().slice(0,10)===date)) {
          const homeKey = normalizeResultTeam(match.home_team);
          const awayKey = normalizeResultTeam(match.away_team);
          const candidates = fixtures.filter((fixture:any) =>
            normalizeResultTeam(fixture.home)===homeKey && normalizeResultTeam(fixture.away)===awayKey
          );
          if (candidates.length !== 1) { skipped++; continue; }
          const fixture = candidates[0];
          const providerStatus = String(fixture.status || '').toUpperCase();
          if (!['FT','AET','PEN'].includes(providerStatus) || !Number.isInteger(fixture.homeScore) || !Number.isInteger(fixture.awayScore)) {
            skipped++; continue;
          }
          const {error:updateError} = await supabase.from('matches').update({
            home_score:fixture.homeScore,away_score:fixture.awayScore,status:'finished',is_live:false
          }).eq('id',match.id);
          if (updateError) throw updateError;
          updated++;
          const {data:settlement,error:settlementError} = await supabase.rpc('admin_settle_match_bets',{p_match_id:match.id});
          if (settlementError) throw settlementError;
          settled += Number(settlement?.bets_won || 0)+Number(settlement?.bets_lost || 0)+Number(settlement?.bets_void || 0);
        }
      }
      await loadAdminData();
      setResultsMessage('Results checked. '+updated+' confirmed scores saved; '+settled+' bets settled; '+skipped+' matches still awaiting a confirmed provider result.'+(issues.length?' Provider notices: '+issues.slice(0,3).join(' | '):''));
    } catch (err:any) {
      setAdminError(err?.message || 'Could not synchronize and settle football results.');
    } finally { setResultsBusy(false); }
  };

  const saveManualMatchResult = async (match:any) => {
    if (!isAdmin || resultsBusy) return;
    const values = resultInputs[match.id] || {home:String(match.home_score ?? ''),away:String(match.away_score ?? '')};
    const homeScore = Number(values.home); const awayScore = Number(values.away);
    if (values.home.trim()==='' || values.away.trim()==='' || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore<0 || awayScore<0) {
      setAdminError('Enter valid whole-number final scores for both teams.'); return;
    }
    if (!window.confirm('Confirm the official final score: '+match.home_team+' '+homeScore+' - '+awayScore+' '+match.away_team+'? This will settle affected bets and credit any winnings.')) return;
    setResultsBusy(true); setAdminError(''); setResultsMessage('');
    try {
      const {error:updateError} = await supabase.from('matches').update({home_score:homeScore,away_score:awayScore,status:'finished',is_live:false}).eq('id',match.id);
      if (updateError) throw updateError;
      const {data:settlement,error:settlementError} = await supabase.rpc('admin_settle_match_bets',{p_match_id:match.id});
      if (settlementError) throw settlementError;
      setResultsMessage('Manual result saved and settlement completed: '+JSON.stringify(settlement));
      await loadAdminData();
    } catch (err:any) { setAdminError(err?.message || 'Could not save and settle this result.'); }
    finally { setResultsBusy(false); }
  };

  const createScheduledMatch = async (e:FormEvent) => {
    e.preventDefault();
    if (!isAdmin || scheduledBusy) return;
    const kickoffValue = scheduledForm.kickoff.trim();
    const homeScore = Number(scheduledForm.home_score);
    const awayScore = Number(scheduledForm.away_score);
    if (!scheduledForm.home_team.trim() || !scheduledForm.away_team.trim() || !kickoffValue || scheduledForm.home_score === '' || scheduledForm.away_score === '' || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setAdminError('Enter both teams, a Ghana-time kickoff, and valid whole-number final scores.');
      return;
    }
    // Ghana uses UTC+00:00; interpret the datetime-local input explicitly as Ghana time.
    const kickoff = new Date(kickoffValue + ':00+00:00');
    if (!Number.isFinite(kickoff.getTime()) || kickoff.getTime() <= Date.now()) {
      setAdminError('Choose a kickoff time in the future (Ghana time).');      return;
    }
    setScheduledBusy(true);
    setAdminError('');
    try {
      const { error } = await supabase.from('matches').insert({
        home_team: scheduledForm.home_team.trim(),
        away_team: scheduledForm.away_team.trim(),
`` 
        start_time: kickoff.toISOString(),
        status: 'scheduled',
        is_live: false,
        is_active: true,
        is_operator_scheduled: true,
        scheduled_home_score: homeScore,
        scheduled_away_score: awayScore,
      });
      if (error) throw error;
      setScheduledForm({home_team:'',away_team:'',kickoff:'',home_score:'',away_score:''});
      tell('Scheduled match published. Add its odds in the Odds tab before kickoff.');
      await loadAdminData();
      await loadMatches();
    } catch (err:any) {
      setAdminError(err?.message || 'Could not publish the scheduled match.');
    } finally {
      setScheduledBusy(false);
    }
  };

  const saveAdminMatch = async (e:FormEvent) => {
    e.preventDefault(); if (!isAdmin) return;
    setAdminBusy(true); setAdminError('');
    const payload:any = {home_team:matchForm.home_team.trim(),away_team:matchForm.away_team.trim(),start_time:matchForm.match_date ? new Date(matchForm.match_date).toISOString() : null,status:'scheduled',is_live:false,is_active:matchForm.is_active};
    try {
      let result:any;
      if (matchForm.id) result = await supabase.from('matches').update(payload).eq('id',matchForm.id);
      else result = await supabase.from('matches').insert(payload);
      if (result.error) throw result.error;
      setMatchForm({id:'',home_team:'',away_team:'',league:'',match_date:'',is_active:true});
      tell(matchForm.id?'Match updated.':'Match created.'); await loadAdminData(); await loadMatches();
    } catch(err:any) { setAdminError(err.message || 'Could not save match. Check the matches table column names and RLS policies.'); }
    finally { setAdminBusy(false); }
  };

  const toggleMatch = async (row:any) => {
    if (!isAdmin) return;
    const field = row.is_active !== undefined ? 'is_active' : 'active';
    const {error} = await supabase.from('matches').update({[field]:!(row[field] ?? true)}).eq('id',row.id);
    if (error) setAdminError(error.message); else { tell('Match status updated.'); await loadAdminData(); await loadMatches(); }
  };

  const deleteMatch = async (row:any) => {
    if (!isAdmin || !window.confirm('Delete this match? Related odds may prevent deletion.')) return;
    const {error} = await supabase.from('matches').delete().eq('id',row.id);
    if (error) setAdminError(error.message); else { tell('Match deleted.'); await loadAdminData(); await loadMatches(); }
  };
  const saveAdminOdds = async (e:FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const price = Number(oddsForm.odds);
    if (!oddsForm.match_id || !oddsForm.market.trim() || !oddsForm.selection.trim() || !Number.isFinite(price) || price <= 1) {
      setAdminError('Choose a match, market and selection, then enter decimal odds greater than 1.00.');
      return;
    }
    const payload = {
      match_id: oddsForm.match_id,
      market: oddsForm.market.trim(),
      selection: oddsForm.selection.trim(),
      odd: price,
      is_active: true,
    };
    setAdminBusy(true);
    setAdminError('');
    try {
      let writeError: any = null;
      if (oddsForm.id) {
        const result = await supabase.from('match_odds').update(payload).eq('id', oddsForm.id);
        writeError = result.error;
      } else {
        const existing = await supabase.from('match_odds')
          .select('id')
          .eq('match_id', payload.match_id)
          .eq('market', payload.market)
          .eq('selection', payload.selection)
          .limit(1);
        if (existing.error) throw existing.error;
        if (existing.data?.[0]?.id) {
          const result = await supabase.from('match_odds').update(payload).eq('id', existing.data[0].id);
          writeError = result.error;
        } else {
          const result = await supabase.from('match_odds').insert(payload);
          writeError = result.error;
        }
      }
      if (writeError) throw writeError;
      tell(oddsForm.id ? 'Odds updated.' : 'Odds saved.');
      setOddsForm({id:'',match_id:'',market:'1X2',selection:'1',odds:''});
      await loadAdminData();
      await loadMatches();
    } catch (err: any) {
      setAdminError(err?.message || 'Could not save odds.');
    } finally {
      setAdminBusy(false);
    }
  };

  const toggleAdminOdds = async (row: any) => {
    if (!isAdmin || !row?.id) return;
    setAdminBusy(true);
    setAdminError('');
    const { error } = await supabase.from('match_odds')
      .update({ is_active: row.is_active === false })
      .eq('id', row.id);
    if (error) setAdminError(error.message);
    else {
      tell(row.is_active === false ? 'Odds activated.' : 'Odds suspended.');
      await loadAdminData();
      await loadMatches();
    }
    setAdminBusy(false);
  };

  const loadBookingCode = async () => {
    const code = bookingCode.trim().toUpperCase();
    if (!code) return;
    setCodeBusy(true);
    try {
      const {data,error} = await supabase.from('booking_codes').select('code,selections,is_published').eq('code',code).eq('is_published',true).maybeSingle();
      if (error) throw error;
      const storedSelections = data?.selections;
      const selectionRows = Array.isArray(storedSelections)
        ? storedSelections
        : Array.isArray(storedSelections?.picks) ? storedSelections.picks : [];
      if (!data || !selectionRows.length) throw new Error('Booking code not found or no longer published.');
      const picks: Pick[] = selectionRows.map((item:any) => ({
        match: {id:String(item.match_id),league:String(item.league || 'Football'),time:String(item.time || 'Schedule TBA'),home:String(item.home),away:String(item.away),odds:[String(item.odd),'',''],live:false},
        market:String(item.market || '1X2'), selection:String(item.selection), odd:Number(item.odd)
      })).filter((pick:Pick) => pick.match.home && pick.match.away && Number.isFinite(pick.odd) && pick.odd > 1);
      if (!picks.length) throw new Error('This booking code contains invalid selections.');
      setSlip(picks);
      const savedStake = Array.isArray(storedSelections) ? storedSelections[0]?.stake : storedSelections?.stake;
      if (Number.isFinite(Number(savedStake)) && Number(savedStake) > 0) setStake(String(savedStake));
      setShowSlip(true);
      setPage('home');
      tell('Booking code loaded. Your selections and saved stake are in the bet slip.');
    } catch (err:any) { tell(err?.message || 'Could not load this booking code.'); }
    finally { setCodeBusy(false); }
  };

  const createBookingCode = async () => {
    if (!isAdmin || !session?.user?.id) return;
    const choices = (adminRows.Matches || []).flatMap((match:any) => (adminRows.Odds || [])
      .filter((odd:any) => String(odd.match_id) === String(match.id) && Number(odd.odds ?? odd.odd ?? odd.price) > 1)
      .map((odd:any) => ({key:`${match.id}|${odd.id}`,match,odd}))
    ).filter((choice:any) => codeSelections.includes(choice.key));
    if (!choices.length) { setAdminError('Select at least one match outcome with valid odds.'); return; }
    const selections = choices.map(({match,odd}:any) => ({
      match_id:String(match.id),league:val(match,['league','competition','league_name'],'Football'),
      home:val(match,['home_team','home','home_name'],'Home team'),away:val(match,['away_team','away','away_name'],'Away team'),
      time:val(match,['start_time','match_date','kickoff_at','date'],'Schedule TBA'),
      market:val(odd,['market','market_type','market_name'],'1X2'),
      selection:val(odd,['selection','outcome','name','label']),odd:Number(val(odd,['odds','odd','price','value']))
    }));
    setCodeBusy(true); setAdminError('');
    try {
      let createdCode = '';
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        const code = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('');
        const {error} = await supabase.from('booking_codes').insert({code,created_by:session.user.id,selections,is_published:true});
        if (!error) {
          createdCode = code;
          break;
        }
        if (!/duplicate|unique/i.test(error.message || '')) throw error;
      }
      if (!createdCode) throw new Error('Could not create a unique booking code. Please try again.');
      setCodeSelections([]);
      await loadAdminData();
      tell('Booking code created: '+createdCode);
    } catch (err:any) { setAdminError(err?.message || 'Could not create booking code.'); }
    finally { setCodeBusy(false); }
  };

  const createSlipBookingCode = async () => {
    if (!session?.user?.id) {      setAuthMode('login');
      setShowAuth(true);
      return;
    }
    if (!slip.length) {
      setBetError('Add at least one selection before generating a booking code.');
      return;
    }
    if (slip.some((pick) => !pick.match.id || pick.match.id.startsWith('openfootball-') || !Number.isFinite(pick.odd) || pick.odd <= 1)) {
      setBetError('Booking codes require saved database matches with valid odds. Select a match with verified odds.');
      return;
    }
    const stakeAmount = Number(String(stake).trim());
    if (!String(stake).trim() || !Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      setBetError('Enter a valid stake greater than zero before generating a booking code.');
      return;
    }
    const savedSelections = slip.map((pick, index) => ({
      match_id: pick.match.id,
      league: pick.match.league,
      time: pick.match.time,
      home: pick.match.home,
      away: pick.match.away,
      market: pick.market,
      selection: pick.selection,
      odd: pick.odd,
      ...(index === 0 ? { stake: stakeAmount } : {}),
    }));

    setCodeBusy(true);
    setBetError('');
    try {
      let createdCode = '';
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        const code = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('');
        const { error } = await supabase.from('booking_codes').insert({
          code,
          created_by: session.user.id,
          selections: savedSelections,
          is_published: true,
        });
        if (!error) {
          createdCode = code;
          break;
        }
        if (!/duplicate|unique/i.test(error.message || '')) throw error;
      }
      if (!createdCode) throw new Error('Could not create a unique code. Please try again.');
      setBookingCode(createdCode);
      setShowBookingTicket(true);
      tell('Booking code created: ' + createdCode + '. Share it so another user can load your exact selections and stake.');
    } catch (err: any) {      setBetError(err?.message || 'Could not create booking code. Check booking-code table permissions.');
    } finally {
      setCodeBusy(false);
    }
  };

  const walletAdminAction = async (kind:'credit'|'debit'|'bonus') => {
    if (!isAdmin || !userAction.user_id || !Number.isFinite(Number(userAction.amount)) || Number(userAction.amount)<=0) {setAdminError('Select a customer and enter a valid amount.');return;}
    if (kind==='bonus' && !window.confirm('Give this customer a GHS '+Number(userAction.amount).toFixed(2)+' bonus? This will credit their wallet immediately.')) return;
    setAdminBusy(true);setAdminError('');
    const isCredit = kind==='credit' || kind==='bonus';
    const description = kind==='bonus' ? 'Bonus: '+(userAction.description.trim() || 'Admin bonus') : (userAction.description.trim() || (kind==='credit'?'Admin wallet credit':'Admin wallet debit'));
    try {
      const {error}=await supabase.rpc(isCredit?'admin_credit_wallet':'admin_debit_wallet',{p_user_id:userAction.user_id,p_amount:Number(userAction.amount),p_description:description});
      if(error) throw error;
      tell(kind==='bonus'?'Bonus credited successfully.':'Wallet '+kind+' completed.');
      setUserAction({user_id:'',amount:'',description:''});setWalletUserSearch('');
      await loadAdminData();
    } catch (err:any) { setAdminError(err?.message || 'Wallet action failed.'); }
    finally { setAdminBusy(false); }
  };
  useEffect(() => { if (session) loadWallet(); else setWalletData(null); }, [session?.user?.id]);
  useEffect(() => { if (page === 'home' || page === 'matches') { loadRecentWinners(); const timer = window.setInterval(loadRecentWinners, 120000); return () => window.clearInterval(timer); } }, [page]);
  useEffect(() => { if (session && (page === 'wallet' || page === 'profile' || showSlip)) loadWallet(); }, [session?.user?.id, page, showSlip]);
  useEffect(() => { if (session && (page === 'notifications' || page === 'profile')) loadNotifications(); }, [session?.user?.id, page]);
  useEffect(() => { if (session && page === 'bets') loadMyBets(); }, [session?.user?.id, page]);
  useEffect(() => { if (page === 'admin' && isAdmin && !adminRows.Matches) loadAdminData(); }, [page,isAdmin]);
  const totalOdds = useMemo(()=>slip.reduce((n,p)=>n*p.odd,1),[slip]);
  const nav = (target:string)=>{
    if(target==='admin'&&!isAdmin){tell('Admin access requires an active admin role in Supabase.');return;}
    setPage(target); setShowMore(false);
  };
  const addPick=(match:Match,selection:string,odd:string,market='1X2')=>{
    if(!session){setAuthMode('login');setShowAuth(true);tell('Sign in to continue.');return;}
    setSlip(old=>old.some(p=>p.match.id===match.id && p.market===market)
      ? old.map(p=>p.match.id===match.id && p.market===market?{match,market,selection,odd:Number(odd)}:p)
      : [...old,{match,market,selection,odd:Number(odd)}]);
    setBetError('');
    setShowSlip(true);
  };

  const placeBet = async () => {
    if (!session?.user?.id) { setAuthMode('login'); setShowAuth(true); return; }
    const amount = Number(stake);
    if (!Number.isFinite(amount) || amount <= 0) { setBetError('Enter a valid stake greater than zero.'); return; }
    if (!slip.length) { setBetError('Add at least one selection to your bet slip.'); return; }
    if (slip.some(p => !p.match.id || p.match.id.startsWith('openfootball-'))) { setBetError('Only matches saved in the connected database with verified odds can be staked.'); return; }
    setBetBusy(true); setBetError('');
    try {
      const p_selections = slip.map(p => ({ match_id:p.match.id, market:p.market, selection:p.selection, odd:p.odd }));
      const { data, error } = await supabase.rpc('place_bet', { p_stake:amount, p_selections });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success || !result?.reference) throw new Error('The betting service did not confirm your bet. Please check My Bets before trying again.');
      setSlip([]); setStake('10'); setShowSlip(false);
      tell(`Bet accepted. Reference: ${result.reference}`);
      await Promise.all([loadWallet(), loadMyBets()]);
      setPage('bets');
    } catch (err:any) {
      setBetError(err?.message || 'Could not place your bet. Please try again.');
    } finally { setBetBusy(false); }
  };
  const submitAuth=async(e:FormEvent)=>{
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    try{
      if(authMode==='register'){
        const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:fullName.trim()}}});
        if(error) throw error;
        if(data.session){setShowAuth(false);tell('Account created. You are signed in.');}
        else setAuthError('Check your email to confirm your account, then sign in.');
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
        setShowAuth(false);setPassword('');tell('You are signed in.');
      }
    }catch(err:any){setAuthError(err.message||'Authentication failed.');}
    finally{setAuthBusy(false);}  };
  const signOut=async()=>{
    const {error}=await supabase.auth.signOut();
    if(error) tell(error.message); else {setPage('home');setSlip([]);tell('Signed out.');}
  };

  return <div className='sports-app'>
    <header className='sports-header'>
      <button className='sports-logo' onClick={()=>nav('home')}><span className='logo-symbol'>S</span><span>Classic<span className='logo-light'>Sporty Hacks</span></span></button>
      <div className='header-right'><button className='search-top' onClick={()=>nav('matches')} aria-label='Search matches'><Search size={22}/></button><button className='deposit-top' onClick={()=>nav('wallet')}>Deposit</button><button className='balance-top' onClick={()=>nav('wallet')} aria-label='Open wallet'><span>👤</span><b>{money(walletBalance ?? 0)}</b></button></div>
    </header>
    {page==='home'||page==='matches'?<>
      <div className='promo-strip'>{[['🎱','Lucky Numbers'],['🇩🇰','DEN vs NOR'],['🇼🇦','WAL vs POR'],['⚽','Virtuals'],['🎡','Spin & Win'],['🇵🇱','POL vs SWE']].map(([art,title],i)=><button className={'promo-tile '+['promo-red','promo-blue','promo-green','promo-dark','promo-purple','promo-blue'][i]} key={title} onClick={()=>i===3?nav('games'):tell(title+' event information is not connected yet.')}><span className='promo-art'>{art}</span><b>{title}</b></button>)}</div>
      <div className='sports-shortcuts'>{[['❖','All Sports','matches'],['▣','Live','matches'],['✈','Aviator','games'],['♧','Load Code','codes'],['▽','Virtuals','games'],['•••','More','more']].map(([icon,label,target])=><button key={label} onClick={()=>target==='more'?setShowMore(!showMore):target==='codes'?nav('codes'):nav(target)}><span>{icon}</span><b>{label}</b></button>)}</div>
      {showMore&&<div className='more-menu'><button onClick={()=>nav('profile')}>My Account</button><button onClick={()=>nav('wallet')}>My Wallet</button><button onClick={()=>nav('bets')}>My Bets</button>{isAdmin&&<button onClick={()=>nav('admin')}>Admin Dashboard</button>}{!session&&<button onClick={()=>{setAuthMode('login');setShowAuth(true);}}>Login / Register</button>}</div>}
      <div className='competition-strip'>{["TODAY'S FOOTBALL",'FOOTBALL IN NEXT 3 HOURS','UEFA NATIONS LEAGUE','AFCON QUALIFIERS'].map((t,i)=><button className={'competition c'+i} key={t} onClick={()=>nav('matches')}>{t}</button>)}</div>
      <div className='home-tabs'>{['Featured','Matches','Games','Codes','Virtuals'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);nav(t==='Games'||t==='Virtuals'?'games':t==='Codes'?'codes':'matches');}}>{t}</button>)}</div>
      {(() => {
        const liveFixtures = matches.filter(match => match.live).slice(0, 5);
        const upcomingFixtures = matches
          .filter(match => match.live || !['finished','completed','ft','cancelled'].includes(String(match.scheduledStatus || '').toLowerCase()))
          .sort((a,b) => Number(b.live) - Number(a.live) || new Date(a.time).getTime() - new Date(b.time).getTime())
          .slice(0, 20);
        const fixtureCard = (match:Match, live:boolean) => <article className={live?'fixture-card fixture-live-card':'fixture-card fixture-upcoming-card'} key={match.id}>
          <div className='fixture-card-top'><span className={live?'fixture-live-pill':'fixture-upcoming-pill'}>{live?'● LIVE NOW':'UPCOMING'}</span><span>{match.league}</span><time>{match.time}</time></div>
          <button type='button' className='fixture-teams' onClick={()=>openMatchCentre(match)} aria-label={'Open '+match.home+' versus '+match.away+' match centre'}>
            <div className='fixture-team'>{match.homeLogo?<img src={match.homeLogo} alt='' loading='lazy'/>:<span className='fixture-team-initials'>{teamInitials(match.home)}</span>}<b>{match.home}</b></div>
            <strong className='fixture-score'>{live?(match.score||'LIVE'):'VS'}</strong>
            <div className='fixture-team fixture-away-team'>{match.awayLogo?<img src={match.awayLogo} alt='' loading='lazy'/>:<span className='fixture-team-initials'>{teamInitials(match.away)}</span>}<b>{match.away}</b></div>
          </button>
          {match.operatorScheduled&&<p className='fixture-scheduled-note'>{live?'Operator-configured match · ':'Scheduled match · '}{live?'Time remaining: '+formatCountdown(match.scheduledEndAt||new Date(clockNow).toISOString()):'Kickoff in: '+formatCountdown(match.time)}</p>}
          <div className='fixture-market-heading'><b>1X2 · MATCH RESULT</b><button type='button' onClick={()=>openMatchCentre(match)}>ALL MARKETS ›</button></div>
          <div className='fixture-odds-grid'>{['1','X','2'].map((label,index)=>{const price=Number(match.odds[index]);return <button type='button' key={label} disabled={!Number.isFinite(price)||price<=1} onClick={()=>addPick(match,label,price.toFixed(2))}><span>{label}</span><b>{Number.isFinite(price)&&price>1?price.toFixed(2):'—'}</b></button>;})}</div>
          <button type='button' className='fixture-details-link' onClick={()=>openMatchCentre(match)}>Match details · markets · statistics　›</button>
        </article>;
        return <>
          <section className='fixtures-live-section' style={{display:'none'}}>
            <div className='fixtures-section-heading fixtures-dark-heading'><div><span className='live-pulse-dot'></span><h2>LIVE MATCHES</h2><small>Live scores and match odds</small></div><b>{liveFixtures.length}/5 LIVE</b><button type='button' onClick={loadMatches}><RefreshCw size={14}/> Refresh</button></div>
            {loading&&<div className='fixture-loading-dark'><RefreshCw/><b>Loading live matches…</b></div>}
            {!loading&&liveFixtures.length===0&&<div className='fixture-empty-dark'>No verified live matches right now. Check the upcoming fixtures below.</div>}
            {!loading&&liveFixtures.map(match=>fixtureCard(match,true))}
          </section>
          <section className='fixtures-upcoming-section'>
            <div className='fixtures-section-heading fixtures-light-heading'><div><h2>ALL FOOTBALL MATCHES</h2><small>Live and upcoming fixtures · 1X2 match result</small></div><b>{upcomingFixtures.length} MATCHES</b></div>
            {loading&&<div className='fixture-loading-light'><RefreshCw/><b>Loading football fixtures…</b></div>}
            {!loading&&upcomingFixtures.length===0&&<div className='fixture-empty-light'>No football fixtures available from the connected sources yet.</div>}
            {!loading&&upcomingFixtures.map(match=>fixtureCard(match,match.live))}
            {!loading&&<p className='fixture-odds-disclaimer'>Odds are shown only when genuine prices are supplied by the connected bookmaker feed or saved in the match database. A dash means no verified price is available; prices are never invented.</p>}
          </section>
          <section className='grand-winners-section' aria-label='Grand Prize Winners'>
            <div className='grand-winners-heading'><h2>Grand Prize Winners</h2><button type='button' onClick={()=>nav('bets')}>View More <span>›</span></button></div>
            {winnersLoading&&recentWinners.length===0?<p className='winners-empty'>Checking verified winning tickets…</p>:winnersError?<p className='winners-empty'>Winner feed is temporarily unavailable. Please try again shortly.</p>:recentWinners.length===0?<p className='winners-empty'>Verified winning tickets will appear here when they are available.</p>:<div className='grand-winners-track-wrap'><div className='grand-winners-track'>
              {[...recentWinners,...recentWinners].map((winner:any,index:number)=><article className='grand-winner-card' key={`${winner.created_at}-${index}`}>
                <small>••••••••{String(index%10)} won</small>
                <strong>{money(Number(winner.potential_win))}</strong>
                <b>in Sports</b>
                <time>{Math.max(1,Math.floor((Date.now()-new Date(winner.created_at).getTime())/60000))} minutes ago</time>
              </article>)}
            </div></div>}
          </section>
          {!loading&&dbError&&<div className='fixture-feed-warning'>Fixture source notice: {dbError}</div>}
        </>;
      })()}
      {matchCentre&&<div className='sheet-backdrop' onClick={()=>setMatchCentre(null)}><section className='slip-sheet match-centre-sheet' onClick={e=>e.stopPropagation()}><header><b>Match Centre</b><button type='button' onClick={()=>setMatchCentre(null)}><X/></button></header><div className='match-centre-score'><small>{matchCentre.league} · {matchCentre.time}</small><div className='match-centre-teams'><div className='match-centre-team'>{matchCentre.homeLogo?<img src={matchCentre.homeLogo} alt={matchCentre.home+' logo'} loading='lazy'/>:<span className='team-logo-fallback'>{teamInitials(matchCentre.home)}</span>}<strong>{matchCentre.home}</strong></div><b>{matchCentre.score||'VS'}</b><div className='match-centre-team'>{matchCentre.awayLogo?<img src={matchCentre.awayLogo} alt={matchCentre.away+' logo'} loading='lazy'/>:<span className='team-logo-fallback'>{teamInitials(matchCentre.away)}</span>}<strong>{matchCentre.away}</strong></div></div><span>{matchCentre.live?'LIVE MATCH':'UPCOMING FIXTURE'}</span></div><nav className='match-centre-tabs'><button className={matchCentreTab==='markets'?'selected':''} onClick={()=>setMatchCentreTab('markets')}>Betting Markets</button><button className={matchCentreTab==='stats'?'selected':''} onClick={()=>setMatchCentreTab('stats')}>Stats & Form</button></nav>{matchCentreTab==='markets'&&<>{matchCentreLoading&&<div className='ai-preview-loading'><RefreshCw/><b>Loading saved markets…</b></div>}{matchCentreError&&<div className='match-centre-notice'>{matchCentreError}</div>}{!matchCentreLoading&&!matchCentreError&&matchCentreOdds.length===0&&<div className='match-centre-notice'>No active bookmaker markets have been saved for this fixture yet. We will show prices here only when genuine odds are available.</div>}{Array.from(new Set(matchCentreOdds.map((row:any)=>String(row.market||row.market_type||'Other')))).map(market=><section className='match-market-group' key={market}><h3>{market}</h3><div className='match-market-selections'>{matchCentreOdds.filter((row:any)=>String(row.market||row.market_type||'Other')===market).map((row:any)=><button key={row.id} onClick={()=>{const odd=Number(row.odd??row.odds??row.price);const selection=String(row.selection??row.outcome??row.name??'Selection');setMatchCentre(null);addPick(matchCentre,selection,String(odd),market);}}><span>{String(row.selection??row.outcome??row.name??'Selection')}</span><b>{Number(row.odd??row.odds??row.price).toFixed(2)}</b></button>)}</div></section>)}</>}{matchCentreTab==='stats'&&<div className='match-centre-stats'><h3>Match Statistics</h3><p>Possession, shots, shots on target, corners, cards, lineups, head-to-head and recent form will appear here when a verified statistics provider supplies them.</p><div className='match-centre-notice'>Statistics are not currently available for this fixture. We do not display made-up statistics.</div></div>}<p className='ai-preview-disclaimer'>Odds and statistics depend on provider coverage and can change. All selections are validated again by the betting service.</p></section></div>}
      {previewMatch&&<div className='sheet-backdrop' onClick={()=>setPreviewMatch(null)}><section className='slip-sheet ai-preview-sheet' onClick={e=>e.stopPropagation()}><header><b>Match Preview</b><button onClick={()=>setPreviewMatch(null)}><X/></button></header><div className='ai-preview-fixture'><strong>{previewMatch.home} vs {previewMatch.away}</strong><span>{previewMatch.league} · {previewMatch.time}</span><small>1: {previewMatch.odds[0]||'N/A'}　X: {previewMatch.odds[1]||'N/A'}　2: {previewMatch.odds[2]||'N/A'}</small></div>{previewLoading&&<div className='ai-preview-loading'><RefreshCw/><b>Analysing the fixture and available odds…</b></div>}{previewError&&<div className='ai-preview-error' role='alert'><p>{previewError}</p><button className='red-action' onClick={()=>requestMatchPreview(previewMatch)}>Try again</button></div>}{previewText&&<div className='ai-preview-result'>{previewText}</div>}<p className='ai-preview-disclaimer'>Match previews are informational only. Outcomes are uncertain and are not guaranteed.</p></section></div>}
      <section className='code-hub'>
        <div className='code-balance'><span className='code-count'>{slip.length}</span><div className='mode-switch'><button className={realMode?'selected':''} onClick={()=>setRealMode(true)}>REAL</button><button className={!realMode?'selected':''} onClick={()=>setRealMode(false)}>SIM</button></div><button className='code-collapse' onClick={()=>setShowSlip(!showSlip)}>⌄</button><strong>{money(walletBalance ?? 0)}</strong></div>
        <div className='code-tabs'>{['Code Hub','My Pins','Recent Codes'].map((t,i)=><button className={codeTab===t?'selected':''} key={t} onClick={()=>setCodeTab(t)}><b>{['⌕','⚑','◴'][i]}</b>{t}</button>)}</div>
        <div className='recommended-head' onClick={()=>setCodePanelOpen(!codePanelOpen)}><b>{codeTab==='Code Hub'?'Recommended Football Codes':codeTab}</b><span>{codePanelOpen?'⌃':'⌄'}</span></div>
        {codePanelOpen&&<div className='codes-empty'><b>{codeTab==='Code Hub'?'No published football codes yet':codeTab==='My Pins'?'You have no pinned codes':'No recent codes'}</b><p>Verified booking codes will appear here when the code service is connected. No sample codes or odds are being displayed.</p></div>}
        <div className='booking-load'><h3>Please insert booking code　ⓘ</h3><div><input value={bookingCode} onChange={e=>setBookingCode(e.target.value)} placeholder='Booking Code'/><button disabled={!bookingCode.trim()||codeBusy} onClick={loadBookingCode}>{codeBusy?'Loading…':'Load'}</button></div></div>
      </section>
    </>:null}
    {page==='codes'&&<section className='simple-screen'><h1>Code Hub</h1><p>Football booking codes will appear here when the code publishing service is connected.</p><div className='booking-load'><h3>Please insert booking code</h3><div><input value={bookingCode} onChange={e=>setBookingCode(e.target.value)} placeholder='Booking Code'/><button disabled={!bookingCode.trim()||codeBusy} onClick={loadBookingCode}>{codeBusy?'Loading…':'Load'}</button></div></div></section>}
    {page==='games'&&<section className='virtual-screen'><header className='virtual-header'><button onClick={()=>nav('home')}><ChevronLeft size={28}/></button><b>Games & Virtuals</b><strong>18+</strong></header><div className='virtual-tabs'><button className='selected'>Game</button><button>Mission</button><button className='gift-tab' onClick={()=>tell('Promotions require provider setup.')}><Gift/></button></div><div className='winner-ticker'>🏆 VIRTUAL MATCH CENTRE · ROUND #{virtualRoundNumber} · NEXT ROUND IN {virtualRoundCountdown}</div>{!selectedGame&&<button type='button' className='virtual-hero' onClick={()=>{setSelectedGame('Instant Football');setGameResult('');window.scrollTo({top:0,behavior:'smooth'});}}><div><small>POPULAR VIRTUAL</small><b>FAST FOOTBALL<br/><em>BIG MOMENTS</em></b><span>Practice mode · 18+</span></div><strong>⚽<small>SIM</small></strong><i>PLAY NOW</i></button>}{!selectedGame&&<div className='slider-dots'><i/><i/><i/><i/></div>}{selectedGame ? <section className='admin-form' style={{margin:'16px',background:'#15191f',color:'#fff',border:'1px solid #343a43'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><h2 style={{margin:0,color:'#fff'}}>{selectedGame}</h2><button type='button' onClick={()=>{setSelectedGame(null);setGameResult('');}}>Back to games</button></div><p style={{color:'#c5cbd3'}}>Practice mode only · No deposits, withdrawals or cash prizes. This demo does not connect to a licensed game provider.</p>{selectedGame==='Instant Football'&&<div className='vfootball-home'><div className='vfootball-title'><div><small>CLASSIC SPORTY HACKS</small><h2>vFOOTBALL</h2><span>Virtual leagues · Match centre</span></div><b>SIMULATION</b></div><div className='vfootball-leagues'>{virtualLeagues.map(league=><button type='button' key={league.name} className={activeVirtualLeague===league.name?'active':''} onClick={()=>setActiveVirtualLeague(league.name)}><span>{league.flag}</span><b>{league.name}</b><small>20 teams</small></button>)}</div><div className='vfootball-league-heading'><div><small>VIRTUAL LEAGUE</small><h3>{virtualLeagues.find(league=>league.name===activeVirtualLeague)?.flag} {activeVirtualLeague} · Virtual</h3></div><span>20 CLUBS</span></div><div className='vfootball-markets'><b>1X2</b><span>DOUBLE CHANCE</span><span>OVER / UNDER</span><span>GG / NG</span></div><div className='vfootball-fixtures'>{(virtualLeagues.find(league=>league.name===activeVirtualLeague)?.teams||[]).slice(0,10).map((team,index)=>{const teams=virtualLeagues.find(league=>league.name===activeVirtualLeague)?.teams||[];const away=teams[(index+7)%teams.length];const prices=[(1.55+(index%6)*0.19).toFixed(2),(3.1+(index%4)*0.22).toFixed(2),(2.05+(index%5)*0.21).toFixed(2)];return <article className='vfootball-fixture' key={activeVirtualLeague+'-'+team}><div className='vfootball-fixture-meta'><span>VIRTUAL · MATCH {String(index+1).padStart(2,'0')}</span><time>{String(12+index).padStart(2,'0')}:{index%2?'40':'10'}</time></div><div className='vfootball-teams'><b><i>{team.slice(0,3).toUpperCase()}</i>{team}</b><strong>VS</strong><b><i>{away.slice(0,3).toUpperCase()}</i>{away}</b></div><div className='vfootball-prices'>{['1','X','2'].map((pick,priceIndex)=><button type='button' key={pick} onClick={()=>tell('Practice demo only: '+team+' vs '+away+' · '+pick+' · illustrative price '+prices[priceIndex]+'. No bet has been placed.')}><small>{pick}</small><b>{prices[priceIndex]}</b></button>)}</div></article>})}</div><p className='vfootball-disclaimer'>Illustrative demo prices and scheduled pairings only. Results are not certified, shared or connected to a licensed virtual-sports provider. No real-money betting is available in this demo.</p></div>}<div className='virtual-round-panel' aria-live='polite'><span>ROUND #{virtualRoundNumber}</span><b>{virtualRoundCountdown}</b><small>Next practice round starts automatically every 2 minutes 30 seconds.</small></div><div style={{display:'flex',gap:18,flexWrap:'wrap',margin:'14px 0'}}><b>Practice points: {practicePoints}</b><b>Rounds played: {gameRounds}</b></div>{selectedGame==='Instant Football'&&<div className='virtual-football-board'>
  <div className='virtual-football-scorebar'>
    <div className='virtual-team-badge home-kit'><span>CSH</span><b>HOME XI</b></div>
    <div className='virtual-score-center'><strong>{footballScore.home} <i>:</i> {footballScore.away}</strong><span>{footballMinute}' · {footballBusy ? 'LIVE' : 'PRACTICE'}</span></div>
    <div className='virtual-team-badge away-kit'><span>VIS</span><b>AWAY XI</b></div>
  </div>
  <div className='virtual-football-clock'><b>{footballMinute}'</b><span>{footballBusy?'LIVE PRACTICE MATCH':'90-MINUTE SIMULATION'}</span><em>{footballBusy?'● LIVE':'● READY'}</em></div>
  <div className='virtual-football-pitch' aria-label='Animated football pitch'>
    <div className='pitch-halfway'></div><div className='pitch-centre-circle'></div><div className='pitch-box pitch-box-left'></div><div className='pitch-box pitch-box-right'></div><div className='pitch-goal pitch-goal-left'></div><div className='pitch-goal pitch-goal-right'></div>
    {[[12,20],[24,42],[17,67],[34,17],[38,52],[29,82],[45,32],[44,70],[7,49],[20,50],[38,91]].map(([x,y],i)=><span key={'h'+i} className={'pitch-player pitch-home '+(i===0?'keeper':'')} style={{left:x+'%',top:y+'%'}}>{i===0?'1':i+1}</span>)}
    {[[88,20],[76,42],[83,67],[66,17],[62,52],[71,82],[55,32],[56,70],[93,49],[80,50],[62,91]].map(([x,y],i)=><span key={'a'+i} className={'pitch-player pitch-away '+(i===0?'keeper':'')} style={{left:x+'%',top:y+'%'}}>{i===0?'1':i+1}</span>)}
    <span className={'pitch-ball '+(footballBusy?'ball-moving':'')}></span>
    {footballPhase.includes('GOAL!')&&<div className='pitch-goal-celebration' role='status'><strong>GOOOAL!</strong><span>⚽ WHAT A FINISH!</span></div>}
  </div>
  <div className='virtual-football-track'><i style={{width:`${footballMinute/90*100}%`}}/></div>
  <p className='virtual-football-commentary' aria-live='polite'>{footballPhase}</p>
  <button type='button' className='red-action' onClick={playPracticeRound} disabled={footballBusy}>{footballBusy?'MATCH IN PROGRESS…':'▶ START FOOTBALL MATCH'}</button>
  {footballHistory.length>0&&<div className='virtual-football-history'><b>RECENT PRACTICE RESULTS</b>{footballHistory.map((item,index)=><span key={`${item}-${index}`}>{item}</span>)}</div>}
</div>}{selectedGame!=='Instant Football'&&<button type='button' className='red-action' onClick={playPracticeRound}>PLAY PRACTICE ROUND</button>}{gameResult&&<div role='status' style={{marginTop:16,padding:14,background:'#252c35',borderRadius:8}}><b>{gameResult}</b></div>}</section> : <><div className='play-now'><b>GAME CATALOGUE</b><span>ⓘ</span></div><div className='virtual-grid'>{games.map(([title,label,art,tone])=><button type='button' className='virtual-card' key={title} aria-label={'Open '+title} onClick={()=>{setSelectedGame(title);setGameResult('');window.scrollTo({top:0,behavior:'smooth'});}}><small>▸ {label}</small><div className={'virtual-art '+tone}><div><b>{title}</b><span>▶ PLAY NOW</span></div><strong>{art}</strong></div></button>)}</div></>}</section>}
    {page==='wallet'&&<section className='simple-screen'><div className='deposit-page-heading'><button type='button' onClick={()=>nav('profile')}>‹ <span>Me</span></button><b>{walletAction==='deposit'?'Deposit':'Withdraw'}</b><button type='button' aria-label='Deposit help' onClick={()=>tell('Choose your mobile money network, enter the amount and payment transaction reference, then submit. Your wallet is credited only after verification.')}>?</button></div><div className='wallet-balance'><small>AVAILABLE BALANCE</small><b>{walletBalance===null?'—':money(walletBalance)}</b><span>{!session?'Sign in to access your wallet.':walletLoading?'Loading your balance from Supabase…':walletError?'Wallet could not be loaded.':walletBalance===null?'Wallet data was returned, but its balance field needs mapping.':'Live balance from your Supabase wallet.'}</span></div>{session&&<button className='red-action' onClick={loadWallet} disabled={walletLoading}>{walletLoading?'Refreshing…':'Refresh balance'}</button>}{walletError&&<p role='alert' style={{color:'#bd1028'}}>Wallet error: {walletError}</p>}<div className='wallet-buttons'><button onClick={()=>{setWalletAction('deposit');setWalletActionError('');}}>Deposit</button><button onClick={()=>{setWalletAction('withdraw');setWalletActionError('');}}>Withdraw</button></div>{session?<form className={'wallet-action-form '+(walletAction==='deposit'?'deposit-reference-form':'')} onSubmit={submitWalletRequest}>{walletAction==='deposit'?<><div className='deposit-tabs'>{(['Mobile Money','Paybill','Card'] as const).map(tab=><button type='button' key={tab} className={depositTab===tab?'active':''} onClick={()=>{setDepositTab(tab);if(tab!=='Mobile Money')tell(tab+' deposits are not connected yet. Mobile Money is currently available.');}}>{tab}</button>)}</div><div className='deposit-warning'><b>!</b><span>Enter your own MoMo number, choose your network and amount, then submit a deposit request. After submitting, check Notification Center for your private deposit update. Do not send money until the payment instructions are displayed there. Your wallet is credited only after the payment is independently verified.</span></div><label>Mobile Money number<input required type='tel' inputMode='numeric' pattern='0[0-9]{9}' maxLength={10} placeholder='e.g. 0241234567' value={depositForm.phone} onChange={e=>setDepositForm({...depositForm,phone:e.target.value.replace(/[^0-9]/g,'').slice(0,10)})}/></label><label>Payment network<select required value={depositForm.payment_method} onChange={e=>setDepositForm({...depositForm,payment_method:e.target.value})}><option>MTN Mobile Money</option><option>Telecel Cash</option><option>AirtelTigo Money</option></select></label><label>Amount (GHS)<input required type='number' min='1' max='100000' step='0.01' placeholder='min. 1.00' value={depositForm.amount} onChange={e=>setDepositForm({...depositForm,amount:e.target.value})}/></label><div className='deposit-quick-amounts'>{[2,5,10,50,100].map(value=><button type='button' key={value} onClick={()=>setDepositForm({...depositForm,amount:String(Number(depositForm.amount||0)+value)})}>+{value}</button>)}</div><p>Submitting this form only records your request; it does not collect money or trigger a MoMo prompt. Your deposit update will appear in Notification Center. Do not pay until the receiving account and payment instructions are displayed there. Keep your receipt and wait for independent payment verification before your wallet is credited.</p></>:<><div className='withdrawal-intro'><b>Withdraw to Mobile Money</b><span>Choose your network and enter the registered account details. Minimum withdrawal: GHS 10.00.</span></div><label>Mobile money network<select required value={withdrawalForm.provider} onChange={e=>setWithdrawalForm({...withdrawalForm,provider:e.target.value})}><option value='MTN'>MTN Mobile Money</option><option value='VOD'>Telecel Cash</option><option value='ATL'>AirtelTigo Money</option></select></label><label>Amount (GHS)<input required type='number' min='10' step='0.01' placeholder='Minimum GHS 10.00' value={withdrawalForm.amount} onChange={e=>setWithdrawalForm({...withdrawalForm,amount:e.target.value})}/></label><div className='deposit-quick-amounts withdrawal-quick-amounts'>{[10,20,50,100,200].map(value=><button type='button' key={value} onClick={()=>setWithdrawalForm({...withdrawalForm,amount:String(value)})}>GHS {value}</button>)}</div><label>MoMo account name<input required placeholder='Account holder name' value={withdrawalForm.account_name} onChange={e=>setWithdrawalForm({...withdrawalForm,account_name:e.target.value})}/></label><label>MoMo phone number<input required type='tel' inputMode='numeric' pattern='0[0-9]{9}' maxLength={10} placeholder='e.g. 0241234567' value={withdrawalForm.phone} onChange={e=>setWithdrawalForm({...withdrawalForm,phone:e.target.value.replace(/[^0-9]/g,'').slice(0,10)})}/></label><div className='withdrawal-notice'><b>Withdrawal information</b><span>Your requested amount is reserved from your wallet when you submit. An administrator processes the payout. If your request is rejected, the amount is returned to your wallet.</span></div></>}{walletActionError&&<div className='admin-alert' role='alert'>{walletActionError}</div>}<button className='red-action' type='submit' disabled={walletActionBusy}>{walletActionBusy?'Submitting…':walletAction==='deposit'?'TOP UP NOW':'REQUEST WITHDRAWAL'}</button></form>:<button className='red-action' onClick={()=>{setAuthMode('login');setShowAuth(true);}}>Sign in to use your wallet</button>}<p>All wallet changes are processed by protected Supabase functions. Never share your PIN or OTP.</p></section>}
    {page==='bets'&&(()=>{const selectedBet=myBets.find((bet:any)=>String(bet.id)===String(selectedBetId));const legsFor=(bet:any)=>myBetSelections.filter((leg:any)=>String(leg.bet_id)===String(bet.id));const matchFor=(leg:any)=>myBetMatches.find((match:any)=>String(match.id)===String(leg.match_id));const statusOf=(bet:any)=>String(bet.status||'pending').toLowerCase();const isOpen=(bet:any)=>['pending','open','unsettled'].includes(statusOf(bet));const visibleBets=myBets.filter((bet:any)=>betView==='open'?isOpen(bet):!isOpen(bet)).filter((bet:any)=>betResultFilter==='all'||statusOf(bet)===betResultFilter);const betReturn=(bet:any)=>statusOf(bet)==='won'?Number(bet.potential_win||0):statusOf(bet)==='void'?Number(bet.stake||0):0;const fmtDate=(value:any)=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}):'—';return <section className='sporty-bets-screen'>{selectedBet?<><header className='ticket-detail-header'><button onClick={()=>setSelectedBetId(null)}>‹ <span>Back</span></button><b>Ticket Details</b><button onClick={()=>tell('Contact support about ticket '+String(selectedBet.reference||selectedBet.id))}>◉</button></header><div className='ticket-summary-dark'><small>Ticket ID: {selectedBet.reference||String(selectedBet.id).slice(0,8)}</small><div className='ticket-type-line'><b>{legsFor(selectedBet).length>1?'Multiple':'Single'}</b><strong className={'ticket-status '+statusOf(selectedBet)}>{statusOf(selectedBet).toUpperCase()}</strong></div><div className='ticket-return'><span>Total Classic Sporty Hacks Return</span><b>{money(betReturn(selectedBet))}</b></div><div className='ticket-metrics'><div><span>Total Stake</span><b>{money(Number(selectedBet.stake))}</b></div><div><span>Total Odds</span><b>{Number(selectedBet.combined_odds||1).toFixed(2)}</b></div><div><span>Potential Return</span><b>{money(Number(selectedBet.potential_win))}</b></div><div><span>Placed</span><b>{new Date(selectedBet.created_at).toLocaleString()}</b></div></div></div><div className='ticket-legs'>{legsFor(selectedBet).map((leg:any,index:number)=>{const match=matchFor(leg);const result=String(leg.result||'pending').toLowerCase();const hs=match?.home_score;const as=match?.away_score;const pick=String(leg.selection||'');const market=String(leg.market||'Market');const outcome=market.toLowerCase()==='1x2'?pick==='1'?'Home':pick.toUpperCase()==='X'?'Draw':pick==='2'?'Away':pick:pick;return <article className='ticket-leg' key={leg.id||index}><div className='ticket-leg-result'><b className={result==='won'?'won':result==='lost'?'lost':'pending'}>{result==='won'?'✓':result==='lost'?'×':'•'}</b><div><small>{match?.start_time?new Date(match.start_time).toLocaleString():''}</small><strong>{match?match.home_team+' v '+match.away_team:'Match details unavailable'}</strong><span>FT Score　{hs===null||hs===undefined?'—':hs+':'+(as??'—')}</span></div></div><div className={'ticket-pick-box '+(result==='won'?'pick-won':result==='lost'?'pick-lost':'pick-pending')}><div><span>Pick</span><b>{pick}@{Number(leg.odd||0).toFixed(2)}</b></div><div><span>Market</span><b>{market}</b></div><div><span>Outcome</span><b>{outcome}</b></div><em>{result.toUpperCase()}</em></div></article>})}{!legsFor(selectedBet).length&&<p className='ticket-empty'>No selection details were found for this ticket.</p>}</div></>:<><div className='bets-topbar'><div><span>ⓘ How to Cashout?</span><strong>{walletBalance===null?'GHS 0.00':money(walletBalance)}</strong></div><nav><button className={betView==='open'?'active':''} onClick={()=>{setBetView('open');setBetResultFilter('all')}}>Open Bets</button><button className={betView==='history'?'active':''} onClick={()=>{setBetView('history');setBetResultFilter('all')}}>Bet History</button></nav></div><div className='bets-filters'><select aria-label='Bet result' value={betResultFilter} onChange={e=>setBetResultFilter(e.target.value)}><option value='all'>Bet Result</option><option value='won'>Won</option><option value='lost'>Lost</option><option value='void'>Void</option></select><button onClick={loadMyBets} disabled={myBetsLoading}>↻</button></div>{betError&&<div className='admin-alert' role='alert'>{betError}</div>}{myBetsLoading?<div className='ticket-empty'>Loading your bets…</div>:visibleBets.length?visibleBets.map((bet:any)=><article className='bet-history-card' key={bet.id} onClick={()=>openBetTicket(bet)}><div className='bet-history-date'><b>{fmtDate(bet.created_at).split(' ')[0]}</b><span>{fmtDate(bet.created_at).split(' ')[1]}</span></div><div className='bet-history-content'><header><b>{legsFor(bet).length>1?'Multiple':'Single'}</b><strong className={'ticket-status '+statusOf(bet)}>{statusOf(bet).toUpperCase()}　›</strong></header><div><span>Total Stake (GHS)</span><b>{Number(bet.stake||0).toFixed(2)}</b></div><div><span>Total Return</span><b className='history-return'>{betReturn(bet).toFixed(2)}</b></div><hr/><p>{legsFor(bet).slice(0,3).map((leg:any)=>{const match=matchFor(leg);return match?match.home_team+' v '+match.away_team:String(leg.selection||'Selection')}).join(' · ')}</p>{legsFor(bet).length>3&&<small>…(and {legsFor(bet).length-3} other matches)</small>}<button type='button' onClick={e=>{e.stopPropagation();setSelectedBetId(String(bet.id))}}>View Ticket Details</button></div></article>):<div className='ticket-empty'><Ticket size={38}/><b>No {betView==='open'?'open bets':'settled bets'} found</b><p>Your tickets will appear here when you place bets.</p></div>}</>}</section>})()}
    {page==='notifications'&&<section className='simple-screen'><div className='deposit-page-heading'><button type='button' onClick={()=>nav('profile')}>‹ <span>Me</span></button><b>Notification Center</b><button type='button' onClick={loadNotifications}>↻</button></div><p>Your private deposit updates and account notifications.</p>{notificationsError&&<div className='admin-alert' role='alert'>Could not load notifications: {notificationsError}</div>}{notificationsLoading?<p>Loading notifications…</p>:notifications.length?notifications.map((item:any)=>{const isDeposit=String(item.title||'').toLowerCase().includes('deposit');const isMtn=/mtn/i.test(String(item.message||''));return <article className='admin-row' key={item.id} style={{display:'block',marginBottom:12}}><b>{item.title}</b><p style={{margin:'8px 0'}}>{item.message}</p>{isDeposit&&isMtn&&<div style={{marginTop:12,padding:14,borderRadius:10,background:'#10251c',border:'1px solid #24734b',color:'#fff'}}><div style={{fontSize:11,fontWeight:800,letterSpacing:1,color:'#8ee3ad'}}>CLASSIC SPORTY HACKS · OFFICIAL MTN PAYMENT</div><h3 style={{margin:'8px 0',color:'#fff'}}>Complete your deposit</h3><p style={{margin:'6px 0',color:'#d8e8df'}}>1. Open your MTN MoMo app and choose Send Money.<br/>2. Enter the receiving number below.<br/>3. Confirm the recipient name shown by MTN before continuing.<br/>4. Send exactly the amount in your deposit request.<br/>5. Keep your transaction ID and receipt, then wait for verification.</p>{mtnReceivingNumber?<div style={{padding:12,background:'#07150f',borderRadius:8,margin:'10px 0'}}><small style={{display:'block',color:'#9ab6a5'}}>MTN RECEIVING NUMBER</small><strong style={{fontSize:22,letterSpacing:1,color:'#fff',overflowWrap:'anywhere'}}>{mtnReceivingNumber}</strong><button type='button' onClick={()=>{navigator.clipboard?.writeText(mtnReceivingNumber);tell('Receiving number copied.');}} style={{display:'block',marginTop:8,padding:'8px 12px'}}>Copy number</button></div>:<p role='alert' style={{color:'#ffd1a8'}}>{mtnReceivingError||'Loading secure receiving details…'}</p>}<p style={{fontSize:12,color:'#d8e8df',marginBottom:0}}>Important: Only send after confirming the account name. Never share your MoMo PIN or OTP. Your wallet is credited only after an administrator independently verifies the payment in the receiving account. A deposit request or receipt alone does not guarantee credit.</p></div>}{isDeposit&&!isMtn&&<p style={{fontSize:12,color:'#ffd1a8'}}>These receiving instructions currently support MTN Mobile Money only. Do not send money using another network until its receiving details are provided.</p>}<small>{item.created_at?new Date(item.created_at).toLocaleString():''} · NEW</small></article>}):<div className='ticket-empty'>You have no notifications yet. Deposit updates will appear here.</div>}</section>}
    {page==='profile'&&<section className='me-screen'>
      <div className='me-hero'>
        <div className='me-profile-row'>
          <div className='me-avatar'>{session?displayName.slice(0,1):'?'}</div>
          <div className='me-identity'><b>{session?displayName:'WELCOME'}</b><span>{session?session.user.email:'Sign in to access your account'}</span><small>Classic Sporty Hacks member</small></div>
          <button className='me-settings' onClick={()=>session?nav('support'):(setAuthMode('login'),setShowAuth(true))}>⚙</button>
        </div>
        <div className='me-tier'><span>LOYALTY TIER</span><b>MEMBER</b></div>
        <div className='me-progress'><i/></div>
        <div className='me-balance-line'><span>Total Balance</span><strong>{money(walletBalance ?? 0)}</strong></div>
        <div className='me-actions'><button onClick={()=>nav('wallet')}>▣ <b>Deposit</b></button><button onClick={()=>nav('wallet')}>▤ <b>Withdraw</b></button></div>
        <button className='me-rewards' onClick={()=>nav('support')}><span><b>Classic Loyalty</b><small>Rewards · Challenges</small></span><strong>Explore Help　›</strong></button>
        <div className='me-quick-links'>
          <button onClick={()=>nav('bets')}><span>▤</span><b>Sports Bet<br/>History</b></button>
          <button onClick={()=>nav('wallet')}><span>↻</span><b>Transaction<br/>Records</b></button>
          <button onClick={()=>nav('notifications')}><span>♧</span><b>Notifications</b></button>
        </div>
      </div>
      <div className='me-appearance-row'>
        <span><b>Appearance</b><small>Choose how Classic Sporty Hacks looks</small></span>
        <button type='button' onClick={()=>setTheme(current=>current==='light'?'dark':'light')} aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'}><span>{theme==='light'?'☀️':'🌙'}</span><b>{theme==='light'?'Light mode':'Dark mode'}</b><i>{theme==='light'?'Switch':'Switch'}</i></button>
      </div>
      <div className='me-menu'>
        {[
          ['♟','My SportySocial','Create','support'],
          ['♨','Daily Streak','—','support'],
          ['☏','Customer Service','Online 24/7','support'],
          ['♧','Notification Center','','notifications'],
          ['♡','Rate Our App','','rate'],
          ['ⓘ','How to play','','support'],
          ['✦','Share an Idea','','support'],
          ['↻','Update App','','update']
        ].map(([icon,label,meta,target])=><button key={label} onClick={()=>target==='notifications'?nav('notifications'):target==='support'?nav('support'):target==='rate'?tell('Thank you for supporting Classic Sporty Hacks.'):tell('You are using the latest available version of Classic Sporty Hacks.')}><span className='me-menu-icon'>{icon}</span><b>{label}</b><small>{meta}</small><strong>›</strong></button>)}
        {isAdmin&&<button onClick={()=>nav('admin')}><span className='me-menu-icon'>♜</span><b>Admin Dashboard</b><small>Admin</small><strong>›</strong></button>}
        {session?<button onClick={signOut}><span className='me-menu-icon'>⇥</span><b>Sign out</b><small></small><strong>›</strong></button>:<button onClick={()=>{setAuthMode('login');setShowAuth(true);}}><span className='me-menu-icon'>⇥</span><b>Login / Register</b><small></small><strong>›</strong></button>}
      </div>
      <div className='me-footer'>18+　　© 2026 Classic Sporty Hacks. All rights reserved.</div>
    </section>}
    {page==='support'&&<section className='simple-screen support-screen'>
      <div className='deposit-page-heading'><button type='button' onClick={()=>nav('profile')}>‹ <span>Me</span></button><b>Customer Service</b><span className='support-online'>● Online</span></div>
      <div className='support-welcome'><span>☏</span><div><h1>How can we help?</h1><p>Choose a topic below for step-by-step help with your account.</p></div></div>
      <div className='support-topic-list'>
        <button onClick={()=>nav('wallet')}><span>▣</span><div><b>Deposits & withdrawals</b><small>Payment requests, verification and wallet balance</small></div><strong>›</strong></button>
        <button onClick={()=>nav('bets')}><span>▤</span><div><b>Bets & winning tickets</b><small>Find your bet history, results and ticket details</small></div><strong>›</strong></button>
        <button onClick={()=>nav('codes')}><span>⌕</span><div><b>Booking codes</b><small>Load a code and review its selections</small></div><strong>›</strong></button>
        <button onClick={()=>nav('notifications')}><span>♧</span><div><b>Notifications</b><small>Check updates about your account and payments</small></div><strong>›</strong></button>
      </div>
      <div className='support-faq'>
        <h2>Frequently asked questions</h2>
        <details><summary>When will my deposit appear?</summary><p>A deposit request does not credit your wallet immediately. Check Notification Center for the payment update. Your wallet is credited only after the payment is independently verified.</p></details>
        <details><summary>Where can I see my winning tickets?</summary><p>Open My Bets from the bottom navigation, then choose your settled bets to view ticket status, stake, odds and return.</p></details>
        <details><summary>Why is an odd unavailable?</summary><p>Only active prices saved in the connected match database can be selected. A dash means a verified price is not currently available.</p></details>
        <details><summary>How do I load a booking code?</summary><p>Open the bet slip or Code Hub, enter the booking code and tap Load. The saved selections will be added to your slip.</p></details>
      </div>
      <div className='support-contact-note'><b>Need a support agent?</b><p>Chat directly with Classic Sporty Hacks support on WhatsApp. Tap below to start a private conversation.</p><a href={'https://wa.me/15488762529?text='+encodeURIComponent('Hello Classic Sporty Hacks Support, I need help with my account.')} target='_blank' rel='noopener noreferrer' style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginTop:14,padding:'14px 16px',borderRadius:9,background:'#20b85a',color:'#fff',fontWeight:900,textDecoration:'none'}}><span style={{fontSize:22}}>☏</span> Chat with us on WhatsApp</a><small style={{display:'block',marginTop:10,color:'inherit'}}>Support WhatsApp: +1 548 876 2529</small></div>
    </section>}
    {page==='admin'&&<section className='admin-screen'><header className='admin-heading'><div><h1><Shield size={24}/> Admin Dashboard</h1><p>Private management console · Supabase authenticated</p></div><button onClick={loadAdminData} disabled={adminBusy}><RefreshCw size={16}/> Refresh</button></header>{!isAdmin?<div className='admin-alert'>Restricted. An active Supabase profile with role admin is required.</div>:<><nav className='admin-tabs'>{['Overview','Matches','Results & Settlement','Odds','Booking Codes','Users','Bets','Transactions','Deposits','Withdrawals','Wallet'].map(t=><button className={adminTab===t?'selected':''} key={t} onClick={()=>{setAdminTab(t);if(!adminRows.Matches)loadAdminData();}}>{t}</button>)}</nav>{adminError&&<div className='admin-alert'>{adminError}</div>}{adminBusy&&<p className='admin-muted'>Loading secure admin data…</p>}{adminTab==='Overview'&&<><div className='admin-stat-grid'>{[['Matches',adminRows.Matches?.length],['Odds',adminRows.Odds?.length],['Users',adminRows.Users?.length],['Bets',adminRows.Bets?.length],['Transactions',adminRows.Transactions?.length],['Withdrawals',adminRows.Withdrawals?.length]].map(([k,v])=><div key={String(k)}><small>{k}</small><b>{v===undefined?'—':v}</b></div>)}</div><p className='admin-muted'>Use the sections above to manage fixtures, prices, users, betting records and wallet operations.</p></>}{adminTab==='Matches'&&<><form className='admin-form' onSubmit={createScheduledMatch}><h2>Create Scheduled 90-Minute Match</h2><p className='admin-muted'>Set a future kickoff in Ghana time and the final score in advance. The match is clearly identified as operator-configured. It starts at the scheduled time and runs for 90 real minutes; Supabase checks the schedule every minute and settles at the first check after full time.</p><input required placeholder='Home team' value={scheduledForm.home_team} onChange={e=>setScheduledForm({...scheduledForm,home_team:e.target.value})}/><input required placeholder='Away team' value={scheduledForm.away_team} onChange={e=>setScheduledForm({...scheduledForm,away_team:e.target.value})}/><label>Kickoff date & time (Ghana time)<input required type='datetime-local' value={scheduledForm.kickoff} onChange={e=>setScheduledForm({...scheduledForm,kickoff:e.target.value})}/></label><div className='admin-actions'><label style={{flex:1}}>Final home score<input required type='number' min='0' step='1' value={scheduledForm.home_score} onChange={e=>setScheduledForm({...scheduledForm,home_score:e.target.value})}/></label><label style={{flex:1}}>Final away score<input required type='number' min='0' step='1' value={scheduledForm.away_score} onChange={e=>setScheduledForm({...scheduledForm,away_score:e.target.value})}/></label></div><button type='submit' disabled={scheduledBusy}>{scheduledBusy?'Publishing scheduled match…':'Publish scheduled match'}</button></form><div className='admin-form'><h2>Automatic Football Feed</h2><p className='admin-muted'>Fetch upcoming fixtures and genuine 1X2 bookmaker prices from API-Football within your plan's allowed dates. Restricted future dates are skipped; fixtures are saved even when no bookmaker price is returned.</p><button type='button' onClick={syncFootballFeed} disabled={adminBusy}>{adminBusy?'Syncing football data…':'Sync upcoming fixtures + bookmaker odds'}</button></div><form className='admin-form' onSubmit={saveAdminMatch}><h2>{matchForm.id?'Edit Match':'Create Match'}</h2><input required placeholder='Home team' value={matchForm.home_team} onChange={e=>setMatchForm({...matchForm,home_team:e.target.value})}/><input required placeholder='Away team' value={matchForm.away_team} onChange={e=>setMatchForm({...matchForm,away_team:e.target.value})}/><input required placeholder='League / Competition' value={matchForm.league} onChange={e=>setMatchForm({...matchForm,league:e.target.value})}/><label>Kickoff date & time<input type='datetime-local' value={matchForm.match_date} onChange={e=>setMatchForm({...matchForm,match_date:e.target.value})}/></label><label className='admin-check'><input type='checkbox' checked={matchForm.is_active} onChange={e=>setMatchForm({...matchForm,is_active:e.target.checked})}/> Publish / active</label><div className='admin-actions'><button type='submit' disabled={adminBusy}>{matchForm.id?'Save changes':'Create match'}</button><button type='button' onClick={()=>setMatchForm({id:'',home_team:'',away_team:'',league:'',match_date:'',is_active:true})}>Clear</button></div></form><h2>Match Management ({adminRows.Matches?.length||0})</h2>{(adminRows.Matches||[]).map(row=><article className='admin-row' key={row.id}><div><b>{row.home_team||row.home||row.home_name} vs {row.away_team||row.away||row.away_name}</b><small>{row.league||row.competition} · {row.match_date||row.kickoff_at||row.start_time||'Kickoff TBA'}</small><small>Status: {(row.is_active??row.active??true)?'Active / Published':'Inactive'}</small></div><div className='admin-actions'><button onClick={()=>setMatchForm({id:row.id,home_team:row.home_team||row.home||row.home_name||'',away_team:row.away_team||row.away||row.away_name||'',league:row.league||row.competition||'',match_date:String(row.match_date||row.kickoff_at||row.start_time||'').slice(0,16),is_active:row.is_active??row.active??true})}>Edit</button><button onClick={()=>toggleMatch(row)}>{(row.is_active??row.active??true)?'Unpublish':'Publish'}</button><button className='danger' onClick={()=>deleteMatch(row)}>Delete</button></div></article>)}</>}{adminTab==='Results & Settlement'&&<><div className='admin-form'><h2>Football Results & Automatic Settlement</h2><p className='admin-muted'>Check API-Football for official FT, AET and PEN scores for matches with unresolved selections. Only exact home/away team matches on the same fixture date are accepted. Matches without provider coverage can be settled with a manually verified final score below.</p><button type='button' onClick={syncMatchResults} disabled={resultsBusy||adminBusy}>{resultsBusy?'Checking confirmed results…':'Sync confirmed results & settle bets'}</button>{resultsMessage&&<p className='admin-muted' role='status'>{resultsMessage}</p>}</div><h2>Matches awaiting results ({adminRows.PendingMatches?.length||0})</h2>{(adminRows.PendingMatches||[]).map((row:any)=><article className='admin-row' key={row.id}><div style={{minWidth:0,flex:1}}><b>{row.home_team} vs {row.away_team}</b><small>{row.start_time?new Date(row.start_time).toLocaleString():'Kickoff TBA'} · Current status: {row.status||'unknown'}</small><div style={{display:'flex',gap:8,marginTop:9}}><label style={{flex:1,fontSize:11}}>Home score<input type='number' min='0' step='1' value={(resultInputs[row.id]||{home:String(row.home_score??''),away:String(row.away_score??'')}).home} onChange={e=>setResultInputs(old=>({...old,[row.id]:{...(old[row.id]||{home:String(row.home_score??''),away:String(row.away_score??'')}),home:e.target.value}}))}/></label><label style={{flex:1,fontSize:11}}>Away score<input type='number' min='0' step='1' value={(resultInputs[row.id]||{home:String(row.home_score??''),away:String(row.away_score??'')}).away} onChange={e=>setResultInputs(old=>({...old,[row.id]:{...(old[row.id]||{home:String(row.home_score??''),away:String(row.away_score??'')}),away:e.target.value}}))}/></label></div><small>Manual entry is an admin confirmation of the official final score.</small></div><button type='button' onClick={()=>saveManualMatchResult(row)} disabled={resultsBusy||adminBusy}>Confirm score & settle</button></article>)}{!adminRows.PendingMatches?.length&&<p className='admin-muted'>No unresolved match selections found.</p>}</>}{adminTab==='Odds'&&<><form className='admin-form' onSubmit={saveAdminOdds}><h2>Add Match Odds</h2><select required value={oddsForm.match_id} onChange={e=>setOddsForm({...oddsForm,match_id:e.target.value})}><option value=''>Select match</option>{(adminRows.Matches||[]).map(m=><option key={m.id} value={m.id}>{m.home_team||m.home} vs {m.away_team||m.away}</option>)}</select><select value={oddsForm.market} onChange={e=>setOddsForm({...oddsForm,market:e.target.value})}><option>1X2</option><option>Correct Score</option><option>Over/Under</option><option>Both Teams To Score</option><option>Double Chance</option><option>Handicap</option><option>Draw No Bet</option><option>Half Time / Full Time</option></select>{oddsForm.market==='1X2'?<select required value={oddsForm.selection} onChange={e=>setOddsForm({...oddsForm,selection:e.target.value})}><option value='1'>1 · Home</option><option value='X'>X · Draw</option><option value='2'>2 · Away</option></select>:<input required placeholder={oddsForm.market==='Correct Score'?'Score (e.g. 1-0, 2-1, 0-0)':'Selection (e.g. Over 2.5, Yes, No)'} value={oddsForm.selection} onChange={e=>setOddsForm({...oddsForm,selection:e.target.value})}/>} <input required type='number' min='1.01' step='0.01' placeholder='Decimal odds' value={oddsForm.odds} onChange={e=>setOddsForm({...oddsForm,odds:e.target.value})}/><button type='submit' disabled={adminBusy}>Save odds</button></form><h2>Existing Odds ({adminRows.Odds?.length||0})</h2>{(adminRows.Odds||[]).map(row=><div className='admin-row' key={row.id}><div><b>{row.market||row.market_type||'Market'} · {row.selection||row.outcome||'Selection'}</b><small>Match ID: {row.match_id}</small></div><strong>{row.odds||row.odd||row.price}</strong></div>)}</>}{adminTab==='Booking Codes'&&<><div className='admin-form'><h2>Create Booking Code</h2><p className='admin-muted'>Choose one or more outcomes from matches with odds already saved in Supabase.</p>{(adminRows.Matches||[]).flatMap((match:any)=>(adminRows.Odds||[]).filter((odd:any)=>String(odd.match_id)===String(match.id)&&Number(odd.odds??odd.odd??odd.price)>1).map((odd:any)=><label className='admin-check' key={`${match.id}|${odd.id}`}><input type='checkbox' checked={codeSelections.includes(`${match.id}|${odd.id}`)} onChange={e=>setCodeSelections(old=>e.target.checked?[...old,`${match.id}|${odd.id}`]:old.filter(k=>k!==`${match.id}|${odd.id}`))}/>{val(match,['home_team','home','home_name'],'Home')} vs {val(match,['away_team','away','away_name'],'Away')} · {val(odd,['market','market_type'],'1X2')} / {val(odd,['selection','outcome'],'')} @ {val(odd,['odds','odd','price'],'')}</label>))}{!adminRows.Odds?.length&&<p className='admin-muted'>Add matches and their odds first. External fixture feeds cannot be booked until odds are entered.</p>}<button type='button' onClick={createBookingCode} disabled={codeBusy||!codeSelections.length}>{codeBusy?'Creating…':'Create booking code'}</button></div><h2>Published Booking Codes ({adminRows.BookingCodes?.length||0})</h2>{(adminRows.BookingCodes||[]).map((row:any)=><article className='admin-row' key={row.id}><div><b>{row.code}</b><small>{Array.isArray(row.selections)?row.selections.length:0} selections · {new Date(row.created_at).toLocaleString()}</small></div><button onClick={()=>{setBookingCode(row.code);setPage('codes');}}>Load code</button></article>)}</>}{adminTab==='Deposits'&&<><h2>Deposit Requests ({adminRows.Deposits?.length||0})</h2><p className='admin-muted'>Use the customer MoMo number shown on each request to send payment instructions privately outside this dashboard. Never display the receiving account publicly. After the customer pays, verify the actual incoming transaction in your MoMo account before approving. Approval credits the wallet; rejection does not.</p><div className='admin-form'><label>Admin note (optional)<input value={depositAdminNote} onChange={e=>setDepositAdminNote(e.target.value)} placeholder='Verification note'/></label></div>{(adminRows.Deposits||[]).map((row:any)=><article className='admin-row' key={row.id}><div><b>{money(Number(row.amount||0))} · {row.payment_method||'Payment method'}</b><small>{row.user_name||row.user_email||row.user_id}</small><small>Customer MoMo number: {row.payment_reference||'Not supplied'} · {row.created_at?new Date(row.created_at).toLocaleString():''}</small><small>Status: {String(row.status||'pending').toUpperCase()}</small></div>{String(row.status||'pending').toLowerCase()==='pending'&&<div style={{width:'100%',display:'grid',gap:8,marginTop:10}}><label style={{fontSize:12,fontWeight:700}}>Private payment instructions (sent only in WhatsApp)<textarea rows={3} value={privateDepositMessages[row.id]||''} onChange={e=>setPrivateDepositMessages(old=>({...old,[row.id]:e.target.value}))} placeholder='Enter the receiving MoMo name, number and exact amount/instructions to send privately to this customer.' style={{width:'100%',padding:10,borderRadius:8,resize:'vertical'}}/></label><div className='admin-actions'><button type='button' onClick={()=>openPrivateDepositChat(row)}>Send instructions via WhatsApp</button><button type='button' onClick={()=>processDepositRequest(row,'approved')} disabled={adminBusy}>Verify & approve</button><button type='button' className='danger' onClick={()=>processDepositRequest(row,'rejected')} disabled={adminBusy}>Reject</button></div><small className='admin-muted'>WhatsApp opens a private chat to the customer's submitted number. Check the message before sending. This does not verify payment or credit the wallet.</small></div>}</article>)}{!adminRows.Deposits?.length&&<p className='admin-muted'>No deposit requests found.</p>}</>}{adminTab==='Withdrawals'&&<><h2>Withdrawal Requests ({adminRows.Withdrawals?.length||0})</h2><p className='admin-muted'>Manual payout workflow: send the requested amount from your personal MTN MoMo wallet. MTN, Telecel Cash and AirtelTigo recipients are supported when your MoMo transfer service allows the selected network. Verify the recipient name and number, confirm the transfer succeeded, then mark it paid and enter its transaction reference. Never mark a pending or failed transfer as paid. Rejected requests automatically return the reserved amount to the customer's wallet.</p>{adminRows.WithdrawalsError?.length>0&&<div className='admin-alert'>{adminRows.WithdrawalsError[0].error}</div>}{(adminRows.Withdrawals||[]).map((row:any,i:number)=>{const status=String(row.status||'pending').toLowerCase();return <article className='admin-row' key={row.id||i}><div><b>{money(Number(row.amount||0))} · {row.provider||row.payment_method||'Mobile Money'}</b><small>{row.account_name||row.user_name||row.user_email||row.user_id||'Customer'}</small><small>MoMo: {row.phone||row.phone_number||row.account_number||'Not supplied'}</small><small>Request: {row.created_at?new Date(row.created_at).toLocaleString():'—'} · {status.toUpperCase()}</small></div>{status==='pending'&&<div className='admin-actions'><button type='button' onClick={()=>processWithdrawalRequest(row,'paid')} disabled={adminBusy}>Mark paid</button><button type='button' className='danger' onClick={()=>processWithdrawalRequest(row,'rejected')} disabled={adminBusy}>Reject & refund</button></div>}</article>})}{!adminRows.Withdrawals?.length&&<p className='admin-muted'>No withdrawal requests found.</p>}</>}{['Users','Bets','Transactions'].includes(adminTab)&&<><h2>{adminTab} ({adminRows[adminTab]?.length||0})</h2>{adminRows[adminTab+'Error']?.length>0&&<div className='admin-alert'>{adminRows[adminTab+'Error'][0].error}</div>}{(adminRows[adminTab]||[]).map((row,i)=><details className='admin-data-row' key={row.id||i}><summary>{row.email||row.full_name||row.type||row.status||row.id||('Record '+(i+1))}</summary><pre>{JSON.stringify(row,null,2)}</pre></details>)}</>}{adminTab==='Wallet'&&<div className='admin-form'><h2>Customer Wallet & Bonus</h2><p className='admin-muted'>Find a customer by name, email or phone. Their account ID is selected securely in the background; you do not need to copy a UUID.</p><input aria-label='Search customers' placeholder='Search customer name, email or phone' value={walletUserSearch} onChange={e=>{setWalletUserSearch(e.target.value);setUserAction(old=>({...old,user_id:''}));}}/><div style={{display:'grid',gap:7,maxHeight:230,overflowY:'auto'}}>{(adminRows.Users||[]).filter((row:any)=>{const q=walletUserSearch.trim().toLowerCase();return q && [row.full_name,row.name,row.email,row.phone,row.mobile,row.phone_number].some(value=>String(value||'').toLowerCase().includes(q));}).slice(0,10).map((row:any,i:number)=>{const id=String(row.user_id||row.id||row.uid||row.auth_user_id||'');const label=String(row.full_name||row.name||row.email||row.phone||'Customer');return <button type='button' key={id||i} disabled={!id} onClick={()=>setUserAction(old=>({...old,user_id:id}))} style={{textAlign:'left',padding:10,border:'1px solid #d9dde4',borderRadius:6,background:userAction.user_id===id?'#e8f6ed':'#fff',color:'#252a33'}}><b>{label}</b><small style={{display:'block',marginTop:3,color:'#667085'}}>{row.email||''}{row.phone?' · '+row.phone:''}</small></button>;})}{walletUserSearch.trim() && !(adminRows.Users||[]).some((row:any)=>[row.full_name,row.name,row.email,row.phone,row.mobile,row.phone_number].some(value=>String(value||'').toLowerCase().includes(walletUserSearch.trim().toLowerCase())))&&<p className='admin-muted'>No matching customers found. Refresh the Users list and try another search.</p>}</div>{userAction.user_id&&<p className='admin-muted'>Selected customer account: {String((adminRows.Users||[]).find((row:any)=>String(row.user_id||row.id||row.uid||row.auth_user_id||'')===userAction.user_id)?.full_name||(adminRows.Users||[]).find((row:any)=>String(row.user_id||row.id||row.uid||row.auth_user_id||'')===userAction.user_id)?.email||'Customer selected')}</p>}<input required type='number' min='0.01' step='0.01' placeholder='Amount (GHS)' value={userAction.amount} onChange={e=>setUserAction({...userAction,amount:e.target.value})}/><input placeholder='Reason / bonus description' value={userAction.description} onChange={e=>setUserAction({...userAction,description:e.target.value})}/><div className='admin-actions'><button type='button' onClick={()=>walletAdminAction('credit')} disabled={adminBusy||!userAction.user_id}>Credit wallet</button><button type='button' onClick={()=>walletAdminAction('bonus')} disabled={adminBusy||!userAction.user_id}>Give Bonus</button><button type='button' className='danger' onClick={()=>walletAdminAction('debit')} disabled={adminBusy||!userAction.user_id}>Debit wallet</button></div><p className='admin-muted'>Credits, bonuses and debits use the existing protected admin wallet RPCs. A bonus is recorded as a wallet credit with a “Bonus:” description; it is not a deposit approval.</p></div>}</>}</section>}
    <aside className='desktop-slip'><div className='slip-head'><b>BET SLIP</b><span>{slip.length}</span><button onClick={()=>setSlip([])}>Clear</button></div>{slip.length? <>{slip.map((p,i)=><div className='slip-pick' key={p.match.id}><button onClick={()=>setSlip(old=>old.filter((_,j)=>j!==i))}>×</button><b>{p.match.home} v {p.match.away}</b><span>{p.selection}<strong>{p.odd.toFixed(2)}</strong></span></div>)}<label>Stake (GHS)<input type='number' min='1' value={stake} onChange={e=>setStake(e.target.value)}/></label><p>Total odds <b>{totalOdds.toFixed(2)}</b></p><p>Potential return <b>{money(Number(stake||0)*totalOdds)}</b></p><button type='button' onClick={createSlipBookingCode} disabled={codeBusy||!session||!slip.length||Number(stake)<=0}>{codeBusy?'GENERATING CODE…':'GENERATE BOOKING CODE'}</button>{betError&&<p role='alert' style={{color:'#bd1028'}}>{betError}</p>}<button className='red-action' onClick={placeBet} disabled={betBusy||!session||!slip.length||Number(stake)<=0}>{betBusy?'PLACING BET…':'PLACE BET'}</button></>:<div className='slip-empty'>Your bet slip is empty.<br/>Select odds to add a pick.</div>}<small>18+ Play responsibly</small></aside>
    <nav className='bottom-nav'>{[['⌂','Home','home'],['☰','Menu','more'],['🎮','Games','games'],['⇄','My Bets','bets'],['●','Me','profile']].map(([icon,label,target])=><button key={label} className={page===target?'active':''} onClick={()=>target==='more'?setShowMore(!showMore):nav(target)}><span>{icon}</span><b>{label}</b></button>)}</nav>
    <button className='floating-slip' aria-label='Open bet slip and booking codes' onClick={()=>setShowSlip(true)}><ClipboardList/><i>{slip.length}</i></button>
    {showSlip&&<div className='sheet-backdrop' onClick={()=>setShowSlip(false)}><div className='slip-sheet' onClick={e=>e.stopPropagation()}><header><b>Bet Slip ({slip.length})</b><button onClick={()=>setShowSlip(false)}><X/></button></header><section className='booking-load'><h3>Load booking code</h3><div><input value={bookingCode} onChange={e=>setBookingCode(e.target.value.toUpperCase())} placeholder='Enter booking code'/><button disabled={!bookingCode.trim()||codeBusy} onClick={loadBookingCode}>{codeBusy?'Loading…':'Load'}</button></div></section>{slip.length? <>{slip.map((p,i)=><article className='slip-pick' key={`${p.match.id}-${i}`}><button onClick={()=>setSlip(old=>old.filter((_,j)=>j!==i))}>×</button><b>{p.match.home} v {p.match.away}</b><span>{p.selection}<strong>{p.odd.toFixed(2)}</strong></span></article>)}<label style={{display:'block',marginTop:14}}>Stake (GHS)<input type='number' min='1' step='0.01' value={stake} onChange={e=>setStake(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:6}}/></label><p>Total odds <b>{totalOdds.toFixed(2)}</b></p><p>Potential return <b>{money(Math.max(0,Number(stake)||0)*totalOdds)}</b></p><p>Wallet balance <b>{walletBalance===null?'—':money(walletBalance)}</b></p><button type='button' onClick={createSlipBookingCode} disabled={codeBusy||!session||!slip.length||Number(stake)<=0} style={{width:'100%',marginBottom:10,padding:12}}>{codeBusy?'GENERATING CODE…':'GENERATE BOOKING CODE'}</button>{betError&&<p role='alert' style={{color:'#bd1028'}}>{betError}</p>}<button className='red-action' onClick={placeBet} disabled={betBusy||!session||!slip.length||Number(stake)<=0}>{betBusy?'PLACING BET…':session?'PLACE BET':'SIGN IN TO PLACE BET'}</button></>:<p>Your bet slip is empty. Select available match odds or load a booking code.</p>}<small>18+ · Bets are not submitted from this preview. Do not deposit until wallet betting is enabled.</small></div></div>}
    {showBookingTicket&&<div className='sheet-backdrop booking-ticket-backdrop' onClick={()=>setShowBookingTicket(false)}>
      <section className='generated-booking-ticket' role='dialog' aria-modal='true' aria-label='Generated booking ticket' onClick={e=>e.stopPropagation()}>
        <header><div><small>CLASSIC SPORTY HACKS　 🇬🇭 GHANA</small><b>Betslip</b><time>{new Date().toLocaleString('en-GB')}</time></div><button type='button' onClick={()=>setShowBookingTicket(false)} aria-label='Close ticket'><X/></button></header>
        <div className='generated-ticket-code'><small>Booking Code</small><strong>{bookingCode}</strong></div>
        <div className='ticket-total-odds'><span>Odds</span><b>{totalOdds.toFixed(2)}</b></div>
        <div className='generated-ticket-paper'>
          <div className='ticket-paper-band'>Example Bet</div>
          <div className='ticket-stake-payout'><span>Stake <b>{money(Number(stake)||0)}</b></span><span>Payout <b>{money((Number(stake)||0)*totalOdds)}</b></span></div>
          <div className='ticket-paper-band'>Selections</div>
          <div className='generated-ticket-legs'>{slip.map((pick,index)=><article key={pick.match.id+'-'+index}>
            <div className='ticket-selection-main'><span className='ticket-sport-mark'>⚽</span><div><b>{pick.selection==='1'?'Home':pick.selection.toUpperCase()==='X'?'Draw':pick.selection==='2'?'Away':pick.selection}</b><strong>{pick.odd.toFixed(2)}</strong></div></div>
            <p>{pick.match.home} vs {pick.match.away}</p><small>{pick.market}</small>
          </article>)}</div>
        </div>
        <p className='generated-ticket-note'>Booking-code preview only. This does not place a bet or guarantee a payout.</p>
        <footer><button type='button' onClick={async()=>{const text='CLASSIC SPORTY HACKS\nBooking Code: '+bookingCode+'\nOdds: '+totalOdds.toFixed(2)+'\nStake: '+money(Number(stake)||0)+'\nPayout: '+money((Number(stake)||0)*totalOdds);try{if(navigator.share) await navigator.share({title:'Classic Sporty Hacks Betslip',text});else {await navigator.clipboard.writeText(text);tell('Ticket details copied.');}}catch{tell('Sharing was cancelled.');}}}>SHARE TICKET</button><button type='button' className='ticket-done' onClick={()=>setShowBookingTicket(false)}>DONE</button></footer>
      </section>
    </div>}
    {showAuth&&<div className='sheet-backdrop' onClick={()=>setShowAuth(false)}><form className='slip-sheet' onSubmit={submitAuth} onClick={e=>e.stopPropagation()}><header><b>{authMode==='login'?'Sign in':'Create account'}</b><button type='button' onClick={()=>setShowAuth(false)}><X/></button></header>{authMode==='register'&&<label style={{display:'block',marginTop:14}}>Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:6}}/></label>}<label style={{display:'block',marginTop:14}}>Email<input type='email' required autoComplete='email' value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:6}}/></label><label style={{display:'block',marginTop:14}}>Password<input type='password' required minLength={6} autoComplete={authMode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:6}}/></label>{authError&&<p role='alert' style={{color:'#bd1028'}}>{authError}</p>}<button className='red-action' type='submit' disabled={authBusy} style={{width:'100%',marginTop:14}}>{authBusy?'Please wait…':authMode==='login'?'SIGN IN':'CREATE ACCOUNT'}</button><p style={{textAlign:'center'}}> {authMode==='login'?'New here?':'Already registered?'} <button type='button' onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setAuthError('');}} style={{border:0,background:'none',color:'#d10d2a',fontWeight:800}}>{authMode==='login'?'Create account':'Sign in'}</button></p><small style={{display:'block',textAlign:'center',color:'#888'}}>18+ only. Real-money betting is not enabled.</small></form></div>}
    {winnerPopup&&<div className='winner-overlay' role='dialog' aria-modal='true' aria-label='Winning ticket celebration'><button className='winner-close' type='button' onClick={()=>setWinnerPopup(null)} aria-label='Close winning popup'>×</button><div className='winner-content'><div className='winner-eyebrow'>CLASSIC SPORTY HACKS</div><h2>YOU WON</h2><strong className='winner-amount'>{money(Number(winnerPopup.potential_win||0))}</strong><div className='winner-trophy' aria-hidden='true'>🏆</div><p>Your ticket has been settled as a winner.</p><div className='winner-actions'><button type='button' onClick={async()=>{const message='I won '+money(Number(winnerPopup.potential_win||0))+' on Classic Sporty Hacks!';try{if(navigator.share) await navigator.share({title:'Winning ticket',text:message});else {await navigator.clipboard.writeText(message);tell('Winning message copied.');}}catch{tell('Sharing was cancelled.');}}}>Show Off</button><button type='button' onClick={()=>setWinnerPopup(null)}>Next Round</button></div></div></div>}
    {notice&&<div className='toast-message'>{notice}</div>}
    {authLoading&&<div style={{position:'fixed',top:76,right:12,zIndex:30,background:'#222',color:'#fff',padding:'6px 10px',borderRadius:4,fontSize:11}}>Checking account…</div>}
    <footer className='sports-footer'>CLASSIC SPORTY HACKS <span>SUPABASE CONNECTED · 18+</span></footer>
  </div>;
}

