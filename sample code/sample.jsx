import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { fetchPaidBusinesses, searchBusinesses } from '../databaseFunctions/businessQueries'
import { verifyAllVerificationFields, hashVerificationField } from '../controllers/hashUtils'
import { extractBINValue, extractORNumberValue, extractEPermitValue } from '../controllers/formattedInputs'
import SearchBar from './SearchBar'
import UserDashboard from './UserDashboard'
import Notification from './Notification'
import BusinessDetailsModal from './BusinessDetailsModal'
import Header from './Header'
import Footer from './Footer'
import BusinessList from './BusinessList'
import AuthModal from './AuthModal'
import AdminDashboard from './AdminDashboard'
import MaintenanceMode from './MaintenanceMode'
import ChangePasswordModal from './ChangePasswordModal'
import { getLockoutState, recordFailedAttempt, clearFailedAttempts, formatRemainingTime } from '../controllers/lockoutManager'

function App() {
  // Maintenance mode state
  const [maintenanceMode, setMaintenanceMode] = useState(import.meta.env.VITE_MAINTENANCE_MODE === 'true')

  // Show maintenance screen if enabled
  if (maintenanceMode) {
    return (
      <MaintenanceMode
        title="Scheduled Maintenance"
        message="We are currently updating our database to serve you better."
        estimatedTime="30 minutes"
        contactEmail="support@example.com"
      />
    )
  }

  // Pagination state
  const [pages, setPages] = useState([])
  const [pageIndex, setPageIndex] = useState(0)
  const [nextCursorPk, setNextCursorPk] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  // Auth state
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [userBusinesses, setUserBusinesses] = useState([])
  const [showDashboard, setShowDashboard] = useState(false)

  // UI state
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)

  // Auto-dismiss notifications after a short delay
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)

  // Guard to avoid duplicate auth subscriptions in React 18 Strict Mode
  const subscribedRef = useRef(false);

  const pageSize = 30

  // Finish staged metadata after login
  async function postLoginSetup() {
    const { data: userRes, error: getUserErr } = await supabase.auth.getUser();
    if (getUserErr) { console.error("[postLoginSetup] getUserErr:", getUserErr); return; }
    const u = userRes?.user;
    if (!u) return;

    const meta = u.user_metadata || {};
    const firstName = meta.first_name ?? null;
    const lastName  = meta.last_name  ?? null;
    const pending   = Array.isArray(meta.pending_business_pks) ? meta.pending_business_pks : [];

    if (firstName || lastName) {
      const { error: profileErr } = await supabase
        .from("users_profile")
        .upsert({ id: u.id, first_name: firstName, last_name: lastName }, { onConflict: "id" });
      if (profileErr) console.error("[postLoginSetup] profile upsert error:", profileErr);
    }

    if (pending.length) {
      const rows = pending.map(pk => ({ user_id: u.id, business_pk: pk }));
      const { error: linkErr } = await supabase.from("user_business_links").insert(rows);
      if (linkErr) console.error("[postLoginSetup] link insert error:", linkErr);

      const { error: clearErr } = await supabase.auth.updateUser({ data: { pending_business_pks: null } });
      if (clearErr) console.error("[postLoginSetup] clear metadata error:", clearErr);
    }
  }

  // Load profile + linked businesses after login
  async function loadUserData(currentUser) {
    try {
      const { data: prof, error: profErr } = await supabase
        .from("users_profile")
        .select("id, first_name, last_name, is_admin, created_at")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (profErr) console.error("[Auth] load profile error:", profErr);
      setUserProfile(prof || null);
      // Note: Do not auto-force Admin Dashboard here to avoid overriding user navigation

      const { data: links, error: linksErr } = await supabase
        .from("user_business_links")
        .select("business_pk")
        .eq("user_id", currentUser.id);
      if (linksErr) { console.error("[Auth] load links error:", linksErr); setUserBusinesses([]); return; }

      const pks = (links || []).map(l => l.business_pk);
      if (!pks.length) { setUserBusinesses([]); return; }

      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .select("*")
        .in("business_pk", pks);
      if (bizErr) console.error("[Auth] load businesses error:", bizErr);
      setUserBusinesses(biz || []);
    } catch (e) {
      console.error("[Auth] loadUserData exception:", e);
    }
  }
