export type Condition = 'Excellent' | 'Good' | 'Needs repair' | 'Under review'
export type TransactionStatus = 'reserved' | 'on-loan' | 'returned' | 'needs-repair' | 'cancelled'
export type Outcome = 'new-purchase' | 'borrowed' | 'owned' | 'changed-plan' | 'unsure' | 'not-answered'

export type Item = {
  id: string
  name: string
  category: string
  description: string
  condition: Condition
  location: string
  owner: string
  quantity: number
  accent: string
  symbol: string
  imageUrl?: string
}

export type Transaction = {
  id: string
  itemId: string
  borrowerName?: string
  borrower: string
  event: string
  startDate: string
  dueDate: string
  status: TransactionStatus
  reservedAt: string
  handedOverAt?: string
  returnedAt?: string
  returnCondition?: Condition
  used?: boolean
  outcome?: Outcome
  note?: string
}
