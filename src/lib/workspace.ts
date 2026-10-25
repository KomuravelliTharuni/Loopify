import type { Condition, Item, Outcome, Transaction, TransactionStatus } from './types'
import { itemImageForItem } from './itemImages'
import { supabase } from './supabase'

type ItemRow = {
  id: string
  name: string
  category: string
  description: string
  condition: Condition
  storage_location: string
  owner_organization: string
  quantity: number
}

type TransactionRow = {
  id: string
  item_id: string
  borrower_id: string
  borrower_organization: string
  event_name: string
  start_date: string
  due_date: string
  status: TransactionStatus
  reserved_at: string
  handed_over_at: string | null
  returned_at: string | null
  return_condition: Condition | null
  used_at_event: boolean | null
  reported_alternative: Outcome | null
  note: string | null
}

type ProfileRow = {
  id: string
  display_name: string
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add your project URL and anon key to .env.local.')
  return supabase
}

function itemAppearance(category: string, name: string) {
  const accents = ['mint', 'peach', 'blue', 'lavender', 'yellow', 'pink', 'sage']
  const symbols: Record<string, string> = {
    Furniture: '▱',
    'Lighting & decor': '✳',
    'Audio & tech': '◉',
  }
  const index = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0) % accents.length
  return { accent: accents[index], symbol: symbols[category] ?? '▤' }
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    condition: row.condition,
    location: row.storage_location,
    owner: row.owner_organization,
    quantity: row.quantity,
    imageUrl: itemImageForItem(row.name, row.category),
    ...itemAppearance(row.category, row.name),
  }
}

function mapTransaction(row: TransactionRow, profiles: Map<string, string>): Transaction {
  return {
    id: row.id,
    itemId: row.item_id,
    ...(profiles.get(row.borrower_id) ? { borrowerName: profiles.get(row.borrower_id) } : {}),
    borrower: row.borrower_organization,
    event: row.event_name,
    startDate: row.start_date,
    dueDate: row.due_date,
    status: row.status,
    reservedAt: row.reserved_at,
    ...(row.handed_over_at ? { handedOverAt: row.handed_over_at } : {}),
    ...(row.returned_at ? { returnedAt: row.returned_at } : {}),
    ...(row.return_condition ? { returnCondition: row.return_condition } : {}),
    ...(row.used_at_event === null ? {} : { used: row.used_at_event }),
    ...(row.reported_alternative ? { outcome: row.reported_alternative } : {}),
    ...(row.note ? { note: row.note } : {}),
  }
}

export async function loadWorkspace() {
  const db = client()
  const [itemResult, transactionResult] = await Promise.all([
    db.from('items').select('id,name,category,description,condition,storage_location,owner_organization,quantity').order('created_at', { ascending: false }),
    db.from('transactions').select('id,item_id,borrower_id,borrower_organization,event_name,start_date,due_date,status,reserved_at,handed_over_at,returned_at,return_condition,used_at_event,reported_alternative,note').order('reserved_at', { ascending: false }),
  ])
  if (itemResult.error) throw itemResult.error
  if (transactionResult.error) throw transactionResult.error
  const borrowerIds = [...new Set((transactionResult.data as TransactionRow[]).map((row) => row.borrower_id))]
  const profilesById = new Map<string, string>()
  if (borrowerIds.length) {
    const profileResult = await db.from('profiles').select('id,display_name').in('id', borrowerIds)
    if (profileResult.error) throw profileResult.error
    for (const profile of profileResult.data as ProfileRow[]) {
      if (profile.display_name.trim()) profilesById.set(profile.id, profile.display_name)
    }
  }
  return {
    items: (itemResult.data as ItemRow[]).map(mapItem),
    transactions: (transactionResult.data as TransactionRow[]).map((row) => mapTransaction(row, profilesById)),
  }
}

export async function createItem(input: {
  ownerId: string
  name: string
  category: string
  description: string
  condition: Condition
  location: string
  owner: string
  quantity: number
}) {
  const { error } = await client().from('items').insert({
    owner_id: input.ownerId,
    name: input.name,
    category: input.category,
    description: input.description,
    condition: input.condition,
    storage_location: input.location,
    owner_organization: input.owner,
    quantity: input.quantity,
  })
  if (error) throw error
}

export async function reserveItem(input: {
  itemId: string
  organization: string
  event: string
  startDate: string
  dueDate: string
}) {
  const { error } = await client().rpc('reserve_item', {
    p_item_id: input.itemId,
    p_borrower_organization: input.organization,
    p_event_name: input.event,
    p_start_date: input.startDate,
    p_due_date: input.dueDate,
  })
  if (error) throw error
}

export async function confirmHandover(transactionId: string) {
  const { error } = await client().rpc('confirm_handover', { p_transaction_id: transactionId })
  if (error) throw error
}

export async function cancelReservation(transactionId: string) {
  const { error } = await client().rpc('cancel_reservation', { p_transaction_id: transactionId })
  if (error) throw error
}

export async function recordReturn(input: {
  transactionId: string
  condition: Condition
  used: boolean
  outcome: Outcome
  note: string
}) {
  const { error } = await client().rpc('record_return', {
    p_transaction_id: input.transactionId,
    p_return_condition: input.condition,
    p_used_at_event: input.used,
    p_reported_alternative: input.outcome,
    p_note: input.note || null,
  })
  if (error) throw error
}