// ===== SAFE SESSION SYNC & CROSS-TAB RESILIENCE (non-blocking) =====
useEffect(() => {
  let isMounted = true;
  let unsub = null;

  // Guards & state for debouncing/throttling
  const inFlightRef = { current: false };
  const needsRefreshRef = { current: false };
  const lastUserInputRef = { current: 0 };
  const focusTimeoutRef = { current: null };

  // Track recent user input so we don't refresh right on top of a click
  const markUserInput = () => { lastUserInputRef.current = Date.now(); };
  window.addEventListener("pointerdown", markUserInput, { passive: true });
  window.addEventListener("keydown", markUserInput, { passive: true });

  // Helper: is the token near expiry (<= 60s)
  const isNearExpiry = (session) => {
    const exp = session?.expires_at;
    if (!exp) return false;
    const secsLeft = exp - Math.floor(Date.now() / 1000);
    return secsLeft <= 60;
  };

  // Non-blocking "fire-and-forget" loaders so we don't freeze UI
  const kickOffUserLoads = async (user) => {
    // do not await; let UI remain responsive
    postLoginSetup()?.catch(() => {});
    loadUserData(user)?.catch(() => {});
  };

  const applySession = (session) => {
    setSession(session || null);
    setUser(session?.user || null);
    if (session?.user) {
      kickOffUserLoads(session.user);
    } else {
      setUserProfile(null);
      setUserBusinesses([]);
    }
  };

  const syncSession = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      applySession(data?.session ?? null);
    } catch (e) {
      console.error("[Auth] syncSession error:", e); // remove later after testing
    }
  };

  // Lightweight refresh wrapper with guards
  const safeRefreshAndSync = async ({ force = false } = {}) => {
    if (!isMounted || inFlightRef.current) return;

    // If the user just clicked (within 250ms), back off
    if (Date.now() - lastUserInputRef.current < 250) return;

    try {
      inFlightRef.current = true;

      // Get current session first (cheap)
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;

      // Only refresh if forced, needed from background, or near expiry
      if (force || needsRefreshRef.current || isNearExpiry(s)) {
        const { error } = await supabase.auth.refreshSession();
        if (error) console.warn("[Auth] refreshSession error:", error); // remove later after testing
      }

      await syncSession();
      needsRefreshRef.current = false;
    } catch (e) {
      console.error("[Auth] safeRefreshAndSync error:", e); // remove later after testing
    } finally {
      inFlightRef.current = false;
    }
  };

  // Initial sync on mount (non-blocking loads inside)
  syncSession();

  // Subscribe exactly once to auth state changes
  if (!subscribedRef.current) {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      // Apply immediately for snappy UI; heavy loads are fire-and-forget
      applySession(newSession || null);
    });
    unsub = sub.subscription;
    subscribedRef.current = true;
  }

  // When tab hides, mark that we should refresh on return
  const onHidden = () => { needsRefreshRef.current = true; };

  // On visible/focus, delay a bit so clicks finish, then refresh if needed
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      void safeRefreshAndSync({ force: false });
    }, 150); // small delay avoids racing with click handlers
  };

  const onFocus = () => {
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      void safeRefreshAndSync({ force: false });
    }, 150);
  };

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHidden();
    else onVisible();
  });
  window.addEventListener("focus", onFocus);

  // Cross-tab sync via localStorage auth key
  const PROJECT_REF = (() => {
    try {
      const u = new URL(import.meta.env.VITE_SUPABASE_URL || "");
      return (u.hostname.split(".")[0] || "supabase");
    } catch {
      return "supabase";
    }
  })();
  const AUTH_KEY_PREFIX = `sb-${PROJECT_REF}-auth-token`;

  const handleStorage = (e) => {
    if (typeof e.key === "string" && e.key.startsWith(AUTH_KEY_PREFIX)) {
      // Another tab changed auth; prefer a soft sync (no force)
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = setTimeout(() => {
        void safeRefreshAndSync({ force: false });
      }, 50);
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    isMounted = false;
    unsub?.unsubscribe?.();
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("pointerdown", markUserInput);
    window.removeEventListener("keydown", markUserInput);
  };
}, []);
// ===== END SAFE SESSION SYNC =====

