import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, Box, CalendarDays, Check,
  CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Filter, Handshake,
  Leaf, LayoutDashboard, MapPin, Menu, PackageCheck, Plus, Recycle, Search,
  ShieldCheck, Sparkles, Sprout, Tags, Truck, X,
} from 'lucide-react'
import AuthScreen from './AuthScreen'
import type { Condition, Item, Outcome, Transaction } from './lib/types'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { cancelReservation as cancelReservationInDb, confirmHandover as confirmHandoverInDb, createItem as createItemInDb, loadWorkspace, recordReturn as recordReturnInDb, reserveItem as reserveItemInDb } from './lib/workspace'
import { demoCatalogItems } from './lib/demoInventory'
import { itemImageForItem } from './lib/itemImages'
type Page = 'Overview' | 'Inventory' | 'Reservations' | 'Reuse ledger' | 'Impact report'
type Modal = 'add' | 'reserve' | 'return' | null

const day = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}
const ago = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString()

const initialItems: Item[] = demoCatalogItems

const initialTransactions: Transaction[] = [
  { id: 'TX-2408', itemId: 'ITM-104', borrower: 'Art & Design Club', event: 'Spring showcase', startDate: day(-29), dueDate: day(-27), status: 'returned', reservedAt: ago(34), handedOverAt: ago(29), returnedAt: ago(27), returnCondition: 'Good', used: true, outcome: 'new-purchase' },
  { id: 'TX-2389', itemId: 'ITM-104', borrower: 'Robotics Society', event: 'Open lab day', startDate: day(-18), dueDate: day(-16), status: 'returned', reservedAt: ago(23), handedOverAt: ago(18), returnedAt: ago(16), returnCondition: 'Good', used: true, outcome: 'owned' },
  { id: 'TX-2372', itemId: 'ITM-087', borrower: 'Literary Society', event: 'Book week', startDate: day(-13), dueDate: day(-11), status: 'returned', reservedAt: ago(17), handedOverAt: ago(13), returnedAt: ago(11), returnCondition: 'Excellent', used: true, outcome: 'new-purchase' },
  { id: 'TX-2350', itemId: 'ITM-072', borrower: 'Music Society', event: 'Courtyard sessions', startDate: day(-8), dueDate: day(-6), status: 'returned', reservedAt: ago(12), handedOverAt: ago(8), returnedAt: ago(6), returnCondition: 'Good', used: true, outcome: 'borrowed' },
  { id: 'TX-2331', itemId: 'ITM-126', borrower: 'Wellbeing Network', event: 'Mindful Monday', startDate: day(-2), dueDate: day(1), status: 'on-loan', reservedAt: ago(5), handedOverAt: ago(2) },
  { id: 'TX-2320', itemId: 'ITM-093', borrower: 'Film Society', event: 'Outdoor shorts night', startDate: day(3), dueDate: day(4), status: 'reserved', reservedAt: ago(1) },
]

const outcomeLabels: Record<Outcome, string> = {
  'new-purchase': 'Would have bought new',
  borrowed: 'Would have borrowed',
  owned: 'Would have reused own',
  'changed-plan': 'Would have changed plans',
  unsure: 'Not sure',
  'not-answered': 'No response',
}

function readSaved<T,>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return fallback
    const parsed = JSON.parse(value) as T
    if (Array.isArray(parsed) && parsed.length === 0 && Array.isArray(fallback) && fallback.length > 0) return fallback
    return parsed
  } catch (error) {
    console.error(`Could not read saved Loopify data: ${key}.`, error)
    return fallback
  }
}

