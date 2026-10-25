import type { Item } from './types'
import { itemImageForItem } from './itemImages'

const curatedItems: Omit<Item, 'imageUrl'>[] = [
  { id: 'ITM-104', name: 'Modular display boards', category: 'Display & signage', description: 'Lightweight panels · 90 × 120 cm', condition: 'Good', location: 'Arts building · Store 02', owner: 'Design Society', quantity: 4, accent: 'mint', symbol: '▤' },
  { id: 'ITM-126', name: 'Folding trestle tables', category: 'Furniture', description: 'Easy-fold · 6 ft · seats 6–8', condition: 'Good', location: 'Central store · Bay 4', owner: 'Facilities team', quantity: 6, accent: 'blue', symbol: '▱' },
  { id: 'ITM-093', name: 'Warm string lights', category: 'Lighting & decor', description: 'LED · 10 m · indoor use only', condition: 'Good', location: 'Arts building · Store 02', owner: 'Theatre Society', quantity: 3, accent: 'lavender', symbol: '✳' },
  { id: 'ITM-115', name: 'A-frame chalkboard sign', category: 'Display & signage', description: 'Double-sided · event directions and menus', condition: 'Good', location: 'North hall · Closet', owner: 'Campus Events', quantity: 1, accent: 'yellow', symbol: '▱' },
  { id: 'ITM-072', name: 'Reusable fabric bunting', category: 'Lighting & decor', description: 'Colorful set · 24 m · washable', condition: 'Excellent', location: 'Student center · Desk', owner: 'Green Campus', quantity: 8, accent: 'pink', symbol: '⌁' },
  { id: 'ITM-131', name: 'Portable PA speaker', category: 'Audio & tech', description: 'Amplified sound for talks and campus events', condition: 'Good', location: 'Media room · Shelf 2', owner: 'Media Club', quantity: 2, accent: 'sage', symbol: '◉' },
  { id: 'ITM-141', name: 'Wireless microphone set', category: 'Audio & tech', description: 'Two handheld mics · receiver included', condition: 'Good', location: 'Media room · Shelf 3', owner: 'Media Club', quantity: 2, accent: 'blue', symbol: '◉' },
  { id: 'ITM-180', name: 'Portable stage riser', category: 'Stage & event', description: 'Modular platform · indoor use', condition: 'Good', location: 'Central store · Bay 5', owner: 'Facilities team', quantity: 4, accent: 'peach', symbol: '▥' },
  { id: 'ITM-181', name: 'HDMI projector', category: 'Audio & tech', description: 'Portable projector · includes power cable', condition: 'Good', location: 'Media room · Shelf 1', owner: 'Media Club', quantity: 1, accent: 'blue', symbol: '◉' },
  { id: 'ITM-182', name: 'Queue barrier set', category: 'Stage & event', description: 'Retractable belt barriers · set of 4', condition: 'Good', location: 'Student center · Store 01', owner: 'Student Union', quantity: 4, accent: 'yellow', symbol: '▥' },
  { id: 'ITM-183', name: 'Reusable serving tray set', category: 'Catering & serving', description: 'Stainless-steel trays · cleaned and ready', condition: 'Good', location: 'Central store · Bay 2', owner: 'Facilities team', quantity: 4, accent: 'mint', symbol: '◒' },
]

export const demoCatalogItems: Item[] = curatedItems.map((item, index) => ({
  ...item,
  imageUrl: itemImageForItem(item.name, item.category, index),
}))