// === Helpers you can keep using elsewhere ===

// Ensure a fresh session before protected writes (non-aggressive)
async function ensureFreshSession() {
  const { data } = await supabase.auth.getSession();
  const sess = data?.session ?? null;
  if (!sess || (sess.expires_at && (sess.expires_at - Math.floor(Date.now() / 1000)) <= 60)) {
    await supabase.auth.refreshSession();
  }
}

// Fast auth resync for immediate UI updates on login/logout
async function resyncAuthState() {
  try {
    const { data } = await supabase.auth.getSession();
    const current = data?.session ?? null;
    setSession(current);
    setUser(current?.user ?? null);
    if (current?.user) {
      postLoginSetup()?.catch(() => {});
      loadUserData(current.user)?.catch(() => {});
    } else {
      setUserProfile(null);
      setUserBusinesses([]);
    }
  } catch (e) {
    console.error("[Auth] resyncAuthState error:", e); // remove later after testing
  }
}

  // Logout handler
  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setNotification({ message: 'Logout failed: ' + error.message, type: 'error' })
        return
      }
      // Immediate UI clear
      setShowDashboard(false)
      setShowAdmin(false)
      setSelectedBusiness(null)
      setAuthOpen(false)
      await resyncAuthState()
      setNotification({ message: 'Logged out successfully', type: 'success' })
    } catch (err) {
      console.error("[Auth] Logout error:", err);
      setNotification({ message: 'An error occurred during logout', type: 'error' })
    }
  }

  // Initial load: first page
  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        setError(null)
        const { data, lastPk, hasMore } = await fetchPaidBusinesses(null, pageSize)
        setPages([data])
        setPageIndex(0)
        setNextCursorPk(lastPk)
        setHasMore(hasMore)
        setBusinesses(data)
      } catch (err) {
        console.error('Error loading first page:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Fetch and append the next page
  const fetchNextPage = async () => {
    if (!hasMore) return
    try {
      setError(null)
      const { data, lastPk, hasMore: more } = await fetchPaidBusinesses(nextCursorPk, pageSize)
      setPages((prev) => [...prev, data])
      setPageIndex((prev) => prev + 1)
      setNextCursorPk(lastPk)
      setHasMore(more)
      setBusinesses(data)
    } catch (err) {
      console.error('Error loading next page:', err)
      setError(err.message)
    }
  }

  const handlePrevious = () => {
    if (pageIndex > 0) {
      setPageIndex((i) => i - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNext = async () => {
    const isAtLastCached = pageIndex === pages.length - 1
    if (isAtLastCached) {
      if (hasMore) {
        await fetchNextPage()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      setPageIndex((i) => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSearch = async (searchTerms, searchType, searchMode = 'inclusive') => {
    const hasContent = typeof searchTerms === 'string'
      ? searchTerms.trim() !== ''
      : Object.values(searchTerms || {}).some((term) => term.trim() !== '')

    if (!hasContent) return

    try {
      setSearching(true)
      setError(null)
      const results = await searchBusinesses(searchTerms, searchType, searchMode)
      setPages([results])
      setPageIndex(0)
      setHasMore(false)
      setNextCursorPk(null)
    } catch (err) {
      console.error('Error searching businesses:', err)
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const currentBusinesses = pages[pageIndex] || []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading businesses...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
          <p className="text-red-600 text-sm">{error}</p>
          <button 
            onClick={async () => {
              try {
                setLoading(true)
                setError(null)
                const { data, lastPk, hasMore } = await fetchPaidBusinesses(null, pageSize)
                setPages([data])
                setPageIndex(0)
                setNextCursorPk(lastPk)
                setHasMore(hasMore)
                setBusinesses(data)
              } catch (err) {
                console.error('Retry failed:', err)
                setError(err.message)
              } finally {
                setLoading(false)
              }
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Admin detection
  const isAdmin = Boolean(user?.user_metadata?.role === 'admin' || userProfile?.is_admin)

  // Show admin dashboard if requested
  if (showAdmin && user && isAdmin) {
    return (
      <AdminDashboard
        user={user}
        userProfile={userProfile}
        businesses={businesses}
        onLogout={handleLogout}
        onBackToDirectory={() => setShowAdmin(false)}
      />
    )
  }

  // Show user dashboard if requested
  if (showDashboard && user) {
    return (
      <UserDashboard
        user={user}
        userProfile={userProfile}
        userBusinesses={userBusinesses}
        onLogout={handleLogout}
        onBrowseDirectory={() => {
          setShowDashboard(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        user={user}
        userProfile={userProfile}
        onNavigateDashboard={() => {
          if (isAdmin) { setShowAdmin(true); setShowDashboard(false) }
          else { setShowDashboard(true) }
        }}
        onLogout={handleLogout}
        onLoginClick={() => { setAuthMode('login'); setAuthOpen(true) }}
        onRegisterClick={() => { setAuthMode('register'); setAuthOpen(true) }}
        isAdmin={isAdmin}
        onChangePassword={() => setChangePwOpen(true)}
      />

      <SearchBar 
        businesses={businesses} 
        onFiltersChange={() => { }}
        onSearch={handleSearch}
        isSearching={searching}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <BusinessList
          businesses={currentBusinesses}
          pageIndex={pageIndex}
          pageCount={hasMore}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onViewDetails={(business) => {
            setSelectedBusiness(business)
            setShowDetailsModal(true)
          }}
          loading={false}
        />
      </main>

      <Footer />

      {/* Auth Modal */}
      <AuthModal
        mode={authMode}
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onNotification={setNotification}
        onSubmit={async (mode, payload) => {
          if (mode === "register") {
            // Use the values exactly as provided by the user (no normalization)
            // The plaintext in the database is hashed as-is (including dashes)
            const normDash = (s = '') => String(s).trim().replace(/[\u2010-\u2015\u2212]/g, '-');
            const links = (payload.businesses || []).map(x => ({
              bin:        normDash(x.bin),
              eor_no:     normDash(x.eor_no ?? x.orNumber),
              epermit_no: normDash(x.epermit_no ?? x.permitNumber),
            }));

            if (!links.length) {
              setNotification({ message: "At least one business must be linked to create an account", type: 'error' })
              return
            }

            const businessesToLink = []

            for (const b of links) {
              if (!b.bin || !b.eor_no || !b.epermit_no) {
                setNotification({ message: "Please fill BIN, OR Number, and E-permit completely.", type: 'error' })
                return
              }

              // Normalize to ASCII hyphen for consistent hashing
              const norm = (s='') => String(s).trim().replace(/[\u2010-\u2015\u2212]/g, '-')
              const binRaw = norm(b.bin)
              const eorRaw = norm(b.eor_no)
              const epermitRaw = norm(b.epermit_no)

              // Compute hashes on the client to match DB-stored hashes
              const binHash = await hashVerificationField(binRaw)
              const eorHash = await hashVerificationField(eorRaw)
              const epermitHash = await hashVerificationField(epermitRaw)

              // Query by hashed values OR plaintext (in case some rows weren't converted)
              const { data: biz, error: findError } = await supabase
                .from("businesses")
                .select("business_pk, bin, eor_no, epermit_no")
                .in("bin", [binHash, binRaw])
                .in("eor_no", [eorHash, eorRaw])
                .in("epermit_no", [epermitHash, epermitRaw])
                .maybeSingle()

              if (findError) {
                setNotification({ message: "There was a problem validating the business. Please try again.", type: 'error' })
                return
              }
              if (!biz) {
                setNotification({ message: "Invalid business credentials. Please check BIN, OR No, and E-permit.", type: 'error' })
                return
              }

              const { data: existingLink, error: linkCheckErr } = await supabase
                .from("user_business_links")
                .select("id")
                .eq("business_pk", biz.business_pk)
                .maybeSingle()
              if (linkCheckErr) {
                setNotification({ message: "Could not check link state. Please try again.", type: 'error' })
                return
              }
              if (existingLink) {
                setNotification({ message: "This business is already linked to another account.", type: 'error' })
                return
              }

              businessesToLink.push(biz)
            }

            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: payload.email,
              password: payload.password,
              options: {
                emailRedirectTo: window.location.origin,
                data: {
                  first_name: payload.firstName,
                  last_name: payload.lastName,
                  pending_business_pks: businessesToLink.map(b => b.business_pk)
                }
              }
            })

            if (authError) {
              setNotification({ message: "Error signing up: " + authError.message, type: 'error' })
              return
            }

            let session = authData?.session
            if (!session) {
              setNotification({ message: "Please check your email to verify your account before logging in.", type: 'info' })
              return
            }

            setNotification({ message: "Registration successful!", type: 'success' })
            setAuthOpen(false)
            return
          }

          if (mode === "login") {
            const emailKey = String(payload.email || '').trim().toLowerCase()

            // Enforce lockout prior to attempting login
            const state = getLockoutState(emailKey)
            if (state.isLocked) {
              setNotification({ message: `Too many failed attempts. Try again in ${formatRemainingTime(state.remainingTime)}.`, type: 'error' })
              return
            }

            const { error: loginError } = await supabase.auth.signInWithPassword({
              email: payload.email,
              password: payload.password,
            });
            if (loginError) {
              const res = recordFailedAttempt(emailKey)
              if (res.isNowLocked) {
                setNotification({ message: `Too many failed attempts. Account locked for 30 minutes.`, type: 'error' })
              } else {
                const attemptsLeft = Math.max(0, 5 - (res.attempts || 0))
                setNotification({ message: `Login failed. Attempts remaining: ${attemptsLeft}.`, type: 'error' })
              }
              return
            }

            // Successful login: clear failed attempts
            clearFailedAttempts(emailKey)

            await postLoginSetup();

            // Determine if admin and redirect accordingly
            let adminFlag = false
            try {
              const { data: userRes } = await supabase.auth.getUser()
              const uid = userRes?.user?.id
              if (userRes?.user?.user_metadata?.role === 'admin') adminFlag = true
              if (!adminFlag && uid) {
                const { data: prof } = await supabase
                  .from('users_profile')
                  .select('is_admin')
                  .eq('id', uid)
                  .maybeSingle()
                adminFlag = Boolean(prof?.is_admin)
              }
            } catch (e) { /* ignore */ }

            await resyncAuthState()
            setNotification({ message: "Login successful!", type: 'success' })
            setAuthOpen(false)

            if (adminFlag) {
              setShowAdmin(true)
              setShowDashboard(false)
            } else {
              setShowDashboard(true)
            }
          }
        }}
      />

      {/* Business Details Modal */}
      <BusinessDetailsModal
        business={selectedBusiness}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setSelectedBusiness(null)
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={changePwOpen} onClose={() => setChangePwOpen(false)} />

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      </div>
  )
}

export default App