function readDemoItems() {
  const savedItems = readSaved<Item[]>('loopify-items-v3', initialItems)
    .filter((item) => item.id !== 'ITM-087')
  const refreshedItems = savedItems.map((item) => ({
    ...item,
    imageUrl: itemImageForItem(item.name, item.category),
  }))
  const savedIds = new Set(refreshedItems.map((item) => item.id))
  return [...refreshedItems, ...initialItems.filter((item) => !savedIds.has(item.id))]
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(isSupabaseConfigured)
  const [demoMode, setDemoMode] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const registrationInProgress = useRef(false)

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (registrationInProgress.current) return
      setUser(session?.user ?? null)
      if (session?.user) setDemoMode(false)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Could not restore the Loopify sign-in session.', error)
      setUser(data.session?.user ?? null)
      setCheckingSession(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (checkingSession) return <div className="auth-loading"><span className="brand-mark"><Recycle size={21} /></span><span>Opening your campus workspace…</span></div>
  if (!user && !demoMode) return <AuthScreen
    configured={isSupabaseConfigured}
    initialMode={authMode}
    onDemo={() => setDemoMode(true)}
    onLogin={async (email, password) => {
      if (!supabase) throw new Error('Supabase is not configured. Add the project URL and anon key first.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    }}
    onRegister={async ({ email, password, name, organization }) => {
      if (!supabase) throw new Error('Supabase is not configured. Add the project URL and anon key first.')
      registrationInProgress.current = true
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name, organization },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
          if (signOutError) throw signOutError
        }
        setUser(null)
      } finally {
        registrationInProgress.current = false
      }
    }}
  />
  return <Workspace user={user} demoMode={demoMode} onOpenAuth={(mode) => {
    setDemoMode(false)
    setAuthMode(mode)
  }} onSignOut={async () => {
    if (user && supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    setUser(null)
    setDemoMode(false)
  }} />
}

function Workspace({ user, demoMode, onOpenAuth, onSignOut }: { user: User | null; demoMode: boolean; onOpenAuth: (mode: 'login' | 'register') => void; onSignOut: () => Promise<void> }) {
  const [items, setItems] = useState<Item[]>(() => demoMode ? readDemoItems() : [])
  const [transactions, setTransactions] = useState<Transaction[]>(() => demoMode ? readSaved('loopify-transactions-v1', initialTransactions) : [])
  const [page, setPage] = useState<Page>('Overview')
  const [modal, setModal] = useState<Modal>(null)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All materials')
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState('')
  const [cloudError, setCloudError] = useState('')
  const [loadingData, setLoadingData] = useState(!demoMode)
  const [mobileNav, setMobileNav] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const refreshCloud = async () => {
    const data = await loadWorkspace()
    setItems(data.items)
    setTransactions(data.transactions)
    setCloudError('')
  }

  useEffect(() => {
    if (demoMode) {
      try {
        setItems(readDemoItems())
        setTransactions(readSaved('loopify-transactions-v1', initialTransactions))
        setStorageError('')
      } catch (error) {
        console.error('Could not load Loopify demo data from this browser.', error)
        setStorageError('Saved demo data could not be read. Clear this site’s saved data or continue with a fresh browser.')
        setItems(initialItems)
        setTransactions(initialTransactions)
      }
      setLoadingData(false)
      setCloudError('')
      return
    }

    let cancelled = false
    setLoadingData(true)
    void loadWorkspace().then((data) => {
      if (cancelled) return
      setItems(data.items)
      setTransactions(data.transactions)
      setCloudError('')
    }).catch((error: unknown) => {
      if (cancelled) return
      console.error('Could not load the Loopify campus workspace.', error)
      setCloudError(error instanceof Error ? error.message : 'Could not connect to the campus database. Check your Supabase setup and try again.')
    }).finally(() => {
      if (!cancelled) setLoadingData(false)
    })
    return () => { cancelled = true }
  }, [demoMode, user?.id])

  useEffect(() => {
    if (!demoMode) return
    try {
      window.localStorage.setItem('loopify-items-v3', JSON.stringify(items))
      window.localStorage.setItem('loopify-transactions-v1', JSON.stringify(transactions))
      setStorageError('')
    } catch (error) {
      console.error('Could not save Loopify demo data to this browser.', error)
      setStorageError('Your latest changes could not be saved in this browser. Check available storage and try again.')
    }
  }, [demoMode, items, transactions])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const verified = transactions.filter((transaction) => transaction.status === 'returned' && transaction.used === true)
  const uniqueReused = new Set(verified.map((transaction) => transaction.itemId)).size
  const repeatUses = Math.max(verified.length - uniqueReused, 0)
  const handedOver = transactions.filter((transaction) => Boolean(transaction.handedOverAt))
  const returnedCount = transactions.filter((transaction) => Boolean(transaction.returnedAt)).length
  const returnRate = handedOver.length ? Math.round((returnedCount / handedOver.length) * 100) : 0
  const potentiallyAvoided = transactions.filter((transaction) => transaction.status === 'returned' && transaction.used && transaction.outcome === 'new-purchase').length
  const activeTransactions = transactions.filter((transaction) => ['reserved', 'on-loan'].includes(transaction.status))
  const availableCount = (item: Item) => {
    if (item.condition === 'Needs repair' || item.condition === 'Under review') return 0
    const today = day(0)
    const allocated = activeTransactions.filter((transaction) => transaction.itemId === item.id
      && ((transaction.status === 'on-loan' && transaction.dueDate < today)
        || (transaction.startDate <= today && transaction.dueDate >= today))).length
    return Math.max(item.quantity - allocated, 0)
  }
  const filteredItems = items.filter((item) => {
    const matchesSearch = `${item.name} ${item.category} ${item.description} ${item.location} ${item.owner}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All materials' || item.category === category
    return matchesSearch && matchesCategory
  })
  const recentTransactions = [...transactions].sort((a, b) => b.reservedAt.localeCompare(a.reservedAt)).slice(0, 4)
  const displayName = typeof user?.user_metadata.display_name === 'string'
    ? user.user_metadata.display_name
    : user?.email?.split('@')[0] ?? 'Alex Morgan'
  const organizationName = typeof user?.user_metadata.organization === 'string'
    ? user.user_metadata.organization
    : 'Campus community'
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  const openModal = (type: Modal, item: Item | null = null, transactionId: string | null = null) => {
    setSelectedItem(item)
    setSelectedTransactionId(transactionId)
    setDialogError('')
    setModal(type)
    setNotice('')
  }

  const submitModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setDialogError('')
    if (modal === 'add') {
      const name = String(form.get('name') || '').trim()
      const quantity = Math.max(1, Number(form.get('quantity')) || 1)
      const itemInput = {
        ownerId: user?.id ?? '',
        name,
        category: String(form.get('category')),
        description: String(form.get('description') || 'Reusable campus event material'),
        condition: String(form.get('condition')) as Condition,
        location: String(form.get('location') || 'Campus collection point'),
        owner: String(form.get('owner') || user?.user_metadata.organization || 'Campus community'),
        quantity,
      }
      if (!demoMode) {
        try {
          await createItemInDb(itemInput)
          await refreshCloud()
        } catch (error) {
          console.error('Could not add this Loopify inventory item.', error)
          setDialogError(error instanceof Error ? error.message : 'Could not save this item to the campus database.')
          return
        }
        setPage('Inventory')
        setNotice(`${name} added to the shared campus inventory.`)
        setModal(null)
        return
      }
      const nextItemNumber = Math.max(0, ...items.map((item) => Number(item.id.slice(4)) || 0)) + 1
      const newItem: Item = {
        id: `ITM-${String(nextItemNumber).padStart(3, '0')}`,
        ...itemInput,
        accent: ['mint', 'peach', 'blue', 'lavender'][items.length % 4],
        symbol: '▤',
      }
      setItems((current) => [newItem, ...current])
      setPage('Inventory')
      setNotice(`${name} added to the shared inventory.`)
    }
    if (modal === 'reserve' && selectedItem) {
      const startDate = String(form.get('startDate'))
      const dueDate = String(form.get('dueDate'))
      const conflictingReservations = activeTransactions.filter((transaction) => transaction.itemId === selectedItem.id
        && startDate <= transaction.dueDate && dueDate >= transaction.startDate)
      if (selectedItem.condition === 'Needs repair' || selectedItem.condition === 'Under review'
        || selectedItem.quantity - conflictingReservations.length < 1) {
        setDialogError('This item is no longer available for those dates. Try another date or material.')
        return
      }
      const organization = String(form.get('organization') || user?.user_metadata.organization || 'Campus community')
      const eventName = String(form.get('event') || 'Campus event')
      if (!demoMode) {
        try {
          await reserveItemInDb({
            itemId: selectedItem.id,
            organization,
            event: eventName,
            startDate,
            dueDate,
          })
          await refreshCloud()
        } catch (error) {
          console.error('Could not reserve this Loopify item.', error)
          setDialogError(error instanceof Error ? error.message : 'The reservation could not be saved. Check availability and try again.')
          return
        }
        setPage('Reservations')
        setNotice(`${selectedItem.name} reserved. Confirm handover when the item is collected.`)
        setModal(null)
        return
      }
      const nextTransactionNumber = Math.max(0, ...transactions.map((transaction) => Number(transaction.id.slice(3)) || 0)) + 1
      const transaction: Transaction = {
        id: `TX-${String(nextTransactionNumber).padStart(4, '0')}`,
        itemId: selectedItem.id,
        borrower: organization,
        event: eventName,
        startDate,
        dueDate,
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      }
      setTransactions((current) => [transaction, ...current])
      setPage('Reservations')
      setNotice(`${selectedItem.name} reserved. Confirm handover when the item is collected.`)
    }
    if (modal === 'return' && selectedTransactionId && selectedItem) {
      const condition = String(form.get('condition')) as Condition
      const used = form.get('used') === 'on'
      const outcome = String(form.get('outcome')) as Outcome
      const note = String(form.get('note') || '')
      if (!demoMode) {
        try {
          await recordReturnInDb({ transactionId: selectedTransactionId, condition, used, outcome, note })
          await refreshCloud()
        } catch (error) {
          console.error('Could not record the Loopify item return.', error)
          setDialogError(error instanceof Error ? error.message : 'The return could not be saved. Refresh the workspace and try again.')
          return
        }
        setNotice(condition === 'Good' || condition === 'Excellent'
          ? 'Return recorded and condition checked. The reuse ledger has been updated.'
          : 'Return recorded. The item is unavailable until an authorized manager checks its condition.')
        setPage('Reuse ledger')
        setModal(null)
        return
      }
      setTransactions((current) => current.map((transaction) => transaction.id === selectedTransactionId
        ? {
          ...transaction,
          status: condition === 'Needs repair' || condition === 'Under review' ? 'needs-repair' : 'returned',
          returnedAt: new Date().toISOString(),
          returnCondition: condition,
          used,
          outcome,
          note,
        }
        : transaction))
      const returnedItemId = transactions.find((transaction) => transaction.id === selectedTransactionId)?.itemId
      if (returnedItemId && condition !== 'Good' && condition !== 'Excellent') {
        setItems((current) => current.map((item) => item.id === returnedItemId ? { ...item, condition } : item))
      }
      setNotice(condition === 'Good' || condition === 'Excellent'
        ? 'Return recorded and condition checked. The reuse ledger has been updated.'
        : 'Return recorded. The item is unavailable until an authorized manager checks its condition.')
      setPage('Reuse ledger')
    }
    setModal(null)
  }

  const confirmHandover = async (transactionId: string) => {
    if (!demoMode) {
      try {
        await confirmHandoverInDb(transactionId)
        await refreshCloud()
        setNotice('Handover confirmed. The item is now marked as on loan.')
      } catch (error) {
        console.error('Could not confirm the Loopify handover.', error)
        setNotice(error instanceof Error ? error.message : 'Could not confirm the handover. Refresh and try again.')
      }
      return
    }
    setTransactions((current) => current.map((transaction) => transaction.id === transactionId && transaction.status === 'reserved'
      ? { ...transaction, status: 'on-loan', handedOverAt: new Date().toISOString() }
      : transaction))
    setNotice('Handover confirmed. The item is now marked as on loan.')
  }

  const cancelReservation = async (transactionId: string) => {
    if (!demoMode) {
      try {
        await cancelReservationInDb(transactionId)
        await refreshCloud()
        setNotice('Reservation cancelled. The item is available to other campus groups.')
      } catch (error) {
        console.error('Could not cancel the Loopify reservation.', error)
        setNotice(error instanceof Error ? error.message : 'Could not cancel the reservation. Refresh and try again.')
      }
      return
    }
    setTransactions((current) => current.map((transaction) => transaction.id === transactionId && transaction.status === 'reserved'
      ? { ...transaction, status: 'cancelled' }
      : transaction))
    setNotice('Reservation cancelled. The item is available to other campus groups.')
  }

  const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Inventory', icon: Box },
    { label: 'Reservations', icon: CalendarDays },
    { label: 'Reuse ledger', icon: ClipboardList },
    { label: 'Impact report', icon: Sprout },
  ]

  const navigate = (nextPage: Page) => {
    setPage(nextPage)
    setMobileNav(false)
    setNotice('')
  }

  const handleSignOut = () => {
    void onSignOut().catch((error: unknown) => {
      console.error('Could not sign out of Loopify.', error)
      setNotice(error instanceof Error ? error.message : 'Could not sign out. Please try again.')
    })
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate('Overview') }}>
          <span className="brand-mark"><Recycle size={21} strokeWidth={2.5} /></span>
          <span className="brand-word">loopify<span>.</span></span>
        </a>
        <div className="workspace-picker">
          <div className="workspace-symbol">{demoMode ? 'NC' : initials}</div>
          <div className="workspace-copy"><strong>{demoMode ? 'North campus' : organizationName}</strong><span>{demoMode ? 'Community workspace' : 'Campus workspace'}</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {label === 'Reservations' && activeTransactions.length > 0 && <span className="nav-count">{activeTransactions.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={17} /></div>
            <strong>New to Loopify?</strong>
            <p>See how a verified reuse cycle works.</p>
            <button onClick={() => navigate('Reuse ledger')}>Explore the ledger <ArrowRight size={14} /></button>
          </div>
          <button className="profile-button" onClick={handleSignOut}>
            <span className="avatar">{demoMode ? 'AM' : initials}</span><span className="profile-copy"><strong>{demoMode ? 'Alex Morgan' : displayName}</strong><small>{demoMode ? 'Demo coordinator · Exit' : `${organizationName} · Sign out`}</small></span><ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav((open) => !open)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>North campus</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <span className={`demo-chip ${demoMode ? '' : 'connected-chip'}`}><span /> {demoMode ? 'DEMO WORKSPACE' : 'CAMPUS CONNECTED'}</span>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice('You’re all caught up. New reservation updates will appear here.')}><Bell size={18} /><i /></button>
            {demoMode && isSupabaseConfigured ? <div className="account-actions">
              <button className="account-link" onClick={() => onOpenAuth('login')}>Sign in</button>
              <button className="account-link account-link-primary" onClick={() => onOpenAuth('register')}>Register</button>
            </div> : demoMode ? <span className="topbar-avatar">AM</span> : <div className="account-actions">
              <span className="topbar-avatar">{initials}</span>
              <button className="account-link" onClick={handleSignOut}>Sign out</button>
            </div>}
          </div>
        </header>

        <div className="page-content">
          {storageError && <div className="storage-alert" role="alert">{storageError}</div>}
          {cloudError && <div className="storage-alert cloud-alert" role="alert"><span>{cloudError}</span><button className="plain-link" onClick={() => {
            setLoadingData(true)
            void refreshCloud().catch((error: unknown) => {
              console.error('Could not reconnect to the Loopify campus database.', error)
              setCloudError(error instanceof Error ? error.message : 'Could not connect to the campus database.')
            }).finally(() => setLoadingData(false))
          }}>Retry</button><button className="plain-link" onClick={() => {
            void onSignOut().catch((error: unknown) => {
              console.error('Could not sign out of Loopify.', error)
              setNotice(error instanceof Error ? error.message : 'Could not sign out. Please try again.')
            })
          }}>Sign out</button></div>}
          {notice && <div className="notice" role="status"><CheckCircle2 size={17} />{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}
          {loadingData && <div className="workspace-loading"><span className="loading-spinner" /> Loading your shared campus data…</div>}
          {!loadingData && !cloudError && page === 'Overview' && <Overview
            itemCount={items.length}
            verifiedCount={verified.length}
            repeatUses={repeatUses}
            returnRate={returnRate}
            potentiallyAvoided={potentiallyAvoided}
            items={items}
            availableCount={availableCount}
            recentTransactions={recentTransactions}
            itemById={itemById}
            onNavigate={navigate}
            onAdd={() => openModal('add')}
            onReserve={(item) => openModal('reserve', item)}
          />}
          {!loadingData && !cloudError && page === 'Inventory' && <Inventory
            items={filteredItems}
            allItems={items}
            demoMode={demoMode}
            search={search}
            category={category}
            filterOpen={filterOpen}
            availableCount={availableCount}
            onSearch={setSearch}
            onCategory={setCategory}
            onFilterToggle={() => setFilterOpen((open) => !open)}
            onAdd={() => openModal('add')}
            onReserve={(item) => openModal('reserve', item)}
          />}
          {!loadingData && !cloudError && page === 'Reservations' && <Reservations
            transactions={transactions}
            itemById={itemById}
            onHandover={confirmHandover}
            onCancel={cancelReservation}
            onReturn={(transaction) => openModal('return', items.find((item) => item.id === transaction.itemId) ?? null, transaction.id)}
            onBrowse={() => navigate('Inventory')}
          />}
          {!loadingData && !cloudError && page === 'Reuse ledger' && <Ledger transactions={transactions} itemById={itemById} />}
          {!loadingData && !cloudError && page === 'Impact report' && <ImpactReport items={items} transactions={transactions} verifiedCount={verified.length} uniqueReused={uniqueReused} repeatUses={repeatUses} returnRate={returnRate} potentiallyAvoided={potentiallyAvoided} />}
        </div>
      </main>

      {modal && <Dialog
        type={modal}
        item={selectedItem}
        onClose={() => setModal(null)}
        onSubmit={submitModal}
        externalError={dialogError}
      />}
    </div>
  )
}

type OverviewProps = {
  itemCount: number
  verifiedCount: number
  repeatUses: number
  returnRate: number
  potentiallyAvoided: number
  items: Item[]
  availableCount: (item: Item) => number
  recentTransactions: Transaction[]
  itemById: Map<string, Item>
  onNavigate: (page: Page) => void
  onAdd: () => void
  onReserve: (item: Item) => void
}

function Overview(props: OverviewProps) {
  const featured = props.items.slice(0, 3)
  return (
    <>
      <section className="welcome-row">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR CAMPUS, IN CIRCULATION</div><h1>Good things go <em>around.</em></h1><p className="page-subtitle">Find what your campus already has. Share a little more, buy a little less.</p></div>
        <button className="button button-primary" onClick={props.onAdd}><Plus size={17} /> Add an item</button>
      </section>

      <section className="hero-banner">
        <div className="hero-copy"><span className="hero-kicker"><Sparkles size={14} /> A little goes a long way</span><h2>Every shared item<br />has another story.</h2><p>There are {props.items.length} materials in your campus circle right now. Someone’s next great event might need exactly what you have.</p><button className="button button-light" onClick={() => props.onNavigate('Inventory')}>Explore the inventory <ArrowRight size={16} /></button></div>
        <div className="hero-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="hero-leaf leaf-one">✳</span><span className="hero-leaf leaf-two">✳</span><div className="hero-object object-board"><span>THE<br />NEXT<br />THING</span></div><div className="hero-object object-box"><Recycle size={33} /></div><div className="hero-object object-spark">✦</div><div className="hero-object object-tag"><Leaf size={19} /></div></div>
        <div className="hero-index">01 <span /> 03</div>
      </section>

      <section className="metrics-grid" aria-label="Campus reuse metrics">
        <MetricCard title="Items in the circle" value={props.itemCount} foot="across the campus" icon={<Box size={18} />} tone="green" />
        <MetricCard title="Verified reuse cycles" value={props.verifiedCount} foot="returned & confirmed used" icon={<Recycle size={18} />} tone="orange" badge={`+${props.repeatUses} repeat`} />
        <MetricCard title="Return completion" value={`${props.returnRate}%`} foot="of items handed over" icon={<PackageCheck size={18} />} tone="blue" />
        <MetricCard title="Could’ve been bought new" value={props.potentiallyAvoided} foot="recipient-reported · not verified savings" icon={<Sprout size={18} />} tone="purple" />
      </section>

      <section className="content-columns">
        <div className="panel inventory-panel">
          <div className="panel-heading"><div><div className="section-kicker">GOOD FINDS</div><h2>Ready for another round</h2></div><button className="text-button" onClick={() => props.onNavigate('Inventory')}>View all <ArrowRight size={15} /></button></div>
          <div className="featured-list">
            {featured.map((item, index) => <div className="featured-item" key={item.id}>
              <div className={`item-thumbnail ${item.accent}`}><img src={item.imageUrl ?? itemImageForItem(item.name, item.category)} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /><span>{item.symbol}</span><small>{String(index + 1).padStart(2, '0')}</small></div>
              <div className="featured-copy"><strong>{item.name}</strong><span><MapPin size={12} /> {item.location.split(' · ')[0]}</span></div>
              <div className="availability"><span className={props.availableCount(item) > 0 ? 'status-dot' : 'status-dot muted'} />{props.availableCount(item) > 0 ? `${props.availableCount(item)} available` : 'Unavailable'}</div>
              <button className="round-arrow" aria-label={`Reserve ${item.name}`} disabled={!props.availableCount(item)} onClick={() => props.onReserve(item)}><ArrowUpRight size={16} /></button>
            </div>)}
          </div>
          <div className="panel-footer"><span><ShieldCheck size={15} /> Only condition-checked items can be reserved</span><button className="plain-link" onClick={() => props.onNavigate('Inventory')}>Browse materials <ArrowRight size={14} /></button></div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-heading"><div><div className="section-kicker">THE CIRCLE IN MOTION</div><h2>Recent activity</h2></div><button className="icon-button small-icon" aria-label="View reuse ledger" onClick={() => props.onNavigate('Reuse ledger')}><ArrowUpRight size={16} /></button></div>
          {props.recentTransactions.length ? <div className="activity-list">{props.recentTransactions.map((transaction, index) => {
            const item = props.itemById.get(transaction.itemId)
            const returned = transaction.status === 'returned'
            return <div className="activity-row" key={transaction.id}><div className={`activity-icon activity-${index % 4}`}>{returned ? <Recycle size={15} /> : transaction.status === 'on-loan' ? <Truck size={15} /> : <CalendarDays size={15} />}</div><div className="activity-copy"><strong>{transaction.borrower} {returned ? 'returned' : transaction.status === 'on-loan' ? 'picked up' : 'reserved'}</strong><span>{item?.name ?? 'Campus material'} · {transaction.event}</span></div><time>{formatDate(transaction.returnedAt ?? transaction.handedOverAt ?? transaction.reservedAt)}</time></div>
          })}</div> : <EmptyState title="A fresh start" copy="New reservations and returns will show up here." />}
          <div className="activity-footer"><span className="live-indicator" /> Demo activity · updates as you record a transaction</div>
        </div>
      </section>

      <section className="closing-note"><div className="closing-icon"><Leaf size={19} /></div><div><strong>Reuse is a small choice with a lovely ripple.</strong><span>Verified cycles count real handovers and returns. Impact claims stay honest and evidence-based.</span></div><button onClick={() => props.onNavigate('Impact report')}>How we measure <ArrowRight size={14} /></button></section>
    </>
  )
}

function MetricCard({ title, value, foot, icon, tone, badge }: { title: string; value: number | string; foot: string; icon: ReactNode; tone: string; badge?: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div>{badge && <span className="metric-badge">{badge}</span>}<div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></article>
}

function Inventory({ items, allItems, demoMode, search, category, filterOpen, availableCount, onSearch, onCategory, onFilterToggle, onAdd, onReserve }: {
  items: Item[]; allItems: Item[]; demoMode: boolean; search: string; category: string; filterOpen: boolean; availableCount: (item: Item) => number
  onSearch: (value: string) => void; onCategory: (value: string) => void; onFilterToggle: () => void; onAdd: () => void; onReserve: (item: Item) => void
}) {
  const categories = ['All materials', ...new Set(allItems.map((item) => item.category))]
  return <section className="listing-page">
    <div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> {demoMode ? 'DEMO CAMPUS INVENTORY' : 'SHARED CAMPUS INVENTORY'}</div><h1>Find your next <em>good thing.</em></h1><p className="page-subtitle">{demoMode ? 'Illustrative sample listings, not real campus stock.' : 'A little less buying, a lot more making do together.'}</p></div><button className="button button-primary" onClick={onAdd}><Plus size={17} /> List a material</button></div>
    <div className="inventory-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search materials, categories, locations..." /></label><div className="filter-wrap"><button className={`button button-outline ${filterOpen ? 'filter-active' : ''}`} onClick={onFilterToggle}><Filter size={16} /> Filter <ChevronDown size={14} /></button>{filterOpen && <div className="filter-popover"><span>Category</span>{categories.map((entry) => <button className={category === entry ? 'selected' : ''} key={entry} onClick={() => onCategory(entry)}>{entry}{category === entry && <Check size={14} />}</button>)}</div>}</div><span className="result-count">{items.length} materials</span></div>
    <div className="inventory-grid">{items.map((item) => {
      const available = availableCount(item)
      return <article className="material-card" key={item.id}>
        <div className={`material-art ${item.accent}`}><img className="material-image" src={item.imageUrl ?? itemImageForItem(item.name, item.category)} alt={item.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /><span className="art-symbol">{item.symbol}</span><span className="item-id">{item.id}</span><span className={`condition-pill ${item.condition === 'Good' || item.condition === 'Excellent' ? '' : 'condition-warning'}`}><i />{item.condition}</span></div>
        <div className="material-info"><span className="category-label">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p><div className="material-meta"><span><MapPin size={13} />{item.location}</span><span><Tags size={13} />{item.owner}</span></div>        <div className="material-card-footer"><span className={available > 0 ? 'available-copy' : 'unavailable-copy'}><i />{available} available now</span><button className="button button-small" disabled={item.condition === 'Needs repair' || item.condition === 'Under review'} onClick={() => onReserve(item)}>{item.condition === 'Needs repair' ? 'Needs repair' : item.condition === 'Under review' ? 'Under review' : 'Reserve'}{item.condition === 'Good' || item.condition === 'Excellent' ? <ArrowRight size={14} /> : null}</button></div></div>
      </article>
    })}</div>
    {!items.length && <EmptyState title="Nothing in this corner yet" copy="Try another search or clear your filter to see all campus materials." />}
  </section>
}

function Reservations({ transactions, itemById, onHandover, onCancel, onReturn, onBrowse }: {
  transactions: Transaction[]; itemById: Map<string, Item>; onHandover: (id: string) => void; onCancel: (id: string) => void; onReturn: (transaction: Transaction) => void; onBrowse: () => void
}) {
  const active = transactions.filter((transaction) => ['reserved', 'on-loan'].includes(transaction.status))
  const past = transactions.filter((transaction) => ['returned', 'needs-repair', 'cancelled'].includes(transaction.status)).slice(0, 4)
  return <section className="listing-page"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> LOANS & BOOKINGS</div><h1>Things on their <em>way around.</em></h1><p className="page-subtitle">Every booking gets a handover, a return, and a condition check.</p></div><button className="button button-primary" onClick={onBrowse}><Search size={16} /> Find a material</button></div>
    <div className="panel transaction-panel"><div className="panel-heading"><div><div className="section-kicker">NEEDS YOUR ATTENTION</div><h2>Active reservations <span className="heading-count">{active.length}</span></h2></div></div>
      {active.length ? <div className="transaction-list">{active.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} item={itemById.get(transaction.itemId)} onHandover={onHandover} onCancel={onCancel} onReturn={onReturn} />)}</div> : <EmptyState title="Nothing waiting right now" copy="Browse the inventory and reserve something for your next event." />}
    </div>
    <div className="panel transaction-panel history-panel"><div className="panel-heading"><div><div className="section-kicker">THE JOURNEY SO FAR</div><h2>Recent history</h2></div></div>
      {past.length ? <div className="transaction-list">{past.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} item={itemById.get(transaction.itemId)} onHandover={onHandover} onCancel={onCancel} onReturn={onReturn} />)}</div> : <EmptyState title="No completed journeys yet" copy="Once materials are returned, their verified journeys will be kept here." />}
    </div></section>
}

function TransactionRow({ transaction, item, onHandover, onCancel, onReturn }: {
  transaction: Transaction; item?: Item; onHandover: (id: string) => void; onCancel: (id: string) => void; onReturn: (transaction: Transaction) => void
}) {
  const isReserved = transaction.status === 'reserved'
  const isLoan = transaction.status === 'on-loan'
  const statusLabel = isReserved ? 'Awaiting handover' : isLoan ? 'On loan' : transaction.status === 'returned' ? 'Returned & checked' : transaction.status === 'needs-repair' ? 'Needs attention' : 'Cancelled'
  return <div className="transaction-row"><div className={`transaction-symbol ${item?.accent ?? 'mint'}`}>{item?.symbol ?? '▤'}</div><div className="transaction-details"><div className="transaction-title"><strong>{item?.name ?? 'Removed item'}</strong><span className={`transaction-status ${isLoan ? 'status-loan' : transaction.status === 'returned' ? 'status-complete' : transaction.status === 'needs-repair' ? 'status-warning' : ''}`}><i />{statusLabel}</span></div><span>{transaction.borrowerName ? `${transaction.borrowerName} · ` : ''}{transaction.borrower} · {transaction.event}</span><small><CalendarDays size={12} /> Pickup {formatDate(transaction.startDate)} · Return by {formatDate(transaction.dueDate)} <span>·</span> Ref {transaction.id}</small></div><div className="transaction-actions">{isReserved && <><button className="button button-small button-outline" onClick={() => onCancel(transaction.id)}>Cancel</button><button className="button button-small button-primary" onClick={() => onHandover(transaction.id)}><Handshake size={14} /> Confirm handover</button></>}{isLoan && <button className="button button-small button-primary" onClick={() => onReturn(transaction)}><PackageCheck size={14} /> Record return</button>}{transaction.status === 'needs-repair' && <span className="quiet-label">Unavailable until checked</span>}{transaction.status === 'returned' && <span className="verified-label"><ShieldCheck size={14} />{transaction.used ? 'Verified cycle' : 'Returned'}</span>}</div></div>
}

function Ledger({ transactions, itemById }: { transactions: Transaction[]; itemById: Map<string, Item> }) {
  const sorted = [...transactions].sort((a, b) => b.reservedAt.localeCompare(a.reservedAt))
  return <section className="listing-page"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> ITEM-LEVEL TRANSACTION HISTORY</div><h1>The <em>reuse ledger.</em></h1><p className="page-subtitle">A record of what actually moved—not just what was listed or booked.</p></div><span className="ledger-count"><ShieldCheck size={15} /> {transactions.length} recorded transactions</span></div>
    <div className="panel ledger-panel"><div className="table-scroll"><table><thead><tr><th>Material</th><th>Borrower & event</th><th>Reserved</th><th>Journey status</th><th>Reported alternative</th></tr></thead><tbody>
      {sorted.map((transaction) => {
        const item = itemById.get(transaction.itemId)
        const completed = transaction.status === 'returned' && transaction.used
        return <tr key={transaction.id}><td><div className="table-item"><span className={`table-symbol ${item?.accent ?? 'mint'}`}>{item?.symbol ?? '▤'}</span><span><strong>{item?.name ?? 'Removed item'}</strong><small>{transaction.itemId}</small></span></div></td><td><strong>{transaction.borrowerName ? `${transaction.borrowerName} · ` : ''}{transaction.borrower}</strong><small>{transaction.event}</small></td><td>{formatDate(transaction.reservedAt)}</td><td><span className={`transaction-status ${completed ? 'status-complete' : transaction.status === 'on-loan' ? 'status-loan' : transaction.status === 'needs-repair' ? 'status-warning' : ''}`}><i />{completed ? 'Verified reuse' : transaction.status === 'returned' ? 'Returned · not reported used' : transaction.status === 'on-loan' ? 'On loan' : transaction.status === 'reserved' ? 'Reserved' : transaction.status === 'needs-repair' ? 'Needs attention' : 'Cancelled'}</span><small>Pickup {formatDate(transaction.startDate)} · Return by {formatDate(transaction.dueDate)}</small></td><td>{transaction.outcome ? <span className={transaction.outcome === 'new-purchase' ? 'reported-outcome' : 'muted-copy'}>{outcomeLabels[transaction.outcome]}{transaction.outcome === 'new-purchase' && <small>Self-reported</small>}</span> : <span className="muted-copy">—</span>}</td></tr>
      })}
    </tbody></table></div>
      {!sorted.length && <EmptyState title="The ledger starts here" copy="Once someone reserves, hands over, and returns a material, its story will appear here." />}
      <div className="ledger-footnote"><ShieldCheck size={15} /> A reservation is not a handover. Only a returned, condition-checked item reported as used counts as a verified reuse cycle.</div>
    </div></section>
}

function ImpactReport({ items, transactions, verifiedCount, uniqueReused, repeatUses, returnRate, potentiallyAvoided }: {
  items: Item[]; transactions: Transaction[]; verifiedCount: number; uniqueReused: number; repeatUses: number; returnRate: number; potentiallyAvoided: number
}) {
  const monthCount = transactions.filter((transaction) => transaction.returnedAt && transaction.returnedAt.slice(0, 7) === new Date().toISOString().slice(0, 7) && transaction.status === 'returned' && transaction.used).length
  const repairs = items.filter((item) => item.condition === 'Needs repair' || item.condition === 'Under review').length
  const reportRows = [
    { label: 'Verified reuse cycles', value: verifiedCount, description: 'Returned, condition checked, and reported used' },
    { label: 'Unique items reused', value: uniqueReused, description: 'Distinct inventory items with a verified cycle' },
    { label: 'Repeat uses', value: repeatUses, description: 'Verified uses after an item’s first use' },
    { label: 'Potential purchases avoided', value: potentiallyAvoided, description: 'Recipient-reported; not independently verified' },
  ]
  return <section className="listing-page"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> THE HONEST PICTURE</div><h1>Small ripples, <em>real records.</em></h1><p className="page-subtitle">The story told by your campus transactions. No guesswork, no greenwashing.</p></div><span className="ledger-count"><span className="live-indicator" /> All time · demo data</span></div>
    <div className="impact-banner"><div className="impact-leaf"><Sprout size={30} /></div><div><span className="section-kicker">WHAT THIS PILOT CAN TELL YOU</span><h2>{verifiedCount} real {verifiedCount === 1 ? 'journey' : 'journeys'} through your campus.</h2><p>Each cycle below is calculated from recorded handovers, returns, condition checks, and borrower responses.</p></div><span className="impact-stamp"><Recycle size={25} /> IN<br />CIRCULATION</span></div>
    <div className="impact-summary-grid"><div className="impact-highlight"><span>THIS MONTH</span><strong>{monthCount}</strong><small>verified {monthCount === 1 ? 'cycle' : 'cycles'}</small><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /></div></div><div className="impact-highlight"><span>RETURN COMPLETION</span><strong>{returnRate}%</strong><small>of handovers have a recorded return</small><div className="progress-track"><span style={{ width: `${returnRate}%` }} /></div></div><div className="impact-highlight"><span>ITEMS NEEDING ATTENTION</span><strong>{repairs}</strong><small>blocked from new reservations</small><div className="attention-dots"><i /><i /><i /><i /><i /><i /><i /></div></div></div>
    <div className="panel impact-table-panel"><div className="panel-heading"><div><div className="section-kicker">MEASURED FROM THE LEDGER</div><h2>What we can say so far</h2></div></div><div className="impact-rows">{reportRows.map((row, index) => <div className="impact-row" key={row.label}><div className={`impact-row-number impact-number-${index}`}>{String(index + 1).padStart(2, '0')}</div><div className="impact-row-copy"><strong>{row.label}</strong><span>{row.description}</span></div><strong className="impact-row-value">{row.value}</strong></div>)}</div></div>
    <div className="evidence-note"><div className="evidence-icon"><ShieldCheck size={19} /></div><div><strong>We don’t turn a good story into an unsupported carbon claim.</strong><p>A reported “would have bought new” is a useful pilot signal—not proof of a purchase avoided or emissions saved. Environmental estimates need item, material, transport, and lifecycle data that this demo does not yet collect.</p><span><ArrowDownLeft size={13} /> This workspace contains simulated demo records. Pilot findings should use real campus transactions.</span></div></div>
  </section>
}

function Dialog({ type, item, onClose, onSubmit, externalError }: { type: Exclude<Modal, null>; item: Item | null; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; externalError: string }) {
  const [formError, setFormError] = useState('')
  const titles = { add: 'Add to the circle', reserve: 'Make it yours for a while', return: 'Bring it back around' }
  const submitLabel = { add: 'Add material', reserve: 'Request reservation', return: 'Record return' }
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget)
    if (type === 'add' && !String(form.get('name') || '').trim()) {
      event.preventDefault()
      setFormError('Give this material a name before adding it.')
      return
    }
    if (type === 'reserve' && form.get('startDate') && form.get('dueDate') && String(form.get('dueDate')) < String(form.get('startDate'))) {
      event.preventDefault()
      setFormError('The return date should be on or after the event date.')
      return
    }
    setFormError('')
    onSubmit(event)
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><div><div className="section-kicker">{type === 'return' ? 'CLOSE THE LOOP' : type === 'reserve' ? 'MAKE SOMETHING HAPPEN' : 'GIVE IT ANOTHER LIFE'}</div><h2 id="dialog-title">{titles[type]}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={handleSubmit}>
      {type === 'add' && <div className="form-grid"><label className="form-field span-two">Material name<input name="name" placeholder="e.g. Reusable welcome banner" required autoFocus /></label><label className="form-field">Category<select name="category"><option>Display & signage</option><option>Furniture</option><option>Lighting & decor</option><option>Audio & tech</option><option>Other</option></select></label><label className="form-field">Condition<select name="condition"><option>Good</option><option>Excellent</option><option>Needs repair</option><option>Under review</option></select></label><label className="form-field">Quantity<input name="quantity" type="number" min="1" defaultValue="1" /></label><label className="form-field">Responsible group<input name="owner" placeholder="Your club or department" /></label><label className="form-field span-two">Description<input name="description" placeholder="Size, materials, what's included..." /></label><label className="form-field span-two">Collection location<input name="location" placeholder="Building · room or collection point" /></label></div>}
      {type === 'reserve' && <><div className="dialog-item"><span className={`table-symbol ${item?.accent ?? 'mint'}`}>{item?.symbol ?? '▤'}</span><span><strong>{item?.name ?? 'Campus material'}</strong><small>{item?.condition} condition · {item?.location}</small></span></div><div className="form-grid"><label className="form-field span-two">Club or organization<input name="organization" placeholder="e.g. Architecture Society" required autoFocus /></label><label className="form-field span-two">What’s the event?<input name="event" placeholder="Give the event a name" required /></label><label className="form-field">Event date<input name="startDate" type="date" min={day(0)} defaultValue={day(2)} required /></label><label className="form-field">Return by<input name="dueDate" type="date" min={day(0)} defaultValue={day(3)} required /></label></div><p className="form-hint"><ShieldCheck size={14} /> Your request is saved as a reservation. The item is only counted as reused after handover, return, and condition check.</p></>}
      {type === 'return' && <><div className="dialog-item"><span className={`table-symbol ${item?.accent ?? 'mint'}`}>{item?.symbol ?? '▤'}</span><span><strong>{item?.name ?? 'Campus material'}</strong><small>Record how it came back from the event.</small></span></div><div className="form-grid"><label className="form-field span-two">Condition on return<select name="condition"><option>Good</option><option>Excellent</option><option>Needs repair</option><option>Under review</option></select></label><label className="form-field span-two">Without borrowing, what would you likely have done?<select name="outcome"><option value="not-answered">Prefer not to say</option><option value="new-purchase">Bought something new</option><option value="borrowed">Borrowed from another source</option><option value="owned">Reused something we own</option><option value="changed-plan">Changed or cancelled our plan</option><option value="unsure">Not sure</option></select></label><label className="used-check span-two"><input name="used" type="checkbox" defaultChecked /><span><strong>We used this material at the event</strong><small>Self-reported by the borrowing organization.</small></span></label><label className="form-field span-two">Anything to note? <textarea name="note" placeholder="Cleaning, repairs, or a helpful detail for the next group..." rows={2} /></label></div><p className="form-hint"><ShieldCheck size={14} /> A returned item marked “needs repair” stays unavailable until it is checked.</p></>}
      {(formError || externalError) && <div className="form-error" role="alert">{formError || externalError}</div>}
      <div className="dialog-actions"><button type="button" className="button button-outline" onClick={onClose}>Not now</button><button type="submit" className="button button-primary">{submitLabel[type]} <ArrowRight size={15} /></button></div>
    </form>
  </section></div>
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><span><Recycle size={23} /></span><strong>{title}</strong><p>{copy}</p></div>
}
