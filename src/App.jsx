import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const money = (value) =>
  `GHS ${Number(value || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dateFormat = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [matches, setMatches] = useState([]);
  const [bets, setBets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [slip, setSlip] = useState([]);
  const [stake, setStake] = useState("");

  const [page, setPage] = useState("home");
  const [authMode, setAuthMode] = useState("login");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("MTN Mobile Money");
  const [depositReference, setDepositReference] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("MTN Mobile Money");
  const [withdrawDestination, setWithdrawDestination] = useState("");

  const isAdmin =
    profile?.role === "admin" && profile?.is_active !== false;

  const combinedOdds = useMemo(
    () => slip.reduce((total, item) => total * Number(item.odd || 1), 1),
    [slip]
  );

  const potentialWin = Number(stake || 0) * combinedOdds;

  function notify(text) {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 4000);
  }

  function fail(text) {
    setError(text);
    setMessage("");
  }

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      if (!data.session) setLoading(false);
    }

    initialise();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);

      if (!nextSession) {
        setProfile(null);
        setWallet(null);
        setMatches([]);
        setBets([]);
        setTransactions([]);
        setSlip([]);
        setPage("home");
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([
        loadProfile(),
        loadWallet(),
        loadMatches(),
        loadUserData(),
      ]);
    } catch (e) {
      fail(e.message || "Unable to load your account.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    const { data, error: rpcError } =
      await supabase.rpc("get_my_profile");

    if (!rpcError) {
      setProfile(Array.isArray(data) ? data[0] || null : data || null);
      return;
    }

    const { data: fallback, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    setProfile(fallback);
  }

  async function loadWallet() {
    const { data, error: rpcError } =
      await supabase.rpc("get_my_wallet");

    if (!rpcError) {
      setWallet(Array.isArray(data) ? data[0] || null : data || null);
      return;
    }

    const { data: fallback, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    setWallet(fallback);
  }

  async function loadMatches() {
    let { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    if (error) {
      const fallback = await supabase
        .from("matches")
        .select("*")
        .order("start_time", { ascending: true });

      if (fallback.error) throw fallback.error;
      data = fallback.data || [];
    }

    if (!data?.length) {
      setMatches([]);
      return;
    }

    const ids = data.map((match) => match.id);

    const { data: odds, error: oddsError } = await supabase
      .from("match_odds")
      .select("*")
      .in("match_id", ids)
      .eq("is_active", true)
      .order("market", { ascending: true });

    if (oddsError) throw oddsError;

    const grouped = {};

    (odds || []).forEach((odd) => {
      if (!grouped[odd.match_id]) grouped[odd.match_id] = [];
      grouped[odd.match_id].push(odd);
    });

    setMatches(
      data.map((match) => ({
        ...match,
        match_odds: grouped[match.id] || [],
      }))
    );
  }

  async function loadUserData() {
    const [betResult, transactionResult] = await Promise.all([
      supabase
        .from("bets")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (betResult.error) throw betResult.error;
    if (transactionResult.error) throw transactionResult.error;

    setBets(betResult.data || []);
    setTransactions(transactionResult.data || []);
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (authMode === "signup") {
        if (!name.trim()) throw new Error("Enter your full name.");

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (error) throw error;

        if (!data.session) {
          notify("Account created. Check your email to confirm your account.");
        } else {
          notify("Account created successfully.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        notify("Welcome back.");
      }
    } catch (e) {
      fail(e.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  function addToSlip(match, odd) {
    const selection = {
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      market: odd.market,
      selection: odd.selection,
      odd: Number(odd.odd),
    };

    setSlip((previous) => [
      ...previous.filter(
        (item) =>
          !(item.matchId === selection.matchId &&
            item.market === selection.market)
      ),
      selection,
    ]);

    notify(`${odd.selection} added to your bet slip.`);
  }

  function removeFromSlip(matchId, market) {
    setSlip((previous) =>
      previous.filter(
        (item) =>
          !(item.matchId === matchId && item.market === market)
      )
    );
  }

  async function placeBet() {
    const amount = Number(stake);

    if (!slip.length) return fail("Select a match outcome first.");
    if (!amount || amount <= 0) return fail("Enter a valid stake.");
    if (amount > Number(wallet?.balance || 0)) {
      return fail("Insufficient wallet balance.");
    }

    setBusy(true);

    try {
      const selections = slip.map((item) => ({
        match_id: item.matchId,
        market: item.market,
        selection: item.selection,
      }));

      const { error } = await supabase.rpc("place_bet", {
        p_stake: amount,
        p_selections: selections,
      });

      if (error) throw error;

      setSlip([]);
      setStake("");
      await Promise.all([loadWallet(), loadUserData()]);
      notify("Your bet has been placed successfully.");
    } catch (e) {
      fail(e.message || "Unable to place your bet.");
    } finally {
      setBusy(false);
    }
  }

  async function requestDeposit(event) {
    event.preventDefault();

    const amount = Number(depositAmount);

    if (!amount || amount <= 0) return fail("Enter a valid amount.");
    if (!depositReference.trim()) {
      return fail("Enter your payment reference.");
    }

    setBusy(true);

    try {
      const { error } = await supabase.rpc("request_deposit", {
        p_amount: amount,
        p_payment_method: depositMethod,
        p_payment_reference: depositReference.trim(),
      });

      if (error) throw error;

      setDepositAmount("");
      setDepositReference("");
      await loadUserData();

      notify("Deposit request submitted for verification.");
    } catch (e) {
      fail(e.message || "Deposit request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestWithdrawal(event) {
    event.preventDefault();

    const amount = Number(withdrawAmount);

    if (!amount || amount <= 0) return fail("Enter a valid amount.");
    if (!withdrawDestination.trim()) {
      return fail("Enter your payment destination.");
    }

    setBusy(true);

    try {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount: amount,
        p_payment_method: withdrawMethod,
        p_destination: withdrawDestination.trim(),
      });

      if (error) throw error;

      setWithdrawAmount("");
      setWithdrawDestination("");

      await Promise.all([loadWallet(), loadUserData()]);
      notify("Withdrawal request submitted.");
    } catch (e) {
      fail(e.message || "Withdrawal request failed.");
    } finally {
      setBusy(false);
    }
  }

  const navigation = [
    ["home", "⌂", "Home"],
    ["virtuals", "🎮", "Virtuals"],
    ["bets", "▤", "My Bets"],
    ["wallet", "◈", "Wallet"],
    ["transactions", "↔", "Transactions"],
    ...(isAdmin ? [["admin", "♛", "Admin"]] : []),
  ];

  if (!session) {
    return (
      <div className="csh-app auth-page">
        <header className="topbar auth-topbar">
          <div className="brand-wrap">
            <div className="brand-mark">CS</div>
            <div>
              <div className="brand-name">CLASSIC SPORTY HACKS</div>
              <div className="brand-sub">SPORTS • FOOTBALL • ODDS</div>
            </div>
          </div>
          <span className="secure-pill">🔒 Secure access</span>
        </header>

        <main className="auth-shell">
          <section className="auth-showcase">
            <span className="eyebrow">WELCOME TO CLASSIC SPORTY HACKS</span>
            <h1>
              The game
              <br />
              <span>starts here.</span>
            </h1>
            <p>
              Your sports dashboard for fixtures, match odds, betting and
              wallet management.
            </p>

            <div className="showcase-stats">
              <div>
                <b>⚽</b>
                <strong>Football</strong>
                <small>Match centre</small>
              </div>
              <div>
                <b>🎟️</b>
                <strong>Bet Slip</strong>
                <small>Build selections</small>
              </div>
              <div>
                <b>💰</b>
                <strong>Wallet</strong>
                <small>Manage funds</small>
              </div>
            </div>
          </section>

          <section className="auth-card">
            <div className="auth-card-head">
              <div className="auth-logo">CS</div>
              <span>CLASSIC SPORTY HACKS</span>
            </div>

            <h2>
              {authMode === "login" ? "Welcome back" : "Create account"}
            </h2>

            <p>
              {authMode === "login"
                ? "Login to access your sports dashboard."
                : "Create your account to get started."}
            </p>

            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={authMode === "signup" ? "active" : ""}
                onClick={() => setAuthMode("signup")}
              >
                Sign Up
              </button>
            </div>

            {error && <div className="alert error-alert">{error}</div>}
            {message && <div className="alert success-alert">{message}</div>}

            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === "signup" && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </label>

              <button className="main-btn auth-submit" disabled={busy}>
                {busy
                  ? "Please wait..."
                  : authMode === "login"
                    ? "LOGIN →"
                    : "CREATE ACCOUNT →"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-orb">CS</div>
        <h2>CLASSIC SPORTY HACKS</h2>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="csh-app">
      <header className="topbar">
        <div
          className="brand-wrap"
          onClick={() => setPage("home")}
          role="button"
          tabIndex={0}
        >
          <div className="brand-mark">CS</div>
          <div>
            <div className="brand-name">CLASSIC SPORTY HACKS</div>
            <div className="brand-sub">SPORTS MATCH CENTRE</div>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="balance-chip"
            onClick={() => setPage("wallet")}
          >
            <span>Wallet balance</span>
            <b>{money(wallet?.balance)}</b>
          </button>

          <button
            className="deposit-top"
            onClick={() => setPage("wallet")}
          >
            + Deposit
          </button>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="main-nav">
        <div className="nav-inner">
          {navigation.map(([key, icon, label]) => (
            <button
              key={key}
              className={`nav-item ${page === key ? "active" : ""}`}
              onClick={() => setPage(key)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="dashboard-shell">
        {message && (
          <div className="alert success-alert floating-alert">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="alert error-alert floating-alert">
            ! {error}
          </div>
        )}

        {page === "home" && (
          <>
            <section className="dashboard-hero">
              <div className="hero-copy">
                <span className="eyebrow">CLASSIC SPORTY HACKS</span>
                <h1>
                  FOLLOW THE GAME.
                  <br />
                  <span>MAKE YOUR MOVE.</span>
                </h1>
                <p>
                  Explore available fixtures, compare odds and build your
                  bet slip.
                </p>
                <div className="hero-actions">
                  <button
                    className="main-btn"
                    onClick={() =>
                      document
                        .getElementById("matches-section")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    EXPLORE MATCHES →
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() => setPage("wallet")}
                  >
                    MY WALLET
                  </button>
                </div>
              </div>

              <div className="hero-ball">⚽</div>

              <div className="hero-balance">
                <small>AVAILABLE BALANCE</small>
                <strong>{money(wallet?.balance)}</strong>
                <button onClick={() => setPage("wallet")}>
                  Manage wallet →
                </button>
              </div>
            </section>

            <section className="quick-grid">
              <button onClick={() => setPage("wallet")}>
                <span className="quick-icon green">＋</span>
                <div>
                  <b>Deposit Funds</b>
                  <small>Add money to your wallet</small>
                </div>
                <span>›</span>
              </button>

              <button onClick={() => setPage("bets")}>
                <span className="quick-icon purple">▤</span>
                <div>
                  <b>My Bets</b>
                  <small>{bets.length} recorded bets</small>
                </div>
                <span>›</span>
              </button>

              <button onClick={() => setPage("transactions")}>
                <span className="quick-icon blue">↔</span>
                <div>
                  <b>Transactions</b>
                  <small>Wallet history</small>
                </div>
                <span>›</span>
              </button>

              <button onClick={() => setPage("virtuals")}>
                <span className="quick-icon orange">🎮</span>
                <div>
                  <b>Virtual Games</b>
                  <small>Explore game zone</small>
                </div>
                <span>›</span>
              </button>
            </section>

            <div className="content-heading" id="matches-section">
              <div>
                <span className="eyebrow">SPORTS</span>
                <h2>Available Matches</h2>
              </div>
              <button className="outline-btn" onClick={loadMatches}>
                ↻ Refresh
              </button>
            </div>

            <div className="main-columns">
              <section className="matches-column">
                <div className="match-filter">
                  <span className="filter-active">⚽ Football</span>
                  <span>🔥 Popular</span>
                  <span>⭐ Featured</span>
                </div>

                {matches.length === 0 ? (
                  <div className="empty-card">
                    <div>⚽</div>
                    <h3>No active matches available</h3>
                    <p>
                      Fixtures will appear here when they are added to the
                      database.
                    </p>
                  </div>
                ) : (
                  matches.map((match) => {
                    const groups = {};

                    (match.match_odds || []).forEach((odd) => {
                      const market = odd.market || "Other";
                      if (!groups[market]) groups[market] = [];
                      groups[market].push(odd);
                    });

                    return (
                      <article className="match-card" key={match.id}>
                        <div className="match-card-top">
                          <span className="league-pill">⚽ FOOTBALL</span>
                          <span>{dateFormat(match.start_time)}</span>
                          <span className="status-dot">
                            ● {match.status || "Scheduled"}
                          </span>
                        </div>

                        <div className="match-teams">
                          <div className="team">
                            <div className="team-badge">
                              {(match.home_team || "H").charAt(0)}
                            </div>
                            <strong>{match.home_team}</strong>
                          </div>

                          <div className="versus">
                            <small>MATCH</small>
                            <b>VS</b>
                          </div>

                          <div className="team">
                            <div className="team-badge away">
                              {(match.away_team || "A").charAt(0)}
                            </div>
                            <strong>{match.away_team}</strong>
                          </div>
                        </div>

                        <div className="market-area">
                          {Object.keys(groups).length === 0 ? (
                            <div className="no-odds">
                              Odds not available.
                            </div>
                          ) : (
                            Object.entries(groups).map(([market, odds]) => (
                              <div className="market-block" key={market}>
                                <div className="market-heading">
                                  <b>{market}</b>
                                  <span>Select an outcome</span>
                                </div>

                                <div className="odds-row">
                                  {odds.map((odd) => (
                                    <button
                                      className="odd-card"
                                      key={odd.id}
                                      onClick={() => addToSlip(match, odd)}
                                    >
                                      <span>{odd.selection}</span>
                                      <strong>
                                        {Number(odd.odd).toFixed(2)}
                                      </strong>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </section>

              <aside className="bet-slip">
                <div className="slip-head">
                  <div>
                    <span className="eyebrow">YOUR SELECTIONS</span>
                    <h3>Bet Slip</h3>
                  </div>
                  <span className="slip-count">{slip.length}</span>
                </div>

                {slip.length === 0 ? (
                  <div className="slip-empty">
                    <div>🎟️</div>
                    <h4>Your bet slip is empty</h4>
                    <p>Select an odd to add it to your bet slip.</p>
                  </div>
                ) : (
                  <>
                    <div className="slip-list">
                      {slip.map((item) => (
                        <div
                          className="slip-selection"
                          key={`${item.matchId}-${item.market}`}
                        >
                          <div>
                            <b>
                              {item.homeTeam} vs {item.awayTeam}
                            </b>
                            <small>
                              {item.market} • {item.selection}
                            </small>
                            <strong>Odds {item.odd.toFixed(2)}</strong>
                          </div>

                          <button
                            onClick={() =>
                              removeFromSlip(item.matchId, item.market)
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="slip-total">
                      <span>Combined odds</span>
                      <b>{combinedOdds.toFixed(2)}</b>
                    </div>

                    <label className="stake-label">
                      Stake amount (GHS)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                        placeholder="Enter stake"
                      />
                    </label>

                    <div className="win-box">
                      <span>Potential return</span>
                      <strong>{money(potentialWin)}</strong>
                    </div>

                    <button
                      className="main-btn place-btn"
                      onClick={placeBet}
                      disabled={busy}
                    >
                      {busy ? "PROCESSING..." : "PLACE BET →"}
                    </button>
                  </>
                )}
              </aside>
            </div>
          </>
        )}

        {page === "virtuals" && (
          <section className="page-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">GAME ZONE</span>
                <h2>Virtual Games</h2>
              </div>
            </div>

            <div className="virtual-grid">
              {[
                ["⚽", "Virtual Football"],
                ["🏇", "Horse Racing"],
                ["🏀", "Virtual Basketball"],
                ["🎾", "Virtual Tennis"],
                ["🐕", "Greyhound Racing"],
                ["🏎️", "Virtual Racing"],
                ["🏆", "Virtual League"],
                ["🥅", "Virtual Penalty"],
                ["🏁", "Virtual Speedway"],
                ["🎮", "Retro Bowl"],
              ].map(([icon, title]) => (
                <article className="virtual-card" key={title}>
                  <div className="virtual-icon">{icon}</div>
                  <h3>{title}</h3>
                  <p>Explore the virtual games section.</p>
                  <button
                    onClick={() =>
                      notify(
                        "A real virtual-games provider must be connected before this game can process play."
                      )
                    }
                  >
                    Play Now →
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {page === "bets" && (
          <section className="page-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">ACCOUNT</span>
                <h2>My Bets</h2>
              </div>
              <span className="count-badge">{bets.length}</span>
            </div>

            {bets.length === 0 ? (
              <div className="empty-card">
                <h3>No bets yet</h3>
                <p>Your placed bets will appear here.</p>
              </div>
            ) : (
              <div className="data-list">
                {bets.map((bet) => (
                  <article className="data-card" key={bet.id}>
                    <div className="data-head">
                      <div>
                        <span className="mini-label">
                          BET #{String(bet.id).slice(0, 8)}
                        </span>
                        <h3>{money(bet.stake)} stake</h3>
                      </div>
                      <span className="status-badge">
                        {bet.status || "pending"}
                      </span>
                    </div>

                    <div className="stat-grid">
                      <div>
                        <small>Combined odds</small>
                        <b>{Number(bet.combined_odds || 0).toFixed(2)}</b>
                      </div>
                      <div>
                        <small>Potential win</small>
                        <b>{money(bet.potential_win)}</b>
                      </div>
                      <div>
                        <small>Placed</small>
                        <b>{dateFormat(bet.created_at)}</b>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "wallet" && (
          <section className="page-section">
            <div className="wallet-banner">
              <div>
                <span className="eyebrow">MY WALLET</span>
                <p>Available balance</p>
                <h1>{money(wallet?.balance)}</h1>
                <small>GHS wallet</small>
              </div>
              <div className="wallet-symbol">💰</div>
            </div>

            <div className="section-title">
              <div>
                <span className="eyebrow">WALLET MANAGEMENT</span>
                <h2>Deposit & Withdraw</h2>
              </div>
            </div>

            <div className="form-grid">
              <form
                className="form-card deposit-card"
                onSubmit={requestDeposit}
              >
                <div className="form-icon">＋</div>
                <h3>Deposit funds</h3>
                <p>Submit your payment details for verification.</p>

                <label>
                  Amount (GHS)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Payment method
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                  >
                    <option>MTN Mobile Money</option>
                    <option>Telecel Cash</option>
                    <option>AirtelTigo Money</option>
                    <option>Bank Transfer</option>
                  </select>
                </label>

                <label>
                  Payment reference
                  <input
                    value={depositReference}
                    onChange={(e) => setDepositReference(e.target.value)}
                    placeholder="Payment reference"
                  />
                </label>

                <button className="main-btn" disabled={busy}>
                  SUBMIT DEPOSIT →
                </button>
              </form>

              <form
                className="form-card withdraw-card"
                onSubmit={requestWithdrawal}
              >
                <div className="form-icon">↗</div>
                <h3>Withdraw funds</h3>
                <p>Request a withdrawal to your payment account.</p>

                <label>
                  Amount (GHS)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Payment method
                  <select
                    value={withdrawMethod}
                    onChange={(e) => setWithdrawMethod(e.target.value)}
                  >
                    <option>MTN Mobile Money</option>
                    <option>Telecel Cash</option>
                    <option>AirtelTigo Money</option>
                    <option>Bank Transfer</option>
                  </select>
                </label>

                <label>
                  Destination/account
                  <input
                    value={withdrawDestination}
                    onChange={(e) =>
                      setWithdrawDestination(e.target.value)
                    }
                    placeholder="Your payment number or account"
                  />
                </label>

                <button className="main-btn" disabled={busy}>
                  REQUEST WITHDRAWAL →
                </button>
              </form>
            </div>
          </section>
        )}

        {page === "transactions" && (
          <section className="page-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">ACCOUNT HISTORY</span>
                <h2>Transactions</h2>
              </div>
              <span className="count-badge">{transactions.length}</span>
            </div>

            {transactions.length === 0 ? (
              <div className="empty-card">
                <h3>No transactions yet</h3>
                <p>Your wallet activity will appear here.</p>
              </div>
            ) : (
              <div className="transaction-list">
                {transactions.map((tx) => (
                  <article className="transaction-card" key={tx.id}>
                    <div className="transaction-icon">↔</div>
                    <div className="transaction-info">
                      <b>{tx.type || "Transaction"}</b>
                      <span>{tx.description || "Wallet activity"}</span>
                      <small>{dateFormat(tx.created_at)}</small>
                    </div>
                    <strong>{money(tx.amount)}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "admin" && isAdmin && (
          <AdminPanel
            onRefresh={async () => {
              await loadAll();
            }}
          />
        )}
      </main>

      <footer className="site-footer">
        <b>CLASSIC SPORTY HACKS</b>
        <span>SPORTS • FOOTBALL • MATCH CENTRE</span>
      </footer>
    </div>
  );
}

function AdminPanel({ onRefresh }) {
  const [users, setUsers] = useState([]);
  const [adminBets, setAdminBets] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);

  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState("");
  const [result, setResult] = useState("won");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setError("");

    const [u, b, t] = await Promise.all([
      supabase.rpc("admin_get_users"),
      supabase.rpc("admin_get_bets"),
      supabase.rpc("admin_get_transactions"),
    ]);

    if (u.error || b.error || t.error) {
      setError(
        (u.error || b.error || t.error).message ||
          "Admin data could not be loaded."
      );
      return;
    }

    setUsers(u.data || []);
    setAdminBets(b.data || []);
    setAdminTransactions(t.data || []);
  }

  async function adjustWallet(direction) {
    const value = Number(amount);

    if (!userId || !value || value <= 0) {
      setError("Select a user and enter a valid amount.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const functionName =
        direction === "credit"
          ? "admin_credit_wallet"
          : "admin_debit_wallet";

      const { error } = await supabase.rpc(functionName, {
        p_user_id: userId,
        p_amount: value,
        p_description: `Admin ${direction}`,
      });

      if (error) throw error;

      setAmount("");
      setMessage(`Wallet ${direction} successful.`);
      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(e.message || "Wallet adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function settleBet() {
    if (!betId.trim()) {
      setError("Enter the bet ID.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.rpc("admin_settle_bet", {
        p_bet_id: betId.trim(),
        p_result: result,
      });

      if (error) throw error;

      setBetId("");
      setMessage("Bet settlement completed.");
      await loadAdmin();
      await onRefresh();
    } catch (e) {
      setError(e.message || "Bet settlement failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section admin-page">
      <div className="admin-hero">
        <div>
          <span className="eyebrow">CONTROL CENTRE</span>
          <h1>Admin Dashboard</h1>
          <p>Manage users, wallets, bets and transactions.</p>
        </div>
        <button className="outline-btn light" onClick={loadAdmin}>
          ↻ Refresh
        </button>
      </div>

      {error && <div className="alert error-alert">{error}</div>}
      {message && <div className="alert success-alert">{message}</div>}

      <div className="admin-stat-grid">
        <div>
          <span>👥</span>
          <b>{users.length}</b>
          <small>Users</small>
        </div>
        <div>
          <span>🎟️</span>
          <b>{adminBets.length}</b>
          <small>Bets</small>
        </div>
        <div>
          <span>💳</span>
          <b>{adminTransactions.length}</b>
          <small>Transactions</small>
        </div>
        <div>
          <span>⚡</span>
          <b>Live</b>
          <small>Platform status</small>
        </div>
      </div>

      <div className="form-grid admin-tools">
        <div className="form-card">
          <div className="form-icon">💰</div>
          <h3>Wallet adjustment</h3>
          <p>Credit or debit a selected user's wallet.</p>

          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name || user.email || user.id}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="two-buttons">
            <button
              className="main-btn"
              disabled={busy}
              onClick={() => adjustWallet("credit")}
            >
              Credit
            </button>
            <button
              className="outline-btn"
              disabled={busy}
              onClick={() => adjustWallet("debit")}
            >
              Debit
            </button>
          </div>
        </div>

        <div className="form-card">
          <div className="form-icon">🎯</div>
          <h3>Settle bet</h3>
          <p>Settle a bet using its database ID.</p>

          <input
            placeholder="Bet UUID"
            value={betId}
            onChange={(e) => setBetId(e.target.value)}
          />

          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
          >
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="void">Void</option>
          </select>

          <button
            className="main-btn"
            disabled={busy}
            onClick={settleBet}
          >
            SETTLE BET →
          </button>
        </div>
      </div>

      <div className="admin-tables">
        <div className="table-card">
          <div className="table-head">
            <h3>Users</h3>
            <span>{users.length} total</span>
          </div>

          {users.map((user) => (
            <div className="table-row" key={user.id}>
              <div className="user-row">
                <span className="user-avatar">
                  {(user.full_name || user.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <div>
                  <b>{user.full_name || "Unnamed"}</b>
                  <small>{user.email}</small>
                </div>
              </div>
              <span className="role-badge">{user.role}</span>
            </div>
          ))}
        </div>

        <div className="table-card">
          <div className="table-head">
            <h3>Recent bets</h3>
            <span>Latest 20</span>
          </div>

          {adminBets.slice(0, 20).map((bet) => (
            <div className="table-row" key={bet.id}>
              <span>#{String(bet.id).slice(0, 8)}</span>
              <span className="status-badge">{bet.status}</span>
              <b>{money(bet.stake)}</b>
            </div>
          ))}
        </div>

        <div className="table-card">
          <div className="table-head">
            <h3>Recent transactions</h3>
            <span>Latest 20</span>
          </div>

          {adminTransactions.slice(0, 20).map((tx) => (
            <div className="table-row" key={tx.id}>
              <span>{tx.type}</span>
              <b>{money(tx.amount)}</b>
              <small>{dateFormat(tx.created_at)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default App;
